"""
Modèle Sauvegarde et Événements de sauvegarde
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Float, JSON, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class BackupType(str, enum.Enum):
    HYPER_BACKUP = "hyper_backup"
    ACTIVE_BACKUP = "active_backup"
    RSYNC = "rsync"
    VEEAM = "veeam"
    ACRONIS = "acronis"
    WINDOWS_BACKUP = "windows_backup"
    OTHER = "other"


class BackupStatus(str, enum.Enum):
    OK = "ok"              # Succès dans les dernières 24h
    WARNING = "warning"    # Pas de sauvegarde depuis 24-48h
    ALERT = "alert"        # Pas de sauvegarde depuis 48-72h
    CRITICAL = "critical"  # Pas de sauvegarde depuis +72h
    FAILED = "failed"      # Dernière sauvegarde en échec
    UNKNOWN = "unknown"    # Statut inconnu


class Backup(Base):
    """Définition d'une tâche de sauvegarde"""
    __tablename__ = "backups"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Référence client
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    
    # Informations de la sauvegarde
    name = Column(String(255), nullable=False)
    backup_type = Column(String(50), default=BackupType.OTHER.value)
    
    # Source
    source_nas = Column(String(100))  # Ex: NABO03
    source_device = Column(String(255))  # Pour Active Backup: nom du périphérique
    
    # Destination
    destination = Column(String(500))  # Ex: "NABO04.synology.me / Hyperbackup / NABO03_1.hbk"
    destination_nas = Column(String(100))  # Ex: NABO04
    
    # Planification attendue
    expected_schedule = Column(String(100))  # Ex: "daily", "weekly"
    expected_hour = Column(Integer)  # Heure attendue (0-23)
    
    # Statut actuel
    current_status = Column(String(20), default=BackupStatus.UNKNOWN.value)
    last_success_at = Column(DateTime(timezone=True))
    last_failure_at = Column(DateTime(timezone=True))
    last_event_at = Column(DateTime(timezone=True))
    
    # Statistiques
    total_success_count = Column(Integer, default=0)
    total_failure_count = Column(Integer, default=0)
    last_size_bytes = Column(Float)  # Taille transférée dernière sauvegarde
    last_duration_seconds = Column(Integer)  # Durée dernière sauvegarde
    
    # Pattern pour identification dans les emails
    email_patterns = Column(JSON, default=list)
    
    # État
    is_active = Column(Boolean, default=True)
    is_maintenance = Column(Boolean, default=False)  # Pause des alertes
    maintenance_until = Column(DateTime(timezone=True))
    maintenance_reason = Column(Text)
    
    # Notes
    notes = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relations
    client = relationship("Client", back_populates="backups")
    events = relationship("BackupEvent", back_populates="backup", cascade="all, delete-orphan")


class BackupEvent(Base):
    """Événement de sauvegarde (succès ou échec)"""
    __tablename__ = "backup_events"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Référence sauvegarde
    backup_id = Column(Integer, ForeignKey("backups.id"), nullable=False)
    email_id = Column(Integer, ForeignKey("emails.id"))
    
    # Informations de l'événement
    event_type = Column(String(20), nullable=False)  # "success", "failure", "warning"
    event_date = Column(DateTime(timezone=True), nullable=False)
    
    # Détails
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    duration_seconds = Column(Integer)
    
    # Tailles
    source_size_bytes = Column(Float)
    transferred_size_bytes = Column(Float)
    new_data_size_bytes = Column(Float)
    modified_data_size_bytes = Column(Float)
    deleted_data_size_bytes = Column(Float)
    
    # Message
    message = Column(Text)
    error_message = Column(Text)
    
    # Raw data
    raw_email_content = Column(Text)
    parsed_data = Column(JSON)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relations
    backup = relationship("Backup", back_populates="events")
    email = relationship("Email", back_populates="events")
