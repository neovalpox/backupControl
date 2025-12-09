"""
Modèle Suggestions IA
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON
from sqlalchemy.sql import func
from app.core.database import Base


class AISuggestion(Base):
    """Suggestions d'amélioration générées par l'IA"""
    __tablename__ = "ai_suggestions"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Type de suggestion
    category = Column(String(50), nullable=False)  # optimization, security, reliability, config
    priority = Column(String(20), default="medium")  # low, medium, high, critical
    
    # Contenu
    title = Column(String(255), nullable=False)
    description = Column(Text)
    recommendation = Column(Text)
    
    # Contexte
    affected_clients = Column(JSON, default=list)  # Liste des IDs clients concernés
    affected_backups = Column(JSON, default=list)  # Liste des IDs sauvegardes concernées
    analysis_data = Column(JSON)  # Données brutes de l'analyse
    
    # État
    is_dismissed = Column(Boolean, default=False)
    dismissed_by = Column(Integer)
    dismissed_at = Column(DateTime(timezone=True))
    dismiss_reason = Column(Text)
    
    is_implemented = Column(Boolean, default=False)
    implemented_by = Column(Integer)
    implemented_at = Column(DateTime(timezone=True))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True))  # Suggestion temporairement pertinente
