"""
Routes de gestion des alertes
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.alert import Alert
from app.models.client import Client
from app.models.backup import Backup

router = APIRouter()


class AlertResponse(BaseModel):
    id: int
    alert_type: str
    severity: str
    title: str
    message: Optional[str]
    client_id: Optional[int]
    client_name: Optional[str] = None
    backup_id: Optional[int]
    backup_name: Optional[str] = None
    is_acknowledged: bool
    is_resolved: bool
    created_at: Optional[datetime]
    resolved_at: Optional[datetime]

    class Config:
        from_attributes = True


@router.get("", response_model=List[AlertResponse])
async def get_alerts(
    resolved: Optional[bool] = Query(None),
    severity: Optional[str] = Query(None),
    limit: int = Query(100),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Liste les alertes avec filtres optionnels"""
    query = select(Alert)

    if resolved is not None:
        query = query.where(Alert.is_resolved == resolved)
    if severity:
        query = query.where(Alert.severity == severity)

    query = query.order_by(Alert.created_at.desc()).limit(limit)
    result = await db.execute(query)
    alerts = result.scalars().all()

    response = []
    for alert in alerts:
        # Récupérer le nom du client si disponible
        client_name = None
        if alert.client_id:
            client_result = await db.execute(select(Client).where(Client.id == alert.client_id))
            client = client_result.scalar_one_or_none()
            if client:
                client_name = client.name

        # Récupérer le nom de la sauvegarde si disponible
        backup_name = None
        if alert.backup_id:
            backup_result = await db.execute(select(Backup).where(Backup.id == alert.backup_id))
            backup = backup_result.scalar_one_or_none()
            if backup:
                backup_name = backup.name

        response.append(AlertResponse(
            id=alert.id,
            alert_type=alert.alert_type,
            severity=alert.severity,
            title=alert.title,
            message=alert.message,
            client_id=alert.client_id,
            client_name=client_name,
            backup_id=alert.backup_id,
            backup_name=backup_name,
            is_acknowledged=alert.is_acknowledged or False,
            is_resolved=alert.is_resolved or False,
            created_at=alert.created_at,
            resolved_at=alert.resolved_at
        ))

    return response


@router.get("/count")
async def get_alerts_count(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Compte les alertes non résolues pour le badge de notification"""
    result = await db.execute(
        select(func.count(Alert.id)).where(
            or_(Alert.is_resolved == False, Alert.is_resolved == None)
        )
    )
    count = result.scalar() or 0
    return {"count": count}


@router.get("/summary")
async def get_alerts_summary(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Résumé des alertes par sévérité"""
    # Total non résolues
    result = await db.execute(
        select(func.count(Alert.id)).where(
            or_(Alert.is_resolved == False, Alert.is_resolved == None)
        )
    )
    total_unresolved = result.scalar() or 0

    # Par sévérité
    severities = {}
    for severity in ["critical", "alert", "warning", "info"]:
        result = await db.execute(
            select(func.count(Alert.id)).where(
                Alert.severity == severity,
                or_(Alert.is_resolved == False, Alert.is_resolved == None)
            )
        )
        severities[severity] = result.scalar() or 0

    return {
        "total_unresolved": total_unresolved,
        "by_severity": severities
    }


@router.put("/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Marquer une alerte comme prise en compte"""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alerte non trouvée")

    alert.is_acknowledged = True
    alert.acknowledged_at = datetime.now()
    alert.acknowledged_by = current_user.id
    await db.commit()

    return {"message": "Alerte prise en compte", "id": alert_id}


@router.put("/{alert_id}/resolve")
async def resolve_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Résoudre une alerte"""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alerte non trouvée")

    alert.is_resolved = True
    alert.resolved_at = datetime.now()
    alert.resolved_by = current_user.id
    await db.commit()

    return {"message": "Alerte résolue", "id": alert_id}


@router.put("/batch/resolve")
async def batch_resolve_alerts(
    ids: List[int],
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Résoudre plusieurs alertes en une fois"""
    result = await db.execute(select(Alert).where(Alert.id.in_(ids)))
    alerts = result.scalars().all()

    resolved_count = 0
    for alert in alerts:
        alert.is_resolved = True
        alert.resolved_at = datetime.now()
        alert.resolved_by = current_user.id
        resolved_count += 1

    await db.commit()
    return {"message": f"{resolved_count} alertes résolues"}


@router.delete("/{alert_id}")
async def delete_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Supprimer une alerte"""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alerte non trouvée")

    await db.delete(alert)
    await db.commit()

    return {"message": "Alerte supprimée", "id": alert_id}


@router.post("/generate-from-backups")
async def generate_alerts_from_backups(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Génère des alertes pour les sauvegardes en échec"""
    # Récupérer les sauvegardes en échec
    result = await db.execute(
        select(Backup).where(Backup.current_status == "failed")
    )
    failed_backups = result.scalars().all()

    created_count = 0
    for backup in failed_backups:
        # Vérifier si une alerte existe déjà pour cette sauvegarde
        existing = await db.execute(
            select(Alert).where(
                Alert.backup_id == backup.id,
                Alert.alert_type == "backup_failed",
                or_(Alert.is_resolved == False, Alert.is_resolved == None)
            )
        )
        if existing.scalar_one_or_none():
            continue

        # Creer une nouvelle alerte
        alert = Alert(
            alert_type="backup_failed",
            severity="critical",
            client_id=backup.client_id,
            backup_id=backup.id,
            title=f"Echec de sauvegarde: {backup.name}",
            message=f"La sauvegarde '{backup.name}' a echoue. Derniere tentative: {backup.last_failure_at.isoformat() if backup.last_failure_at else 'inconnue'}",
            is_acknowledged=False,
            is_resolved=False
        )
        db.add(alert)
        created_count += 1

    await db.commit()
    return {"message": f"{created_count} alertes creees pour les sauvegardes en echec"}
