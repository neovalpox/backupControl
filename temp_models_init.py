# Models module
from app.models.user import User
from app.models.client import Client
from app.models.backup import Backup, BackupEvent
from app.models.email import Email
from app.models.settings import AppSettings
from app.models.alert import Alert
from app.models.ai_suggestion import AISuggestion
from sqlalchemy import Column, Integer, String, JSON
from app.core.database import Base

class Setting(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(JSON, nullable=True)
