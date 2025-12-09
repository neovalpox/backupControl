"""
Routes de gestion des paramètres
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, Dict, Any

from app.core.database import get_db
from app.core.security import get_current_user, get_current_admin_user
from app.models.user import User
from app.models.settings import AppSettings

router = APIRouter()


class SettingUpdate(BaseModel):
    value: str
    description: Optional[str] = None


class SettingsGroup(BaseModel):
    email: Dict[str, Any] = {}
    ai: Dict[str, Any] = {}
    alerts: Dict[str, Any] = {}
    general: Dict[str, Any] = {}


@router.get("/")
async def get_all_settings(
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupère tous les paramètres"""
    result = await db.execute(select(AppSettings))
    settings_list = result.scalars().all()
    
    grouped = {"email": {}, "ai": {}, "alerts": {}, "general": {}}
    
    for setting in settings_list:
        category = setting.category or "general"
        if category not in grouped:
            grouped[category] = {}
        
        # Ne pas renvoyer les valeurs des secrets
        value = "********" if setting.is_secret else setting.value
        
        grouped[category][setting.key] = {
            "value": value,
            "type": setting.value_type,
            "description": setting.description,
            "is_secret": setting.is_secret
        }
    
    return grouped


@router.get("/{key}")
async def get_setting(
    key: str,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupère un paramètre spécifique"""
    result = await db.execute(
        select(AppSettings).where(AppSettings.key == key)
    )
    setting = result.scalar_one_or_none()
    
    if not setting:
        raise HTTPException(status_code=404, detail="Paramètre non trouvé")
    
    return {
        "key": setting.key,
        "value": "********" if setting.is_secret else setting.value,
        "type": setting.value_type,
        "description": setting.description,
        "category": setting.category,
        "is_secret": setting.is_secret
    }


@router.put("/{key}")
async def update_setting(
    key: str,
    data: SettingUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Met à jour un paramètre"""
    result = await db.execute(
        select(AppSettings).where(AppSettings.key == key)
    )
    setting = result.scalar_one_or_none()
    
    if not setting:
        # Créer le paramètre s'il n'existe pas
        setting = AppSettings(key=key)
        db.add(setting)
    
    setting.value = data.value
    if data.description:
        setting.description = data.description
    
    await db.commit()
    
    return {"message": f"Paramètre {key} mis à jour"}


@router.post("/batch")
async def update_settings_batch(
    settings: Dict[str, str],
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Met à jour plusieurs paramètres en une fois"""
    for key, value in settings.items():
        result = await db.execute(
            select(AppSettings).where(AppSettings.key == key)
        )
        setting = result.scalar_one_or_none()
        
        if not setting:
            setting = AppSettings(key=key)
            db.add(setting)
        
        setting.value = value
    
    await db.commit()
    
    return {"message": f"{len(settings)} paramètres mis à jour"}


@router.post("/initialize")
async def initialize_default_settings(
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Initialise les paramètres par défaut"""
    defaults = [
        # E-mail - Type et adresse
        {"key": "email_type", "value": "imap", "category": "email", "description": "Type de compte e-mail (imap, office365, gmail)"},
        {"key": "email_provider", "value": "imap", "category": "email", "description": "Type de compte e-mail (alias)"},
        {"key": "email_address", "value": "", "category": "email", "description": "Adresse e-mail a surveiller"},
        {"key": "email_folder", "value": "INBOX", "category": "email", "description": "Dossier a surveiller"},
        {"key": "email_check_hour", "value": "6", "category": "email", "value_type": "int", "description": "Heure d'analyse quotidienne"},
        
        # E-mail IMAP
        {"key": "imap_server", "value": "", "category": "email", "description": "Serveur IMAP"},
        {"key": "imap_port", "value": "993", "category": "email", "value_type": "int", "description": "Port IMAP"},
        {"key": "imap_use_ssl", "value": "true", "category": "email", "value_type": "bool", "description": "Utiliser SSL pour IMAP"},
        {"key": "email_host", "value": "", "category": "email", "description": "Serveur IMAP (alias)"},
        {"key": "email_port", "value": "993", "category": "email", "value_type": "int", "description": "Port IMAP (alias)"},
        {"key": "email_use_ssl", "value": "true", "category": "email", "value_type": "bool", "description": "Utiliser SSL (alias)"},
        {"key": "email_username", "value": "", "category": "email", "description": "Nom d'utilisateur IMAP"},
        {"key": "email_password", "value": "", "category": "email", "is_secret": True, "description": "Mot de passe e-mail"},
        
        # Office 365
        {"key": "office365_client_id", "value": "", "category": "email", "description": "Client ID Office 365"},
        {"key": "office365_client_secret", "value": "", "category": "email", "is_secret": True, "description": "Client Secret Office 365"},
        {"key": "office365_tenant_id", "value": "", "category": "email", "description": "Tenant ID Office 365"},
        
        # IA
        {"key": "ai_provider", "value": "claude", "category": "ai", "description": "Provider IA (claude, openai)"},
        {"key": "claude_api_key", "value": "", "category": "ai", "is_secret": True, "description": "Clé API Claude"},
        {"key": "openai_api_key", "value": "", "category": "ai", "is_secret": True, "description": "Clé API OpenAI"},
        
        # Alertes
        {"key": "alert_warning_hours", "value": "24", "category": "alerts", "value_type": "int", "description": "Seuil avertissement (heures)"},
        {"key": "alert_alert_hours", "value": "48", "category": "alerts", "value_type": "int", "description": "Seuil alerte (heures)"},
        {"key": "alert_critical_hours", "value": "72", "category": "alerts", "value_type": "int", "description": "Seuil critique (heures)"},
        
        # Notifications - Telegram
        {"key": "telegram_bot_token", "value": "", "category": "alerts", "is_secret": True, "description": "Token du bot Telegram"},
        {"key": "telegram_chat_id", "value": "", "category": "alerts", "description": "Chat ID Telegram"},
        
        # Notifications - Webhooks
        {"key": "discord_webhook_url", "value": "", "category": "alerts", "is_secret": True, "description": "Webhook Discord"},
        {"key": "slack_webhook_url", "value": "", "category": "alerts", "is_secret": True, "description": "Webhook Slack"},
        {"key": "teams_webhook_url", "value": "", "category": "alerts", "is_secret": True, "description": "Webhook Teams"},
        
        # Notifications - SMTP
        {"key": "smtp_server", "value": "", "category": "alerts", "description": "Serveur SMTP"},
        {"key": "smtp_port", "value": "587", "category": "alerts", "value_type": "int", "description": "Port SMTP"},
        {"key": "smtp_use_tls", "value": "true", "category": "alerts", "value_type": "bool", "description": "Utiliser TLS pour SMTP"},
        {"key": "smtp_username", "value": "", "category": "alerts", "description": "Nom d'utilisateur SMTP"},
        {"key": "smtp_password", "value": "", "category": "alerts", "is_secret": True, "description": "Mot de passe SMTP"},
        {"key": "alert_from_email", "value": "", "category": "alerts", "description": "E-mail expéditeur des alertes"},
        {"key": "alert_to_emails", "value": "", "category": "alerts", "description": "E-mails destinataires des alertes"},
        
        # Général
        {"key": "default_language", "value": "fr", "category": "general", "description": "Langue par défaut"},
        {"key": "default_theme", "value": "dark", "category": "general", "description": "Thème par défaut"},
        {"key": "log_retention_days", "value": "90", "category": "general", "value_type": "int", "description": "Durée de rétention des logs (jours)"},
    ]
    
    created = 0
    for default in defaults:
        result = await db.execute(
            select(AppSettings).where(AppSettings.key == default["key"])
        )
        if not result.scalar_one_or_none():
            setting = AppSettings(
                key=default["key"],
                value=default["value"],
                value_type=default.get("value_type", "string"),
                description=default.get("description"),
                category=default.get("category"),
                is_secret=default.get("is_secret", False)
            )
            db.add(setting)
            created += 1
    
    await db.commit()
    
    return {"message": f"{created} paramètres initialisés"}
