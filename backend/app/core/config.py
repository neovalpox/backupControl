"""
Configuration de l'application
"""
from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    """Paramètres de l'application"""
    
    # Base de données
    database_url: str = "postgresql://backupcontrol:changeme@db:5432/backupcontrol"
    
    # Sécurité
    secret_key: str = "change_this_secret_key_in_production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 heures
    
    # IA
    ai_provider: str = "claude"  # "claude" ou "openai"
    claude_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    
    # E-mail
    email_type: str = "imap"  # "imap", "office365", "gmail"
    imap_server: Optional[str] = None
    imap_port: int = 993
    imap_use_ssl: bool = True
    email_address: Optional[str] = None
    email_password: Optional[str] = None
    
    # Office 365
    office365_client_id: Optional[str] = None
    office365_client_secret: Optional[str] = None
    office365_tenant_id: Optional[str] = None
    
    # Gmail
    gmail_client_id: Optional[str] = None
    gmail_client_secret: Optional[str] = None
    
    # Planification
    email_check_hour: int = 6
    
    # Notifications
    discord_webhook_url: Optional[str] = None
    slack_webhook_url: Optional[str] = None
    teams_webhook_url: Optional[str] = None
    
    # SMTP pour alertes
    smtp_server: Optional[str] = None
    smtp_port: int = 587
    smtp_use_tls: bool = True
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    alert_from_email: Optional[str] = None
    alert_to_emails: Optional[str] = None
    
    # Application
    default_language: str = "fr"
    default_theme: str = "dark"
    log_retention_days: int = 90
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
