from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.db.session import engine
from app.db.base import Base

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(
    title="BackupControl API",
    description="API for backup management system",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api import auth, clients, backups, alerts, dashboard, emails, notifications, settings

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(clients.router, prefix="/api/clients", tags=["clients"])
app.include_router(backups.router, prefix="/api/backups", tags=["backups"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(emails.router, prefix="/api/emails", tags=["emails"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0", "service": "BackupControl"}