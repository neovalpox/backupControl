"""
Routes du dashboard
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.client import Client
from app.models.backup import Backup, BackupEvent, BackupStatus
from app.models.alert import Alert

router = APIRouter()


@router.get("/summary")
async def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Résumé global du dashboard"""
    # Clients actifs
    result = await db.execute(
        select(func.count(Client.id)).where(Client.is_active == True)
    )
    total_clients = result.scalar()
    
    # Sauvegardes par statut
    result = await db.execute(
        select(Backup.current_status, func.count(Backup.id))
        .where(Backup.is_active == True)
        .group_by(Backup.current_status)
    )
    status_counts = {row[0]: row[1] for row in result.all()}
    
    total_backups = sum(status_counts.values())
    
    # Alertes non résolues
    result = await db.execute(
        select(func.count(Alert.id)).where(Alert.is_resolved == False)
    )
    unresolved_alerts = result.scalar()
    
    # Dernière mise à jour
    result = await db.execute(
        select(BackupEvent.event_date)
        .order_by(BackupEvent.event_date.desc())
        .limit(1)
    )
    last_event = result.scalar()
    
    return {
        "total_clients": total_clients,
        "total_backups": total_backups,
        "backups_ok": status_counts.get("ok", 0),
        "backups_warning": status_counts.get("warning", 0),
        "backups_alert": status_counts.get("alert", 0),
        "backups_critical": status_counts.get("critical", 0),
        "backups_failed": status_counts.get("failed", 0),
        "backups_unknown": status_counts.get("unknown", 0),
        "unresolved_alerts": unresolved_alerts,
        "last_update": last_event,
        "health_percentage": round(
            status_counts.get("ok", 0) / total_backups * 100 if total_backups > 0 else 0,
            1
        )
    }


@router.get("/status-overview")
async def get_status_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Vue d'ensemble des statuts par client"""
    result = await db.execute(
        select(Client).where(Client.is_active == True).order_by(Client.name)
    )
    clients = result.scalars().all()
    
    overview = []
    for client in clients:
        result = await db.execute(
            select(Backup.current_status, func.count(Backup.id))
            .where(Backup.client_id == client.id, Backup.is_active == True)
            .group_by(Backup.current_status)
        )
        status_counts = {row[0]: row[1] for row in result.all()}
        
        # Déterminer le statut global du client
        if status_counts.get("critical", 0) > 0 or status_counts.get("failed", 0) > 0:
            global_status = "critical"
        elif status_counts.get("alert", 0) > 0:
            global_status = "alert"
        elif status_counts.get("warning", 0) > 0:
            global_status = "warning"
        elif status_counts.get("ok", 0) > 0:
            global_status = "ok"
        else:
            global_status = "unknown"
        
        overview.append({
            "client_id": client.id,
            "client_name": client.name,
            "short_name": client.short_name,
            "global_status": global_status,
            "backups_ok": status_counts.get("ok", 0),
            "backups_warning": status_counts.get("warning", 0),
            "backups_alert": status_counts.get("alert", 0),
            "backups_critical": status_counts.get("critical", 0) + status_counts.get("failed", 0),
            "total_backups": sum(status_counts.values())
        })
    
    return overview


@router.get("/recent-events")
async def get_recent_events(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Derniers événements de sauvegarde"""
    result = await db.execute(
        select(BackupEvent, Backup.name.label("backup_name"), Client.name.label("client_name"))
        .join(Backup)
        .join(Client)
        .order_by(BackupEvent.event_date.desc())
        .limit(limit)
    )
    rows = result.all()
    
    return [
        {
            "id": event.id,
            "event_type": event.event_type,
            "event_date": event.event_date,
            "backup_name": backup_name,
            "client_name": client_name,
            "duration_seconds": event.duration_seconds,
            "transferred_size_bytes": event.transferred_size_bytes,
            "error_message": event.error_message
        }
        for event, backup_name, client_name in rows
    ]


@router.get("/alerts")
async def get_active_alerts(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Alertes actives (non résolues)"""
    result = await db.execute(
        select(Alert, Client.name.label("client_name"), Backup.name.label("backup_name"))
        .outerjoin(Client, Alert.client_id == Client.id)
        .outerjoin(Backup, Alert.backup_id == Backup.id)
        .where(Alert.is_resolved == False)
        .order_by(Alert.created_at.desc())
        .limit(limit)
    )
    rows = result.all()
    
    return [
        {
            "id": alert.id,
            "alert_type": alert.alert_type,
            "severity": alert.severity,
            "title": alert.title,
            "message": alert.message,
            "client_name": client_name,
            "backup_name": backup_name,
            "is_acknowledged": alert.is_acknowledged,
            "created_at": alert.created_at
        }
        for alert, client_name, backup_name in rows
    ]


@router.get("/trends")
async def get_backup_trends(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Tendances des sauvegardes sur les derniers jours"""
    start_date = datetime.utcnow() - timedelta(days=days)
    
    result = await db.execute(
        select(
            func.date(BackupEvent.event_date).label("date"),
            BackupEvent.event_type,
            func.count(BackupEvent.id)
        )
        .where(BackupEvent.event_date >= start_date)
        .group_by(func.date(BackupEvent.event_date), BackupEvent.event_type)
        .order_by(func.date(BackupEvent.event_date))
    )
    rows = result.all()
    
    # Organiser par date
    trends = {}
    for date, event_type, count in rows:
        date_str = str(date)
        if date_str not in trends:
            trends[date_str] = {"date": date_str, "success": 0, "failure": 0, "warning": 0}
        trends[date_str][event_type] = count
    
    return list(trends.values())


@router.get("/backup-types-distribution")
async def get_backup_types_distribution(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Distribution des types de sauvegardes"""
    result = await db.execute(
        select(Backup.backup_type, func.count(Backup.id))
        .where(Backup.is_active == True)
        .group_by(Backup.backup_type)
    )
    
    return [
        {"type": row[0] or "unknown", "count": row[1]}
        for row in result.all()
    ]


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Acquitte une alerte"""
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id)
    )
    alert = result.scalar_one_or_none()
    
    if not alert:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Alerte non trouvée")
    
    alert.is_acknowledged = True
    alert.acknowledged_by = current_user.id
    alert.acknowledged_at = datetime.utcnow()
    
    await db.commit()
    
    return {"message": "Alerte acquittée"}


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: int,
    notes: str = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Résout une alerte"""
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id)
    )
    alert = result.scalar_one_or_none()
    
    if not alert:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Alerte non trouvée")
    
    alert.is_resolved = True
    alert.resolved_by = current_user.id
    alert.resolved_at = datetime.utcnow()
    alert.resolution_notes = notes
    
    await db.commit()
    
    return {"message": "Alerte résolue"}
