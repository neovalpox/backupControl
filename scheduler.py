"""
Service de planification des tâches
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from loguru import logger
from datetime import datetime

from app.core.config import settings


class SchedulerService:
    """Service de planification des tâches automatiques"""

    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self._is_running = False

    def start(self):
        """Démarre le scheduler"""
        if self._is_running:
            return

        # Tâche quotidienne d'analyse des e-mails à 6h00
        self.scheduler.add_job(
            self._daily_email_analysis,
            CronTrigger(hour=settings.email_check_hour, minute=0),
            id="daily_email_analysis",
            name="Analyse quotidienne des e-mails",
            replace_existing=True
        )

        # Tâche de mise à jour des statuts toutes les heures
        self.scheduler.add_job(
            self._update_backup_statuses,
            CronTrigger(minute=0),
            id="update_backup_statuses",
            name="Mise à jour des statuts de sauvegarde",
            replace_existing=True
        )

        # Tâche de nettoyage des logs anciens (hebdomadaire)
        self.scheduler.add_job(
            self._cleanup_old_logs,
            CronTrigger(day_of_week="sun", hour=3, minute=0),
            id="cleanup_old_logs",
            name="Nettoyage des anciens logs",
            replace_existing=True
        )

        # Tâche de génération des suggestions IA (quotidienne à 7h)
        self.scheduler.add_job(
            self._generate_ai_suggestions,
            CronTrigger(hour=settings.email_check_hour + 1, minute=0),
            id="generate_ai_suggestions",
            name="Génération des suggestions IA",
            replace_existing=True
        )

        self.scheduler.start()
        self._is_running = True
        logger.info(f"Scheduler démarré - Analyse quotidienne à {settings.email_check_hour}h00")

    def shutdown(self):
        """Arrête le scheduler"""
        if self._is_running:
            self.scheduler.shutdown()
            self._is_running = False
            logger.info("Scheduler arrêté")

    async def _daily_email_analysis(self):
        """Tâche quotidienne d'analyse des e-mails via emails_v2"""
        logger.info("🔄 Début de l'analyse quotidienne automatique des e-mails...")

        try:
            from app.core.database import AsyncSessionLocal
            from app.services.settings_service import get_email_settings, get_ai_settings
            from app.models.email import Email
            from app.models.client import Client
            from app.models.backup import Backup, BackupEvent, BackupStatus
            from sqlalchemy import select
            import anthropic
            import openai
            import json

            async with AsyncSessionLocal() as db:
                # Récupérer les settings
                email_settings = await get_email_settings(db)
                ai_settings = await get_ai_settings(db)

                email_type = email_settings.get("email_type", "imap")
                logger.info(f"📧 Type d'email configuré: {email_type}")

                # Récupérer les emails
                emails = []
                
                if email_type == "office365":
                    emails = await self._fetch_office365_emails(email_settings, limit=500)
                elif email_type == "gmail":
                    emails = await self._fetch_gmail_emails(email_settings, limit=500)
                else:
                    emails = await self._fetch_imap_emails(email_settings, limit=500)

                logger.info(f"📧 {len(emails)} emails récupérés")

                if not emails:
                    logger.warning("Aucun email à analyser")
                    return

                # Analyser chaque email
                ai_provider = ai_settings.get("ai_provider", "claude")
                api_key = ai_settings.get("claude_api_key") if ai_provider == "claude" else ai_settings.get("openai_api_key")

                if not api_key:
                    logger.error("Clé API IA non configurée")
                    return

                clients_created = 0
                backups_created = 0
                events_created = 0

                for email_data in emails:
                    try:
                        # Vérifier si déjà traité
                        existing = await db.execute(
                            select(Email).where(Email.message_id == email_data.get("message_id"))
                        )
                        if existing.scalar_one_or_none():
                            continue

                        # Analyser avec l'IA
                        analysis = await self._analyze_with_ai(
                            email_data, 
                            ai_provider, 
                            api_key,
                            ai_settings.get("claude_model", "claude-sonnet-4-20250514")
                        )

                        if not analysis:
                            continue

                        # Sauvegarder l'email
                        email_record = Email(
                            message_id=email_data.get("message_id"),
                            subject=email_data.get("subject"),
                            sender=email_data.get("sender"),
                            received_at=email_data.get("received_at"),
                            body_text=email_data.get("body_text"),
                            body_html=email_data.get("body_html"),
                            is_backup_notification=analysis.get("is_backup_notification", False),
                            detected_type=analysis.get("backup_type"),
                            detected_status=analysis.get("status"),
                            detected_nas=analysis.get("source_nas"),
                            ai_extracted_data=analysis,
                            ai_confidence=analysis.get("confidence", 0),
                            is_processed=True,
                            processed_at=datetime.utcnow()
                        )
                        db.add(email_record)

                        # Si c'est une notification de backup
                        if analysis.get("is_backup_notification"):
                            result = await self._process_backup_notification(db, email_record, analysis)
                            clients_created += result.get("clients_created", 0)
                            backups_created += result.get("backups_created", 0)
                            events_created += result.get("events_created", 0)

                    except Exception as e:
                        logger.error(f"Erreur analyse email: {e}")
                        continue

                await db.commit()

            logger.info(f"✅ Analyse quotidienne terminée: {clients_created} clients, {backups_created} sauvegardes, {events_created} événements")

        except Exception as e:
            logger.error(f"❌ Erreur lors de l'analyse quotidienne: {e}")

    async def _fetch_office365_emails(self, settings: dict, limit: int = 500) -> list:
        """Récupère les emails via Office 365 Graph API"""
        import aiohttp
        
        client_id = settings.get("office365_client_id")
        client_secret = settings.get("office365_client_secret")
        tenant_id = settings.get("office365_tenant_id")
        email_address = settings.get("email_address")

        if not all([client_id, client_secret, tenant_id]):
            logger.error("Configuration Office 365 incomplète")
            return []

        try:
            # Get token
            async with aiohttp.ClientSession() as session:
                token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
                token_data = {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "scope": "https://graph.microsoft.com/.default",
                    "grant_type": "client_credentials"
                }
                
                async with session.post(token_url, data=token_data) as resp:
                    if resp.status != 200:
                        logger.error(f"Erreur token Office 365: {resp.status}")
                        return []
                    token_resp = await resp.json()
                    access_token = token_resp.get("access_token")

                # Get emails
                headers = {"Authorization": f"Bearer {access_token}"}
                mail_url = f"https://graph.microsoft.com/v1.0/users/{email_address}/messages?$top={limit}&$orderby=receivedDateTime desc"
                
                async with session.get(mail_url, headers=headers) as resp:
                    if resp.status != 200:
                        logger.error(f"Erreur récupération emails: {resp.status}")
                        return []
                    data = await resp.json()
                    
                    emails = []
                    for msg in data.get("value", []):
                        emails.append({
                            "message_id": msg.get("id"),
                            "subject": msg.get("subject"),
                            "sender": msg.get("from", {}).get("emailAddress", {}).get("address"),
                            "received_at": msg.get("receivedDateTime"),
                            "body_text": msg.get("body", {}).get("content") if msg.get("body", {}).get("contentType") == "text" else None,
                            "body_html": msg.get("body", {}).get("content") if msg.get("body", {}).get("contentType") == "html" else None,
                        })
                    return emails

        except Exception as e:
            logger.error(f"Erreur Office 365: {e}")
            return []

    async def _fetch_imap_emails(self, settings: dict, limit: int = 500) -> list:
        """Récupère les emails via IMAP"""
        import imaplib
        import email
        from email.header import decode_header

        server = settings.get("imap_server")
        port = settings.get("imap_port", 993)
        username = settings.get("email_address")
        password = settings.get("email_password")
        use_ssl = settings.get("imap_use_ssl", True)

        if not all([server, username, password]):
            logger.error("Configuration IMAP incomplète")
            return []

        try:
            if use_ssl:
                mail = imaplib.IMAP4_SSL(server, port)
            else:
                mail = imaplib.IMAP4(server, port)

            mail.login(username, password)
            mail.select("INBOX")

            # Rechercher les emails
            _, message_numbers = mail.search(None, "ALL")
            email_ids = message_numbers[0].split()[-limit:]

            emails = []
            for email_id in reversed(email_ids):
                _, msg_data = mail.fetch(email_id, "(RFC822)")
                email_body = msg_data[0][1]
                msg = email.message_from_bytes(email_body)

                # Décoder le sujet
                subject = ""
                if msg["Subject"]:
                    decoded = decode_header(msg["Subject"])
                    subject = decoded[0][0]
                    if isinstance(subject, bytes):
                        subject = subject.decode(decoded[0][1] or "utf-8", errors="ignore")

                # Décoder l'expéditeur
                sender = msg.get("From", "")

                # Extraire le corps
                body_text = ""
                body_html = ""
                if msg.is_multipart():
                    for part in msg.walk():
                        content_type = part.get_content_type()
                        if content_type == "text/plain":
                            body_text = part.get_payload(decode=True).decode("utf-8", errors="ignore")
                        elif content_type == "text/html":
                            body_html = part.get_payload(decode=True).decode("utf-8", errors="ignore")
                else:
                    body_text = msg.get_payload(decode=True).decode("utf-8", errors="ignore")

                emails.append({
                    "message_id": msg.get("Message-ID", str(email_id)),
                    "subject": subject,
                    "sender": sender,
                    "received_at": msg.get("Date"),
                    "body_text": body_text,
                    "body_html": body_html,
                })

            mail.logout()
            return emails

        except Exception as e:
            logger.error(f"Erreur IMAP: {e}")
            return []

    async def _fetch_gmail_emails(self, settings: dict, limit: int = 500) -> list:
        """Récupère les emails via Gmail API"""
        # TODO: Implémenter si nécessaire
        logger.warning("Gmail API non implémenté, utilisation d'IMAP")
        return await self._fetch_imap_emails(settings, limit)

    async def _analyze_with_ai(self, email_data: dict, provider: str, api_key: str, model: str = None) -> dict:
        """Analyse un email avec l'IA"""
        import anthropic
        
        subject = email_data.get("subject", "")
        body = email_data.get("body_text") or email_data.get("body_html") or ""
        
        # Limiter la taille du corps
        if len(body) > 8000:
            body = body[:8000] + "..."

        prompt = f"""Analyse cet email et détermine s'il s'agit d'une notification de sauvegarde.

Sujet: {subject}
Contenu: {body}

Réponds UNIQUEMENT en JSON valide avec cette structure:
{{
    "is_backup_notification": true/false,
    "backup_type": "hyper_backup" | "active_backup" | "rsync" | "3cx" | "veeam" | "acronis" | "other" | null,
    "status": "success" | "failure" | "warning" | null,
    "source_nas": "nom du NAS ou serveur source" | null,
    "task_name": "nom de la tâche de sauvegarde" | null,
    "client_name": "nom du client si identifiable" | null,
    "error_message": "message d'erreur si échec" | null,
    "confidence": 0-100
}}"""

        try:
            if provider == "claude":
                client = anthropic.Anthropic(api_key=api_key)
                response = client.messages.create(
                    model=model or "claude-sonnet-4-20250514",
                    max_tokens=1024,
                    messages=[{"role": "user", "content": prompt}]
                )
                result_text = response.content[0].text
            else:
                import openai
                client = openai.OpenAI(api_key=api_key)
                response = client.chat.completions.create(
                    model=model or "gpt-4o",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=1024
                )
                result_text = response.choices[0].message.content

            # Parser le JSON
            import json
            import re
            
            json_match = re.search(r'\{[\s\S]*\}', result_text)
            if json_match:
                return json.loads(json_match.group())
            return None

        except Exception as e:
            logger.error(f"Erreur analyse IA: {e}")
            return None

    async def _process_backup_notification(self, db, email_record, analysis: dict) -> dict:
        """Traite une notification de backup et crée/met à jour les entités"""
        from app.models.client import Client
        from app.models.backup import Backup, BackupEvent, BackupStatus
        from sqlalchemy import select

        result = {"clients_created": 0, "backups_created": 0, "events_created": 0}

        source_nas = analysis.get("source_nas")
        client_name = analysis.get("client_name") or source_nas
        task_name = analysis.get("task_name") or "Default"
        backup_type = analysis.get("backup_type") or "other"
        status = analysis.get("status") or "unknown"

        if not source_nas:
            return result

        # Trouver ou créer le client
        client_result = await db.execute(
            select(Client).where(Client.name == client_name)
        )
        client = client_result.scalar_one_or_none()

        if not client:
            client = Client(name=client_name, is_active=True)
            db.add(client)
            await db.flush()
            result["clients_created"] = 1

        # Trouver ou créer la sauvegarde
        backup_result = await db.execute(
            select(Backup).where(
                Backup.client_id == client.id,
                Backup.source_nas == source_nas,
                Backup.name == task_name
            )
        )
        backup = backup_result.scalar_one_or_none()

        if not backup:
            backup = Backup(
                client_id=client.id,
                name=task_name,
                source_nas=source_nas,
                backup_type=backup_type,
                is_active=True,
                current_status=BackupStatus.OK.value if status == "success" else BackupStatus.FAILED.value
            )
            db.add(backup)
            await db.flush()
            result["backups_created"] = 1

        # Créer l'événement
        event = BackupEvent(
            backup_id=backup.id,
            email_id=email_record.id,
            event_type=status,
            event_date=email_record.received_at or datetime.utcnow(),
            error_message=analysis.get("error_message"),
            parsed_data=analysis
        )
        db.add(event)
        result["events_created"] = 1

        # Mettre à jour le backup
        if status == "success":
            backup.last_success_at = email_record.received_at or datetime.utcnow()
            backup.total_success_count = (backup.total_success_count or 0) + 1
            backup.current_status = BackupStatus.OK.value
        elif status == "failure":
            backup.last_failure_at = email_record.received_at or datetime.utcnow()
            backup.total_failure_count = (backup.total_failure_count or 0) + 1
            backup.current_status = BackupStatus.FAILED.value

        backup.last_event_at = email_record.received_at or datetime.utcnow()

        return result

    async def _update_backup_statuses(self):
        """Met à jour les statuts des sauvegardes en fonction du temps"""
        logger.info("🔄 Mise à jour des statuts de sauvegarde...")

        try:
            from app.core.database import AsyncSessionLocal
            from app.models.backup import Backup, BackupStatus
            from app.models.alert import Alert
            from sqlalchemy import select
            from datetime import timedelta

            now = datetime.utcnow()

            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(Backup).where(Backup.is_active == True)
                )
                backups = result.scalars().all()

                for backup in backups:
                    if backup.is_maintenance:
                        continue

                    last_success = backup.last_success_at
                    if not last_success:
                        backup.current_status = BackupStatus.UNKNOWN.value
                        continue

                    hours_since_success = (now - last_success).total_seconds() / 3600

                    old_status = backup.current_status

                    if hours_since_success <= 24:
                        backup.current_status = BackupStatus.OK.value
                    elif hours_since_success <= 48:
                        backup.current_status = BackupStatus.WARNING.value
                    elif hours_since_success <= 72:
                        backup.current_status = BackupStatus.ALERT.value
                    else:
                        backup.current_status = BackupStatus.CRITICAL.value

                    # Créer une alerte si le statut a changé vers un niveau plus grave
                    if old_status != backup.current_status and backup.current_status in [
                        BackupStatus.ALERT.value, BackupStatus.CRITICAL.value
                    ]:
                        alert = Alert(
                            alert_type="backup_missing",
                            severity=backup.current_status,
                            client_id=backup.client_id,
                            backup_id=backup.id,
                            title=f"Sauvegarde manquante: {backup.name}",
                            message=f"Aucune sauvegarde réussie depuis {int(hours_since_success)}h"
                        )
                        db.add(alert)

                await db.commit()

            logger.info("✅ Statuts mis à jour")

        except Exception as e:
            logger.error(f"❌ Erreur lors de la mise à jour des statuts: {e}")

    async def _cleanup_old_logs(self):
        """Nettoie les anciens logs et données"""
        logger.info("🧹 Nettoyage des anciens logs...")

        try:
            from app.core.database import AsyncSessionLocal
            from app.models.email import Email
            from sqlalchemy import delete
            from datetime import timedelta

            cutoff_date = datetime.utcnow() - timedelta(days=settings.log_retention_days)

            async with AsyncSessionLocal() as db:
                # Suppression des anciens e-mails non liés à des sauvegardes
                await db.execute(
                    delete(Email).where(
                        Email.fetched_at < cutoff_date,
                        Email.is_backup_notification == False
                    )
                )
                await db.commit()

            logger.info(f"✅ Logs antérieurs au {cutoff_date.date()} nettoyés")

        except Exception as e:
            logger.error(f"❌ Erreur lors du nettoyage: {e}")

    async def _generate_ai_suggestions(self):
        """Génère des suggestions d'amélioration avec l'IA"""
        logger.info("🤖 Génération des suggestions IA...")
        # Implémentation simplifiée pour éviter les erreurs
        pass

    async def run_manual_analysis(self):
        """Lance une analyse manuelle"""
        await self._daily_email_analysis()
        await self._update_backup_statuses()


# Instance globale
scheduler_service = SchedulerService()
