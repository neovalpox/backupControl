"""
Service pour récupérer les settings depuis la base de données
"""
from typing import Optional, Dict, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.models.settings import AppSettings


async def get_setting(db: AsyncSession, key: str) -> Optional[str]:
    """Récupère un setting depuis la base de données"""
    result = await db.execute(
        select(AppSettings).where(AppSettings.key == key)
    )
    setting = result.scalar_one_or_none()
    return setting.value if setting else None


async def get_settings_by_category(db: AsyncSession, category: str) -> Dict[str, str]:
    """Récupère tous les settings d'une catégorie"""
    result = await db.execute(
        select(AppSettings).where(AppSettings.category == category)
    )
    settings = result.scalars().all()
    return {s.key: s.value for s in settings}


async def get_all_settings(db: AsyncSession) -> Dict[str, str]:
    """Récupère tous les settings"""
    result = await db.execute(select(AppSettings))
    settings = result.scalars().all()
    return {s.key: s.value for s in settings}


async def get_email_settings(db: AsyncSession) -> Dict[str, Any]:
    """Récupère les settings email pour la connexion"""
    settings = await get_settings_by_category(db, "email")
    
    # Supporter les deux noms de clés (email_type et email_provider)
    email_type = settings.get("email_type") or settings.get("email_provider", "imap")
    
    # Convertir les types
    return {
        "email_type": email_type,
        "imap_server": settings.get("imap_server") or settings.get("email_host"),
        "imap_port": int(settings.get("imap_port") or settings.get("email_port", "993")),
        "imap_use_ssl": (settings.get("imap_use_ssl") or settings.get("email_use_ssl", "true")).lower() == "true",
        "email_address": settings.get("email_address") or settings.get("email_username"),
        "email_password": settings.get("email_password"),
        # Office 365
        "office365_client_id": settings.get("office365_client_id"),
        "office365_client_secret": settings.get("office365_client_secret"),
        "office365_tenant_id": settings.get("office365_tenant_id"),
        # Gmail
        "gmail_client_id": settings.get("gmail_client_id"),
        "gmail_client_secret": settings.get("gmail_client_secret"),
    }


async def get_ai_settings(db: AsyncSession) -> Dict[str, Any]:
    """Récupère les settings AI"""
    settings = await get_settings_by_category(db, "ai")
    
    return {
        "ai_provider": settings.get("ai_provider", "claude"),
        "claude_api_key": settings.get("claude_api_key"),
        "openai_api_key": settings.get("openai_api_key"),
    }


async def get_notification_settings(db: AsyncSession) -> Dict[str, Any]:
    """Récupère les settings de notification"""
    settings = await get_settings_by_category(db, "alerts")
    
    return {
        "telegram_bot_token": settings.get("telegram_bot_token"),
        "telegram_chat_id": settings.get("telegram_chat_id"),
        "discord_webhook_url": settings.get("discord_webhook_url"),
        "slack_webhook_url": settings.get("slack_webhook_url"),
        "teams_webhook_url": settings.get("teams_webhook_url"),
        "smtp_server": settings.get("smtp_server"),
        "smtp_port": int(settings.get("smtp_port", "587")),
        "smtp_use_tls": settings.get("smtp_use_tls", "true").lower() == "true",
        "smtp_username": settings.get("smtp_username"),
        "smtp_password": settings.get("smtp_password"),
        "alert_from_email": settings.get("alert_from_email"),
        "alert_to_emails": settings.get("alert_to_emails"),
    }
