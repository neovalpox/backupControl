"""
Routes de gestion des e-mails
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime
import imaplib
import smtplib
from email.mime.text import MIMEText

from app.core.database import get_db
from app.core.security import get_current_user, get_current_tech_user
from app.models.user import User
from app.models.email import Email
from app.services.email_service import get_email_provider
from app.services.scheduler import scheduler_service
from app.services.settings_service import get_email_settings, get_notification_settings

router = APIRouter()


class EmailResponse(BaseModel):
    id: int
    message_id: str
    subject: str
    sender: str
    received_at: datetime
    is_backup_notification: bool
    detected_type: Optional[str]
    detected_status: Optional[str]
    detected_nas: Optional[str]
    ai_confidence: Optional[int]
    is_processed: bool
    
    class Config:
        from_attributes = True


class EmailDetailResponse(EmailResponse):
    body_text: Optional[str]
    ai_extracted_data: Optional[dict]


class EmailTestResult(BaseModel):
    success: bool
    message: str
    server: Optional[str] = None
    email: Optional[str] = None
    total_emails: Optional[int] = None


@router.get("/", response_model=List[EmailResponse])
async def list_emails(
    backup_only: bool = False,
    limit: int = 100,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Liste les e-mails analysés"""
    query = select(Email)
    
    if backup_only:
        query = query.where(Email.is_backup_notification == True)
    
    query = query.order_by(Email.received_at.desc()).offset(offset).limit(limit)
    
    result = await db.execute(query)
    emails = result.scalars().all()
    
    return [
        EmailResponse(
            id=e.id,
            message_id=e.message_id,
            subject=e.subject,
            sender=e.sender,
            received_at=e.received_at,
            is_backup_notification=e.is_backup_notification,
            detected_type=e.detected_type,
            detected_status=e.detected_status,
            detected_nas=e.detected_nas,
            ai_confidence=e.ai_confidence,
            is_processed=e.is_processed
        )
        for e in emails
    ]


