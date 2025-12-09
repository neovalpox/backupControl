from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.alert import Alert

router = APIRouter()

@router.get("")
async def get_alerts(
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    limit: Optional[int] = Query(100),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = select(Alert)
    
    if status:
        query = query.where(Alert.status == status)
    if severity:
        query = query.where(Alert.severity == severity)
    
    query = query.order_by(Alert.created_at.desc()).limit(limit)
    result = await db.execute(query)
    alerts = result.scalars().all()
    
    return [
        {
            "id": alert.id,
            "title": alert.title,
            "message": alert.message,
            "severity": alert.severity,
            "status": alert.status,
            "client_id": alert.client_id,
            "backup_id": alert.backup_id,
            "created_at": alert.created_at.isoformat() if alert.created_at else None,
            "resolved_at": alert.resolved_at.isoformat() if alert.resolved_at else None,
        }
        for alert in alerts
    ]

@router.get("/count")
async def get_alerts_count(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get count of unresolved alerts for notification badge"""
    result = await db.execute(
        select(func.count(Alert.id)).where(
            or_(Alert.status == "pending", Alert.status == "new", Alert.status == None)
        )
    )
    count = result.scalar() or 0
    return {"count": count}

@router.put("/{alert_id}/resolve")
async def resolve_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert.status = "resolved"
    alert.resolved_at = datetime.now()
    await db.commit()
    
    return {"message": "Alert resolved", "id": alert_id}

@router.put("/batch/resolve")
async def batch_resolve_alerts(
    ids: List[int],
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Resolve multiple alerts at once"""
    result = await db.execute(select(Alert).where(Alert.id.in_(ids)))
    alerts = result.scalars().all()
    
    resolved_count = 0
    for alert in alerts:
        alert.status = "resolved"
        alert.resolved_at = datetime.now()
        resolved_count += 1
    
    await db.commit()
    return {"message": f"{resolved_count} alerts resolved"}

@router.delete("/{alert_id}")
async def delete_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    await db.delete(alert)
    await db.commit()
    
    return {"message": "Alert deleted", "id": alert_id}

@router.delete("/batch")
async def batch_delete_alerts(
    ids: List[int],
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete multiple alerts at once"""
    result = await db.execute(select(Alert).where(Alert.id.in_(ids)))
    alerts = result.scalars().all()
    
    deleted_count = 0
    for alert in alerts:
        await db.delete(alert)
        deleted_count += 1
    
    await db.commit()
    return {"message": f"{deleted_count} alerts deleted"}
