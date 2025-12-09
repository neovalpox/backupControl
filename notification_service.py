"""
Service de notifications (Discord, Teams, Slack, Email)
"""
import httpx
import logging
from typing import Optional, List
from datetime import datetime

from app.core.config import settings

logger = logging.getLogger(__name__)


class NotificationService:
    """Service pour envoyer des notifications multi-canaux"""
    
    @staticmethod
    async def send_discord(webhook_url: str, title: str, message: str, color: int = 0x00ff00, fields: List[dict] = None):
        """Envoie une notification Discord"""
        if not webhook_url:
            return False
        
        embed = {
            "title": title,
            "description": message,
            "color": color,
            "timestamp": datetime.utcnow().isoformat(),
            "footer": {"text": "BackupControl"}
        }
        
        if fields:
            embed["fields"] = fields
        
        payload = {"embeds": [embed]}
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(webhook_url, json=payload)
                response.raise_for_status()
                logger.info(f"Discord notification sent: {title}")
                return True
        except Exception as e:
            logger.error(f"Failed to send Discord notification: {e}")
            return False
    
    @staticmethod
    async def send_teams(webhook_url: str, title: str, message: str, color: str = "00ff00", facts: List[dict] = None):
        """Envoie une notification Microsoft Teams"""
        if not webhook_url:
            return False
        
        payload = {
            "@type": "MessageCard",
            "@context": "http://schema.org/extensions",
            "themeColor": color,
            "summary": title,
            "sections": [{
                "activityTitle": title,
                "activitySubtitle": "BackupControl",
                "facts": facts or [],
                "text": message,
                "markdown": True
            }]
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(webhook_url, json=payload)
                response.raise_for_status()
                logger.info(f"Teams notification sent: {title}")
                return True
        except Exception as e:
            logger.error(f"Failed to send Teams notification: {e}")
            return False
    
    @staticmethod
    async def send_slack(webhook_url: str, title: str, message: str, color: str = "good", fields: List[dict] = None):
        """Envoie une notification Slack"""
        if not webhook_url:
            return False
        
        attachment = {
            "color": color,
            "title": title,
            "text": message,
            "footer": "BackupControl",
            "ts": int(datetime.utcnow().timestamp())
        }
        
        if fields:
            attachment["fields"] = [{"title": f["name"], "value": f["value"], "short": True} for f in fields]
        
        payload = {"attachments": [attachment]}
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(webhook_url, json=payload)
                response.raise_for_status()
                logger.info(f"Slack notification sent: {title}")
                return True
        except Exception as e:
            logger.error(f"Failed to send Slack notification: {e}")
            return False
    
    @classmethod
    async def notify_backup_failure(cls, client_name: str, backup_name: str, error_message: str = None):
        """Notifie un echec de sauvegarde sur tous les canaux configures"""
        title = f"Echec de sauvegarde - {client_name}"
        message = f"La sauvegarde **{backup_name}** a echoue."
        if error_message:
            message += f"\n\nErreur: {error_message}"
        
        fields = [
            {"name": "Client", "value": client_name, "inline": True},
            {"name": "Sauvegarde", "value": backup_name, "inline": True},
            {"name": "Date", "value": datetime.now().strftime("%d/%m/%Y %H:%M"), "inline": True}
        ]
        
        results = []
        
        # Discord
        if hasattr(settings, 'DISCORD_WEBHOOK_URL') and settings.DISCORD_WEBHOOK_URL:
            results.append(await cls.send_discord(
                settings.DISCORD_WEBHOOK_URL, title, message, color=0xff0000, fields=fields
            ))
        
        # Teams
        if hasattr(settings, 'TEAMS_WEBHOOK_URL') and settings.TEAMS_WEBHOOK_URL:
            facts = [{"name": f["name"], "value": f["value"]} for f in fields]
            results.append(await cls.send_teams(
                settings.TEAMS_WEBHOOK_URL, title, message, color="ff0000", facts=facts
            ))
        
        # Slack
        if hasattr(settings, 'SLACK_WEBHOOK_URL') and settings.SLACK_WEBHOOK_URL:
            results.append(await cls.send_slack(
                settings.SLACK_WEBHOOK_URL, title, message, color="danger", fields=fields
            ))
        
        return any(results)
    
    @classmethod
    async def notify_backup_success(cls, client_name: str, backup_name: str, duration_seconds: int = None, size_bytes: int = None):
        """Notifie un succes de sauvegarde (optionnel, desactive par defaut)"""
        title = f"Sauvegarde reussie - {client_name}"
        message = f"La sauvegarde **{backup_name}** s'est terminee avec succes."
        
        fields = [
            {"name": "Client", "value": client_name, "inline": True},
            {"name": "Sauvegarde", "value": backup_name, "inline": True}
        ]
        
        if duration_seconds:
            minutes = duration_seconds // 60
            fields.append({"name": "Duree", "value": f"{minutes} min", "inline": True})
        
        if size_bytes:
            size_mb = size_bytes / (1024 * 1024)
            fields.append({"name": "Taille", "value": f"{size_mb:.1f} MB", "inline": True})
        
        # Par defaut, on n'envoie pas les succes (trop de spam)
        # Decommenter si besoin
        # await cls.send_discord(settings.DISCORD_WEBHOOK_URL, title, message, color=0x00ff00, fields=fields)
        
        return True
    
    @classmethod
    async def notify_daily_report(cls, total_backups: int, success: int, failed: int, success_rate: float):
        """Envoie le rapport quotidien"""
        title = "Rapport quotidien BackupControl"
        
        if failed > 0:
            color_discord = 0xff9900
            color_teams = "ff9900"
            color_slack = "warning"
        else:
            color_discord = 0x00ff00
            color_teams = "00ff00"
            color_slack = "good"
        
        message = f"Resume des sauvegardes du {datetime.now().strftime('%d/%m/%Y')}"
        
        fields = [
            {"name": "Total", "value": str(total_backups), "inline": True},
            {"name": "Succes", "value": str(success), "inline": True},
            {"name": "Echecs", "value": str(failed), "inline": True},
            {"name": "Taux de reussite", "value": f"{success_rate:.1f}%", "inline": True}
        ]
        
        results = []
        
        if hasattr(settings, 'DISCORD_WEBHOOK_URL') and settings.DISCORD_WEBHOOK_URL:
            results.append(await cls.send_discord(
                settings.DISCORD_WEBHOOK_URL, title, message, color=color_discord, fields=fields
            ))
        
        if hasattr(settings, 'TEAMS_WEBHOOK_URL') and settings.TEAMS_WEBHOOK_URL:
            facts = [{"name": f["name"], "value": f["value"]} for f in fields]
            results.append(await cls.send_teams(
                settings.TEAMS_WEBHOOK_URL, title, message, color=color_teams, facts=facts
            ))
        
        if hasattr(settings, 'SLACK_WEBHOOK_URL') and settings.SLACK_WEBHOOK_URL:
            results.append(await cls.send_slack(
                settings.SLACK_WEBHOOK_URL, title, message, color=color_slack, fields=fields
            ))
        
        return any(results)


notification_service = NotificationService()