@router.get("/{email_id}", response_model=EmailDetailResponse)
async def get_email(
    email_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupère le détail d'un e-mail"""
    result = await db.execute(
        select(Email).where(Email.id == email_id)
    )
    email = result.scalar_one_or_none()
    
    if not email:
        raise HTTPException(status_code=404, detail="E-mail non trouvé")
    
    return EmailDetailResponse(
        id=email.id,
        message_id=email.message_id,
        subject=email.subject,
        sender=email.sender,
        received_at=email.received_at,
        is_backup_notification=email.is_backup_notification,
        detected_type=email.detected_type,
        detected_status=email.detected_status,
        detected_nas=email.detected_nas,
        ai_confidence=email.ai_confidence,
        is_processed=email.is_processed,
        body_text=email.body_text,
        ai_extracted_data=email.ai_extracted_data
    )


@router.post("/test-connection", response_model=EmailTestResult)
async def test_email_connection(
    current_user: User = Depends(get_current_tech_user),
    db: AsyncSession = Depends(get_db)
):
    """Teste la connexion au serveur e-mail avec les settings de la base de données"""
    try:
        # Récupérer les settings depuis la base de données
        email_settings = await get_email_settings(db)
        
        email_type = email_settings.get("email_type", "imap")
        
        if email_type == "imap":
            # Test connexion IMAP
            server = email_settings.get("imap_server")
            port = email_settings.get("imap_port", 993)
            email_addr = email_settings.get("email_address")
            password = email_settings.get("email_password")
            use_ssl = email_settings.get("imap_use_ssl", True)
            
            if not all([server, email_addr, password]):
                return EmailTestResult(
                    success=False,
                    message="Configuration IMAP incomplète. Vérifiez le serveur, l'adresse email et le mot de passe."
                )
            
            try:
                if use_ssl:
                    connection = imaplib.IMAP4_SSL(server, port)
                else:
                    connection = imaplib.IMAP4(server, port)
                
                connection.login(email_addr, password)
                connection.select("INBOX")
                _, message_numbers = connection.search(None, "ALL")
                total_emails = len(message_numbers[0].split())
                connection.logout()
                
                return EmailTestResult(
                    success=True,
                    server=server,
                    email=email_addr,
                    total_emails=total_emails,
                    message=f"Connexion IMAP réussie! {total_emails} emails dans la boîte de réception."
                )
            except imaplib.IMAP4.error as e:
                return EmailTestResult(
                    success=False,
                    server=server,
                    email=email_addr,
                    message=f"Erreur d'authentification IMAP: {str(e)}"
                )
            except Exception as e:
                return EmailTestResult(
                    success=False,
                    server=server,
                    message=f"Erreur de connexion IMAP: {str(e)}"
                )
        
        elif email_type == "office365":
            # Test Office 365 avec MSAL
            client_id = email_settings.get("office365_client_id")
            client_secret = email_settings.get("office365_client_secret")
            tenant_id = email_settings.get("office365_tenant_id")
            email_addr = email_settings.get("email_address")
            
            if not all([client_id, client_secret, tenant_id]):
                return EmailTestResult(
                    success=False,
                    message="Configuration Office 365 incomplete. Verifiez Client ID, Client Secret et Tenant ID."
                )
            
            try:
                import msal
                import httpx
                
                # Obtenir un token via MSAL
                app = msal.ConfidentialClientApplication(
                    client_id,
                    authority=f"https://login.microsoftonline.com/{tenant_id}",
                    client_credential=client_secret
                )
                
                result = app.acquire_token_for_client(
                    scopes=["https://graph.microsoft.com/.default"]
                )
                
                if "access_token" not in result:
                    error_desc = result.get("error_description", "Erreur inconnue")
                    return EmailTestResult(
                        success=False,
                        message=f"Erreur d'authentification Office 365: {error_desc}"
                    )
                
                # Tester l'acces a la boite mail via Graph API
                if email_addr:
                    async with httpx.AsyncClient() as client:
                        headers = {"Authorization": f"Bearer {result['access_token']}"}
                        response = await client.get(
                            f"https://graph.microsoft.com/v1.0/users/{email_addr}/mailFolders/inbox/messages?$count=true&$top=1",
                            headers=headers
                        )
                        
                        if response.status_code == 200:
                            data = response.json()
                            count = data.get("@odata.count", len(data.get("value", [])))
                            return EmailTestResult(
                                success=True,
                                email=email_addr,
                                total_emails=count,
                                message=f"Connexion Office 365 reussie! Acces a la boite {email_addr} verifie."
                            )
                        elif response.status_code == 403:
                            return EmailTestResult(
                                success=False,
                                email=email_addr,
                                message="Acces refuse. Verifiez les permissions de l'application Azure AD (Mail.Read ou Mail.ReadBasic)."
                            )
                        else:
                            return EmailTestResult(
                                success=False,
                                email=email_addr,
                                message=f"Erreur Graph API: {response.status_code} - {response.text}"
                            )
                else:
                    return EmailTestResult(
                        success=True,
                        message="Authentification Office 365 reussie! Ajoutez une adresse email pour tester l'acces a la boite."
                    )
                    
            except ImportError:
                return EmailTestResult(
                    success=False,
                    message="Module MSAL non installe. Installez-le avec: pip install msal"
                )
            except Exception as e:
                return EmailTestResult(
                    success=False,
                    message=f"Erreur Office 365: {str(e)}"
                )
        
        else:
            return EmailTestResult(
                success=False,
                message=f"Type d'email non supporté: {email_type}"
            )
            
    except Exception as e:
        return EmailTestResult(
            success=False,
            message=f"Erreur lors du test: {str(e)}"
        )


@router.post("/fetch")
async def fetch_emails(
    limit: int = 100,
    current_user: User = Depends(get_current_tech_user)
):
    """Déclenche manuellement la récupération des e-mails"""
    try:
        provider = get_email_provider()
        await provider.connect()
        emails = await provider.fetch_emails(limit=limit)
        await provider.disconnect()
        
        return {
            "success": True,
            "fetched_count": len(emails),
            "message": f"{len(emails)} e-mails récupérés"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de la récupération: {str(e)}"
        )


@router.post("/analyze")
async def trigger_analysis(
    current_user: User = Depends(get_current_tech_user)
):
    """Déclenche manuellement l'analyse complète des e-mails"""
    try:
        await scheduler_service.run_manual_analysis()
        return {
            "success": True,
            "message": "Analyse lancée avec succès"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de l'analyse: {str(e)}"
        )


@router.get("/stats/summary")
async def get_email_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Statistiques sur les e-mails analysés"""
    from sqlalchemy import func
    
    # Total e-mails
    result = await db.execute(select(func.count(Email.id)))
    total = result.scalar()
    
    # E-mails de backup
    result = await db.execute(
        select(func.count(Email.id)).where(Email.is_backup_notification == True)
    )
    backup_count = result.scalar()
    
    # Par statut détecté
    result = await db.execute(
        select(Email.detected_status, func.count(Email.id))
        .where(Email.is_backup_notification == True)
        .group_by(Email.detected_status)
    )
    by_status = {row[0] or "unknown": row[1] for row in result.all()}
    
    # Par type de sauvegarde
    result = await db.execute(
        select(Email.detected_type, func.count(Email.id))
        .where(Email.is_backup_notification == True)
        .group_by(Email.detected_type)
    )
    by_type = {row[0] or "unknown": row[1] for row in result.all()}
    
    return {
        "total_emails": total,
        "backup_notifications": backup_count,
        "other_emails": total - backup_count,
        "by_status": by_status,
        "by_type": by_type
    }


# ============================================
# Endpoints de test des notifications
# ============================================

class NotificationTestResult(BaseModel):
    success: bool
    message: str
    channel: str


@router.post("/test-smtp", response_model=NotificationTestResult)
async def test_smtp_connection(
    current_user: User = Depends(get_current_tech_user),
    db: AsyncSession = Depends(get_db)
):
    """Teste la connexion SMTP pour l'envoi d'alertes"""
    try:
        notif_settings = await get_notification_settings(db)
        
        server = notif_settings.get("smtp_server")
        port = notif_settings.get("smtp_port", 587)
        username = notif_settings.get("smtp_username")
        password = notif_settings.get("smtp_password")
        use_tls = notif_settings.get("smtp_use_tls", True)
        from_email = notif_settings.get("alert_from_email")
        to_emails = notif_settings.get("alert_to_emails")
        
        if not all([server, username, password, from_email, to_emails]):
            return NotificationTestResult(
                success=False,
                channel="smtp",
                message="Configuration SMTP incomplète. Vérifiez tous les champs requis."
            )
        
        try:
            # Connexion au serveur SMTP
            if use_tls:
                smtp = smtplib.SMTP(server, port)
                smtp.starttls()
            else:
                smtp = smtplib.SMTP(server, port)
            
            smtp.login(username, password)
            
            # Envoyer un email de test
            msg = MIMEText("Ceci est un email de test envoyé depuis BackupControl. Si vous recevez ce message, la configuration SMTP est correcte!")
            msg["Subject"] = "[BackupControl] Test de configuration SMTP"
            msg["From"] = from_email
            msg["To"] = to_emails.split(",")[0].strip()
            
            smtp.sendmail(from_email, [to_emails.split(",")[0].strip()], msg.as_string())
            smtp.quit()
            
            return NotificationTestResult(
                success=True,
                channel="smtp",
                message=f"Email de test envoyé avec succès à {to_emails.split(',')[0].strip()}"
            )
            
        except smtplib.SMTPAuthenticationError as e:
            return NotificationTestResult(
                success=False,
                channel="smtp",
                message=f"Erreur d'authentification SMTP: {str(e)}"
            )
        except Exception as e:
            return NotificationTestResult(
                success=False,
                channel="smtp",
                message=f"Erreur SMTP: {str(e)}"
            )
            
    except Exception as e:
        return NotificationTestResult(
            success=False,
            channel="smtp",
            message=f"Erreur: {str(e)}"
        )


@router.post("/test-telegram", response_model=NotificationTestResult)
async def test_telegram(
    current_user: User = Depends(get_current_tech_user),
    db: AsyncSession = Depends(get_db)
):
    """Teste l'envoi de message Telegram"""
    import httpx
    
    try:
        notif_settings = await get_notification_settings(db)
        
        bot_token = notif_settings.get("telegram_bot_token")
        chat_id = notif_settings.get("telegram_chat_id")
        
        if not all([bot_token, chat_id]):
            return NotificationTestResult(
                success=False,
                channel="telegram",
                message="Configuration Telegram incomplète. Vérifiez le Bot Token et le Chat ID."
            )
        
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": "🔔 Test de notification BackupControl\n\nSi vous recevez ce message, la configuration Telegram est correcte!",
            "parse_mode": "HTML"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload)
            
            if response.status_code == 200:
                return NotificationTestResult(
                    success=True,
                    channel="telegram",
                    message="Message Telegram envoyé avec succès!"
                )
            else:
                error = response.json().get("description", "Erreur inconnue")
                return NotificationTestResult(
                    success=False,
                    channel="telegram",
                    message=f"Erreur Telegram: {error}"
                )
                
    except Exception as e:
        return NotificationTestResult(
            success=False,
            channel="telegram",
            message=f"Erreur: {str(e)}"
        )


