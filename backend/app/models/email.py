"""
Modèle E-mail
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Email(Base):
    """E-mail analysé"""
    __tablename__ = "emails"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Identifiants e-mail
    message_id = Column(String(500), unique=True, index=True)
    thread_id = Column(String(500))
    
    # Métadonnées
    subject = Column(String(500))
    sender = Column(String(255))
    recipients = Column(JSON)
    received_at = Column(DateTime(timezone=True))
    
    # Contenu
    body_text = Column(Text)
    body_html = Column(Text)
    
    # Analyse
    is_backup_notification = Column(Boolean, default=False)
    detected_type = Column(String(50))  # Type de sauvegarde détecté
    detected_status = Column(String(20))  # "success", "failure", "warning", "info"
    detected_nas = Column(String(100))  # NAS source détecté
    detected_client_id = Column(Integer)  # Client associé
    
    # Données extraites par l'IA
    ai_extracted_data = Column(JSON)
    ai_confidence = Column(Integer)  # Score de confiance 0-100
    
    # État de traitement
    is_processed = Column(Boolean, default=False)
    processing_error = Column(Text)
    
    # Timestamps
    fetched_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True))
    
    # Relations
    events = relationship("BackupEvent", back_populates="email")
