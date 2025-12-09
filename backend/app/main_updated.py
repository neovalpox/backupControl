"""
BackupControl - Application de gestion des sauvegardes
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from loguru import logger
import sys

from app.core.config import settings
from app.core.database import engine, Base, AsyncSessionLocal
from app.api import auth, users, clients, backups, emails, settings as settings_router, dashboard, ai_suggestions
from app.api import emails_v2
from app.services.scheduler import scheduler_service
from app.models.user import User
from app.core.security import get_password_hash
from sqlalchemy import select

# Configuration des logs
logger.remove()
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level="INFO"
)
logger.add(
    "/app/logs/backupcontrol.log",
    rotation="10 MB",
    retention="30 days",
    compression="gz",
    level="DEBUG"
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gestion du cycle de vie de l'application"""
    logger.info("Demarrage de BackupControl...")

    # Creation des tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Creation de l'utilisateur admin par defaut s'il n'existe pas
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.username == "admin"))
        admin_user = result.scalar_one_or_none()

        if not admin_user:
            logger.info("Creation de l'utilisateur admin par defaut...")
            admin_user = User(
                username="admin",
                email="admin@backupcontrol.local",
                hashed_password=get_password_hash("admin123"),
                full_name="Administrateur",
                role="admin",
                is_active=True,
                language="fr",
                theme="dark"
            )
            session.add(admin_user)
            await session.commit()
            logger.info("Utilisateur admin cree (mot de passe: admin123)")

    # Demarrage du scheduler
    scheduler_service.start()
    logger.info("Scheduler demarre")

    yield

    # Arret propre
    scheduler_service.shutdown()
    logger.info("Arret de BackupControl")


app = FastAPI(
    title="BackupControl",
    description="API de gestion et suivi des sauvegardes",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan
)

# Configuration CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En production, limitez aux domaines autorises
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusion des routes API
app.include_router(auth.router, prefix="/api/auth", tags=["Authentification"])
app.include_router(users.router, prefix="/api/users", tags=["Utilisateurs"])
app.include_router(clients.router, prefix="/api/clients", tags=["Clients"])
app.include_router(backups.router, prefix="/api/backups", tags=["Sauvegardes"])
app.include_router(emails.router, prefix="/api/emails", tags=["E-mails"])
app.include_router(emails_v2.router, prefix="/api/emails", tags=["E-mails V2"])
app.include_router(settings_router.router, prefix="/api/settings", tags=["Parametres"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(ai_suggestions.router, prefix="/api/ai", tags=["IA"])


@app.get("/api/health")
async def health_check():
    """Verification de l'etat de l'API"""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "service": "BackupControl"
    }
