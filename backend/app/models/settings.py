"""
Modèle Paramètres de l'application
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON
from sqlalchemy.sql import func
from app.core.database import Base


class AppSettings(Base):
    """Paramètres de l'application (stockés en BDD)"""
    __tablename__ = "app_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, index=True, nullable=False)
    value = Column(Text)
    value_type = Column(String(20), default="string")  # string, int, bool, json
    description = Column(Text)
    category = Column(String(50))  # email, ai, alerts, general
    is_secret = Column(Boolean, default=False)  # Pour masquer dans l'UI
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