@router.post("/test-discord", response_model=NotificationTestResult)
async def test_discord(
    current_user: User = Depends(get_current_tech_user),
    db: AsyncSession = Depends(get_db)
):
    """Teste l'envoi de message Discord"""
    import httpx
    
    try:
        notif_settings = await get_notification_settings(db)
        
        webhook_url = notif_settings.get("discord_webhook_url")
        
        if not webhook_url:
            return NotificationTestResult(
                success=False,
                channel="discord",
                message="Configuration Discord incomplète. Vérifiez l'URL du webhook."
            )
        
        payload = {
            "content": "🔔 **Test de notification BackupControl**\n\nSi vous recevez ce message, la configuration Discord est correcte!"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(webhook_url, json=payload)
            
            if response.status_code in [200, 204]:
                return NotificationTestResult(
                    success=True,
                    channel="discord",
                    message="Message Discord envoyé avec succès!"
                )
            else:
                return NotificationTestResult(
                    success=False,
                    channel="discord",
                    message=f"Erreur Discord: Code {response.status_code}"
                )
                
    except Exception as e:
        return NotificationTestResult(
            success=False,
            channel="discord",
            message=f"Erreur: {str(e)}"
        )


@router.post("/test-slack", response_model=NotificationTestResult)
async def test_slack(
    current_user: User = Depends(get_current_tech_user),
    db: AsyncSession = Depends(get_db)
):
    """Teste l'envoi de message Slack"""
    import httpx
    
    try:
        notif_settings = await get_notification_settings(db)
        
        webhook_url = notif_settings.get("slack_webhook_url")
        
        if not webhook_url:
            return NotificationTestResult(
                success=False,
                channel="slack",
                message="Configuration Slack incomplète. Vérifiez l'URL du webhook."
            )
        
        payload = {
            "text": "🔔 *Test de notification BackupControl*\n\nSi vous recevez ce message, la configuration Slack est correcte!"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(webhook_url, json=payload)
            
            if response.status_code == 200:
                return NotificationTestResult(
                    success=True,
                    channel="slack",
                    message="Message Slack envoyé avec succès!"
                )
            else:
                return NotificationTestResult(
                    success=False,
                    channel="slack",
                    message=f"Erreur Slack: {response.text}"
                )
                
    except Exception as e:
        return NotificationTestResult(
            success=False,
            channel="slack",
            message=f"Erreur: {str(e)}"
        )


@router.post("/test-teams", response_model=NotificationTestResult)
async def test_teams(
    current_user: User = Depends(get_current_tech_user),
    db: AsyncSession = Depends(get_db)
):
    """Teste l'envoi de message Microsoft Teams"""
    import httpx
    
    try:
        notif_settings = await get_notification_settings(db)
        
        webhook_url = notif_settings.get("teams_webhook_url")
        
        if not webhook_url:
            return NotificationTestResult(
                success=False,
                channel="teams",
                message="Configuration Teams incomplète. Vérifiez l'URL du webhook."
            )
        
        payload = {
            "@type": "MessageCard",
            "@context": "http://schema.org/extensions",
            "summary": "Test BackupControl",
            "themeColor": "0076D7",
            "title": "🔔 Test de notification BackupControl",
            "text": "Si vous recevez ce message, la configuration Microsoft Teams est correcte!"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(webhook_url, json=payload)
            
            if response.status_code == 200:
                return NotificationTestResult(
                    success=True,
                    channel="teams",
                    message="Message Teams envoyé avec succès!"
                )
            else:
                return NotificationTestResult(
                    success=False,
                    channel="teams",
                    message=f"Erreur Teams: {response.text}"
                )
                
    except Exception as e:
        return NotificationTestResult(
            success=False,
            channel="teams",
            message=f"Erreur: {str(e)}"
        )
