"""
Modèle Alerte
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.sql import func
from app.core.database import Base


class Alert(Base):
    """Alertes générées par le système"""
    __tablename__ = "alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Type et niveau
    alert_type = Column(String(50), nullable=False)  # backup_failed, backup_missing, security, etc.
    severity = Column(String(20), nullable=False)  # info, warning, alert, critical
    
    # Références
    client_id = Column(Integer, ForeignKey("clients.id"))
    backup_id = Column(Integer, ForeignKey("backups.id"))
    
    # Contenu
    title = Column(String(255), nullable=False)
    message = Column(Text)
    details = Column(JSON)
    
    # État
    is_acknowledged = Column(Boolean, default=False)
    acknowledged_by = Column(Integer, ForeignKey("users.id"))
    acknowledged_at = Column(DateTime(timezone=True))
    
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(Integer, ForeignKey("users.id"))
    resolved_at = Column(DateTime(timezone=True))
    resolution_notes = Column(Text)
    
    # Notifications envoyées
    notifications_sent = Column(JSON, default=dict)  # {"email": True, "discord": True, etc.}
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
