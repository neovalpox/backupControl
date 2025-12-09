from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import List, Optional
from app.db.session import get_db
from app.models import Alert
from app.schemas.alert import AlertCreate, AlertResponse
from app.api.auth import get_current_user
from datetime import datetime

router = APIRouter()

@router.get("", response_model=List[AlertResponse])
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
    return result.scalars().all()

@router.get("/count")
async def get_alert_count(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(
        select(func.count(Alert.id)).where(
            or_(Alert.status == 'new', Alert.status == None)
        )
    )
    count = result.scalar() or 0
    return {"count": count}

@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.status = "acknowledged"
    alert.acknowledged_at = datetime.utcnow()
    alert.acknowledged_by = current_user.username
    await db.commit()
    return {"message": "Alert acknowledged"}

@router.post("/{alert_id}/resolve")
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
    alert.resolved_at = datetime.utcnow()
    await db.commit()
    return {"message": "Alert resolved"}

@router.post("", response_model=AlertResponse)
async def create_alert(
    alert: AlertCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    db_alert = Alert(**alert.dict())
    db.add(db_alert)
    await db.commit()
    await db.refresh(db_alert)
    return db_alert