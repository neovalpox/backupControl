"""
Routes pour les notifications
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.core.security import get_current_user, get_current_tech_user
from app.models.user import User
from app.services.notification_service import notification_service
from app.core.config import settings

router = APIRouter()


class TestNotificationRequest(BaseModel):
    channel: str  # discord, teams, slack
    webhook_url: Optional[str] = None  # Si fourni, utilise cette URL au lieu de la config


class NotificationSettingsResponse(BaseModel):
    discord_configured: bool
    teams_configured: bool
    slack_configured: bool
    smtp_configured: bool


@router.get("/settings", response_model=NotificationSettingsResponse)
async def get_notification_settings(
    current_user: User = Depends(get_current_user)
):
    """Retourne le statut de configuration des notifications"""
    return NotificationSettingsResponse(
        discord_configured=bool(settings.discord_webhook_url),
        teams_configured=bool(settings.teams_webhook_url),
        slack_configured=bool(settings.slack_webhook_url),
        smtp_configured=bool(settings.smtp_server and settings.smtp_username)
    )


@router.post("/test")
async def test_notification(
    request: TestNotificationRequest,
    current_user: User = Depends(get_current_tech_user)
):
    """Envoie une notification de test"""
    title = "Test BackupControl"
    message = "Ceci est un message de test pour verifier la configuration des notifications."
    
    fields = [
        {"name": "Utilisateur", "value": current_user.username, "inline": True},
        {"name": "Type", "value": "Test", "inline": True}
    ]
    
    webhook_url = request.webhook_url
    success = False
    
    if request.channel == "discord":
        webhook_url = webhook_url or settings.discord_webhook_url
        if not webhook_url:
            raise HTTPException(status_code=400, detail="Aucune URL Discord configuree")
        success = await notification_service.send_discord(webhook_url, title, message, color=0x5865f2, fields=fields)
    
    elif request.channel == "teams":
        webhook_url = webhook_url or settings.teams_webhook_url
        if not webhook_url:
            raise HTTPException(status_code=400, detail="Aucune URL Teams configuree")
        facts = [{"name": f["name"], "value": f["value"]} for f in fields]
        success = await notification_service.send_teams(webhook_url, title, message, color="5865f2", facts=facts)
    
    elif request.channel == "slack":
        webhook_url = webhook_url or settings.slack_webhook_url
        if not webhook_url:
            raise HTTPException(status_code=400, detail="Aucune URL Slack configuree")
        success = await notification_service.send_slack(webhook_url, title, message, color="good", fields=fields)
    
    else:
        raise HTTPException(status_code=400, detail="Canal non supporte. Utilisez: discord, teams, slack")
    
    if success:
        return {"message": f"Notification {request.channel} envoyee avec succes"}
    else:
        raise HTTPException(status_code=500, detail=f"Echec de l'envoi de la notification {request.channel}")


@router.post("/report")
async def send_daily_report(
    current_user: User = Depends(get_current_tech_user)
):
    """Force l'envoi du rapport quotidien"""
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy import select, func
    from app.core.database import get_db
    from app.models.backup import Backup
    
    # On va simuler les stats - en production, ca viendrait de la DB
    # Pour le test, on envoie un rapport avec des valeurs fixes
    success = await notification_service.notify_daily_report(
        total_backups=107,
        success=67,
        failed=35,
        success_rate=62.6
    )
    
    if success:
        return {"message": "Rapport quotidien envoye"}
    else:
        return {"message": "Aucun canal de notification configure ou echec de l'envoi"}