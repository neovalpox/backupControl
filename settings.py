from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Any, Optional, Dict
from pydantic import BaseModel
import os

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.settings import AppSettings

router = APIRouter()

class SettingUpdate(BaseModel):
    value: Any

class SettingResponse(BaseModel):
    key: str
    value: Any

    class Config:
        from_attributes = True

# Mapping des clés frontend vers catégories DB
KEY_CATEGORY_MAP = {
    "ai_provider": "ai",
    "claude_api_key": "ai",
    "claude_model": "ai",
    "openai_api_key": "ai",
    "openai_model": "ai",
    "email_type": "email",
    "email_provider": "email",
    "imap_server": "email",
    "imap_port": "email",
    "imap_use_ssl": "email",
    "email_address": "email",
    "email_password": "email",
    "email_host": "email",
    "email_port": "email",
    "email_username": "email",
    "office365_client_id": "email",
    "office365_client_secret": "email",
    "office365_tenant_id": "email",
    "gmail_client_id": "email",
    "gmail_client_secret": "email",
    "telegram_bot_token": "alerts",
    "telegram_chat_id": "alerts",
    "discord_webhook_url": "alerts",
    "slack_webhook_url": "alerts",
    "teams_webhook_url": "alerts",
    "smtp_server": "alerts",
    "smtp_port": "alerts",
    "smtp_use_tls": "alerts",
    "smtp_username": "alerts",
    "smtp_password": "alerts",
    "alert_from_email": "alerts",
    "alert_to_emails": "alerts",
}

# Clés qui sont des secrets (masquées dans l'UI)
SECRET_KEYS = {
    "claude_api_key", "openai_api_key", "email_password",
    "office365_client_secret", "gmail_client_secret",
    "telegram_bot_token", "smtp_password"
}


async def get_setting_from_db(db: AsyncSession, key: str) -> Optional[str]:
    """Récupère un setting depuis la BDD"""
    result = await db.execute(
        select(AppSettings).where(AppSettings.key == key)
    )
    setting = result.scalar_one_or_none()
    return setting.value if setting else None


async def set_setting_in_db(db: AsyncSession, key: str, value: Any) -> AppSettings:
    """Crée ou met à jour un setting dans la BDD"""
    result = await db.execute(
        select(AppSettings).where(AppSettings.key == key)
    )
    setting = result.scalar_one_or_none()
    
    str_value = str(value) if value is not None else ""
    category = KEY_CATEGORY_MAP.get(key, "general")
    is_secret = key in SECRET_KEYS
    
    if setting:
        setting.value = str_value
        setting.category = category
        setting.is_secret = is_secret
    else:
        setting = AppSettings(
            key=key,
            value=str_value,
            category=category,
            is_secret=is_secret,
            value_type="string"
        )
        db.add(setting)
    
    await db.commit()
    await db.refresh(setting)
    return setting


@router.get("")
async def get_all_settings(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get all settings from database, organized by category"""
    result = await db.execute(select(AppSettings))
    settings = result.scalars().all()
    
    # Organiser par catégorie avec structure {category: {key: {value: ...}}}
    settings_by_category = {
        "email": {},
        "ai": {},
        "alerts": {},
        "general": {}
    }
    
    for s in settings:
        category = s.category or "general"
        if category not in settings_by_category:
            settings_by_category[category] = {}
        
        # Masquer les secrets (afficher seulement ******** si valeur existe)
        value = s.value
        if s.is_secret and value:
            # On envoie quand même la vraie valeur pour que le formulaire fonctionne
            # Le masquage sera fait côté frontend
            pass
        
        settings_by_category[category][s.key] = {
            "value": value,
            "is_secret": s.is_secret
        }
    
    return settings_by_category


# IMPORTANT: Routes spécifiques AVANT les routes dynamiques /{key}
@router.post("/batch")
async def update_settings_batch(
    settings: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update multiple settings at once"""
    updated_keys = []
    
    for key, value in settings.items():
        # Ne pas sauvegarder les valeurs None ou vides pour les secrets
        # sauf si explicitement défini
        if value is not None:
            await set_setting_in_db(db, key, value)
            updated_keys.append(key)
    
    return {"success": True, "updated": updated_keys}


@router.post("/initialize")
async def initialize_settings(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Initialize settings with defaults"""
    # Les valeurs par défaut
    defaults = {
        "ai_provider": "claude",
        "claude_model": "claude-sonnet-4-20250514",
        "openai_model": "gpt-4o",
    }
    
    for key, value in defaults.items():
        existing = await get_setting_from_db(db, key)
        if existing is None:
            await set_setting_in_db(db, key, value)
    
    return {"success": True, "message": "Settings initialized"}


@router.post("/notifications/test")
async def test_notification(
    channel: str,
    webhook_url: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Test notification channel"""
    import aiohttp

    url = webhook_url
    if not url:
        # Récupérer depuis la DB
        if channel == "discord":
            url = await get_setting_from_db(db, "discord_webhook_url")
        elif channel == "teams":
            url = await get_setting_from_db(db, "teams_webhook_url")
        elif channel == "slack":
            url = await get_setting_from_db(db, "slack_webhook_url")

    if not url:
        raise HTTPException(status_code=400, detail=f"No webhook URL configured for {channel}")

    try:
        async with aiohttp.ClientSession() as session:
            if channel == "discord":
                payload = {"content": "🔔 Test notification from BackupControl"}
            elif channel == "teams":
                payload = {"text": "🔔 Test notification from BackupControl"}
            elif channel == "slack":
                payload = {"text": "🔔 Test notification from BackupControl"}
            else:
                payload = {"text": "🔔 Test notification from BackupControl"}

            async with session.post(url, json=payload) as response:
                if response.status in [200, 204]:
                    return {"success": True, "message": f"Test notification sent to {channel}"}
                else:
                    return {"success": False, "message": f"Failed with status {response.status}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send notification: {str(e)}")


# Routes dynamiques APRÈS les routes spécifiques
@router.get("/{key}")
async def get_setting(
    key: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get a specific setting by key"""
    value = await get_setting_from_db(db, key)
    if value is not None:
        return {"key": key, "value": value}
    raise HTTPException(status_code=404, detail=f"Setting '{key}' not found")


@router.put("/{key}")
async def update_setting(
    key: str,
    setting: SettingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update a setting"""
    await set_setting_in_db(db, key, setting.value)
    return {"key": key, "value": setting.value}
