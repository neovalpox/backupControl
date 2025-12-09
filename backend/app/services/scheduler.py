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
        
        # Tâche quotidienne d'analyse des e-mails
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
        
        # Tâche de génération des suggestions IA (quotidienne)
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
        """Tâche quotidienne d'analyse des e-mails"""
        logger.info("🔄 Début de l'analyse quotidienne des e-mails...")
        
        try:
            from app.services.email_service import get_email_provider
            from app.services.ai_service import ai_analyzer
            from app.core.database import AsyncSessionLocal
            from app.models.email import Email
            from app.models.backup import Backup, BackupEvent
            from sqlalchemy import select
            
            # Récupération des e-mails
            provider = get_email_provider()
            await provider.connect()
            emails = await provider.fetch_emails(limit=100)  # Derniers 100 e-mails
            await provider.disconnect()
            
            logger.info(f"📧 {len(emails)} e-mails récupérés")
            
            # Analyse par IA
            async with AsyncSessionLocal() as db:
                for email_msg in emails:
                    # Vérifier si déjà traité
                    existing = await db.execute(
                        select(Email).where(Email.message_id == email_msg.message_id)
                    )
                    if existing.scalar_one_or_none():
                        continue
                    
                    # Analyse
                    analysis = await ai_analyzer.analyze_email(email_msg)
                    
                    # Sauvegarde en BDD
                    email_record = Email(
                        message_id=email_msg.message_id,
                        subject=email_msg.subject,
                        sender=email_msg.sender,
                        recipients=email_msg.recipients,
                        received_at=email_msg.received_at,
                        body_text=email_msg.body_text,
                        body_html=email_msg.body_html,
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
                    
                    # Si c'est une notification de sauvegarde, créer un événement
                    if analysis.get("is_backup_notification") and analysis.get("source_nas"):
                        await self._create_backup_event(db, email_record, analysis)
                
                await db.commit()
            
            logger.info("✅ Analyse quotidienne terminée")
            
        except Exception as e:
            logger.error(f"❌ Erreur lors de l'analyse quotidienne: {e}")
    
    async def _create_backup_event(self, db, email_record, analysis):
        """Crée un événement de sauvegarde à partir d'une analyse"""
        from app.models.backup import Backup, BackupEvent, BackupStatus
        from sqlalchemy import select
        
        # Recherche de la sauvegarde correspondante
        source_nas = analysis.get("source_nas")
        task_name = analysis.get("task_name")
        
        backup = None
        
        # Recherche par NAS source et nom de tâche
        if source_nas and task_name:
            result = await db.execute(
                select(Backup).where(
                    Backup.source_nas == source_nas,
                    Backup.name == task_name
                )
            )
            backup = result.scalar_one_or_none()
        
        # Si pas trouvé, recherche par NAS uniquement
        if not backup and source_nas:
            result = await db.execute(
                select(Backup).where(Backup.source_nas == source_nas)
            )
            backups = result.scalars().all()
            if len(backups) == 1:
                backup = backups[0]
        
        if not backup:
            logger.warning(f"Sauvegarde non trouvée pour NAS={source_nas}, tâche={task_name}")
            return
        
        # Création de l'événement
        event_type = analysis.get("status", "unknown")
        
        event = BackupEvent(
            backup_id=backup.id,
            email_id=email_record.id,
            event_type=event_type,
            event_date=email_record.received_at,
            start_time=analysis.get("start_time"),
            end_time=analysis.get("end_time"),
            duration_seconds=analysis.get("duration_seconds"),
            source_size_bytes=analysis.get("source_size_bytes"),
            transferred_size_bytes=analysis.get("transferred_size_bytes"),
            error_message=analysis.get("error_message"),
            parsed_data=analysis
        )
        db.add(event)
        
        # Mise à jour du statut de la sauvegarde
        if event_type == "success":
            backup.last_success_at = email_record.received_at
            backup.total_success_count += 1
            backup.current_status = BackupStatus.OK.value
        elif event_type == "failure":
            backup.last_failure_at = email_record.received_at
            backup.total_failure_count += 1
            backup.current_status = BackupStatus.FAILED.value
        
        backup.last_event_at = email_record.received_at
        
        logger.info(f"Événement créé pour {backup.name}: {event_type}")
    
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
                # Suppression des anciens e-mails (garder ceux liés à des événements)
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
        
        try:
            from app.core.database import AsyncSessionLocal
            from app.models.backup import Backup, BackupEvent
            from app.models.ai_suggestion import AISuggestion
            from app.services.ai_service import ai_analyzer
            from sqlalchemy import select, func
            from datetime import timedelta
            
            async with AsyncSessionLocal() as db:
                # Collecte des statistiques
                result = await db.execute(select(Backup))
                backups = result.scalars().all()
                
                stats = {
                    "total_backups": len(backups),
                    "backups_by_status": {},
                    "backups_by_type": {},
                    "failure_rate_by_backup": [],
                    "backups_without_recent_success": []
                }
                
                now = datetime.utcnow()
                
                for backup in backups:
                    # Par statut
                    status = backup.current_status
                    stats["backups_by_status"][status] = stats["backups_by_status"].get(status, 0) + 1
                    
                    # Par type
                    btype = backup.backup_type
                    stats["backups_by_type"][btype] = stats["backups_by_type"].get(btype, 0) + 1
                    
                    # Taux d'échec
                    total = backup.total_success_count + backup.total_failure_count
                    if total > 0:
                        failure_rate = backup.total_failure_count / total * 100
                        if failure_rate > 10:
                            stats["failure_rate_by_backup"].append({
                                "name": backup.name,
                                "source_nas": backup.source_nas,
                                "failure_rate": round(failure_rate, 1)
                            })
                    
                    # Sans succès récent
                    if backup.last_success_at:
                        days_since = (now - backup.last_success_at).days
                        if days_since > 7:
                            stats["backups_without_recent_success"].append({
                                "name": backup.name,
                                "source_nas": backup.source_nas,
                                "days_since_success": days_since
                            })
                
                # Génération des suggestions
                suggestions = await ai_analyzer.generate_suggestions(stats)
                
                # Sauvegarde des suggestions
                for suggestion in suggestions:
                    ai_suggestion = AISuggestion(
                        category=suggestion.get("category", "other"),
                        priority=suggestion.get("priority", "medium"),
                        title=suggestion.get("title", "Suggestion"),
                        description=suggestion.get("description", ""),
                        recommendation=suggestion.get("recommendation", ""),
                        analysis_data=stats
                    )
                    db.add(ai_suggestion)
                
                await db.commit()
            
            logger.info(f"✅ {len(suggestions)} suggestions générées")
            
        except Exception as e:
            logger.error(f"❌ Erreur lors de la génération des suggestions: {e}")
    
    async def run_manual_analysis(self):
        """Lance une analyse manuelle"""
        await self._daily_email_analysis()
        await self._update_backup_statuses()
        await self._generate_ai_suggestions()


# Instance globale
scheduler_service = SchedulerService()
