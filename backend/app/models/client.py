"""
Modèle Client
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Client(Base):
    __tablename__ = "clients"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Informations de base
    name = Column(String(255), nullable=False)
    short_name = Column(String(50), unique=True, index=True, nullable=False)
    description = Column(Text)
    
    # Contact
    contact_name = Column(String(255))
    contact_email = Column(String(255))
    contact_phone = Column(String(50))
    
    # Contrat / SLA
    contract_type = Column(String(100))  # ex: "Premium", "Standard", "Basic"
    sla_hours = Column(Integer, default=24)  # Temps de réponse attendu
    
    # Patterns pour identification dans les emails
    email_patterns = Column(JSON, default=list)  # Liste de patterns pour matcher ce client
    nas_identifiers = Column(JSON, default=list)  # Liste des identifiants NAS (ex: ["NABO03", "NABO04"])
    
    # Statut
    is_active = Column(Boolean, default=True)
    
    # Notes
    notes = Column(Text)
    
    # Configuration spécifique
    custom_alert_thresholds = Column(JSON)  # Seuils d'alerte personnalisés
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relations
    backups = relationship("Backup", back_populates="client", cascade="all, delete-orphan")
