"""
Routes de gestion des sauvegardes
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.security import get_current_user, get_current_tech_user
from app.models.user import User
from app.models.backup import Backup, BackupEvent, BackupType, BackupStatus
from app.models.client import Client

router = APIRouter()


class BackupBase(BaseModel):
    name: str
    backup_type: str = "other"
    source_nas: Optional[str] = None
    source_device: Optional[str] = None
    destination: Optional[str] = None
    destination_nas: Optional[str] = None
    expected_schedule: Optional[str] = None
    expected_hour: Optional[int] = None
    email_patterns: List[str] = []
    notes: Optional[str] = None


class BackupCreate(BackupBase):
    client_id: int


class BackupUpdate(BaseModel):
    name: Optional[str] = None
    backup_type: Optional[str] = None
    source_nas: Optional[str] = None
    source_device: Optional[str] = None
    destination: Optional[str] = None
    destination_nas: Optional[str] = None
    expected_schedule: Optional[str] = None
    expected_hour: Optional[int] = None
    email_patterns: Optional[List[str]] = None
    is_active: Optional[bool] = None
    is_maintenance: Optional[bool] = None
    maintenance_until: Optional[datetime] = None
    maintenance_reason: Optional[str] = None
    notes: Optional[str] = None


class BackupResponse(BackupBase):
    id: int
    client_id: int
    client_name: str
    current_status: str
    last_success_at: Optional[datetime]
    last_failure_at: Optional[datetime]
    last_event_at: Optional[datetime]
    total_success_count: int
    total_failure_count: int
    last_size_bytes: Optional[float]
    last_duration_seconds: Optional[int]
    is_active: bool
    is_maintenance: bool
    maintenance_until: Optional[datetime]
    maintenance_reason: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class BackupEventResponse(BaseModel):
    id: int
    event_type: str
    event_date: datetime
    duration_seconds: Optional[int]
    transferred_size_bytes: Optional[float]
    error_message: Optional[str]
    
    class Config:
        from_attributes = True


class BackupDetailResponse(BackupResponse):
    recent_events: List[BackupEventResponse] = []


@router.get("/", response_model=List[BackupResponse])
async def list_backups(
    client_id: Optional[int] = None,
    status: Optional[str] = None,
    backup_type: Optional[str] = None,
    active_only: bool = True,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Liste toutes les sauvegardes avec filtres optionnels"""
    query = select(Backup, Client.name.label("client_name")).join(Client)
    
    if client_id:
        query = query.where(Backup.client_id == client_id)
    if status:
        query = query.where(Backup.current_status == status)
    if backup_type:
        query = query.where(Backup.backup_type == backup_type)
    if active_only:
        query = query.where(Backup.is_active == True)
    
    query = query.order_by(Client.name, Backup.name)
    
    result = await db.execute(query)
    rows = result.all()
    
    return [
        BackupResponse(
            id=backup.id,
            name=backup.name,
            backup_type=backup.backup_type,
            source_nas=backup.source_nas,
            source_device=backup.source_device,
            destination=backup.destination,
            destination_nas=backup.destination_nas,
            expected_schedule=backup.expected_schedule,
            expected_hour=backup.expected_hour,
            email_patterns=backup.email_patterns or [],
            notes=backup.notes,
            client_id=backup.client_id,
            client_name=client_name,
            current_status=backup.current_status,
            last_success_at=backup.last_success_at,
            last_failure_at=backup.last_failure_at,
            last_event_at=backup.last_event_at,
            total_success_count=backup.total_success_count,
            total_failure_count=backup.total_failure_count,
            last_size_bytes=backup.last_size_bytes,
            last_duration_seconds=backup.last_duration_seconds,
            is_active=backup.is_active,
            is_maintenance=backup.is_maintenance,
            maintenance_until=backup.maintenance_until,
            maintenance_reason=backup.maintenance_reason,
            created_at=backup.created_at
        )
        for backup, client_name in rows
    ]


@router.post("/", response_model=BackupResponse, status_code=status.HTTP_201_CREATED)
async def create_backup(
    backup_data: BackupCreate,
    current_user: User = Depends(get_current_tech_user),
    db: AsyncSession = Depends(get_db)
):
    """Crée une nouvelle sauvegarde"""
    # Vérifier que le client existe
    result = await db.execute(
        select(Client).where(Client.id == backup_data.client_id)
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client non trouvé")
    
    backup = Backup(**backup_data.model_dump())
    db.add(backup)
    await db.commit()
    await db.refresh(backup)
    
    return BackupResponse(
        id=backup.id,
        name=backup.name,
        backup_type=backup.backup_type,
        source_nas=backup.source_nas,
        source_device=backup.source_device,
        destination=backup.destination,
        destination_nas=backup.destination_nas,
        expected_schedule=backup.expected_schedule,
        expected_hour=backup.expected_hour,
        email_patterns=backup.email_patterns or [],
        notes=backup.notes,
        client_id=backup.client_id,
        client_name=client.name,
        current_status=backup.current_status,
        last_success_at=backup.last_success_at,
        last_failure_at=backup.last_failure_at,
        last_event_at=backup.last_event_at,
        total_success_count=backup.total_success_count,
        total_failure_count=backup.total_failure_count,
        last_size_bytes=backup.last_size_bytes,
        last_duration_seconds=backup.last_duration_seconds,
        is_active=backup.is_active,
        is_maintenance=backup.is_maintenance,
        maintenance_until=backup.maintenance_until,
        maintenance_reason=backup.maintenance_reason,
        created_at=backup.created_at
    )


@router.get("/{backup_id}", response_model=BackupDetailResponse)
async def get_backup(
    backup_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupère une sauvegarde avec ses derniers événements"""
    result = await db.execute(
        select(Backup, Client.name.label("client_name"))
        .join(Client)
        .where(Backup.id == backup_id)
    )
    row = result.one_or_none()
    
    if not row:
        raise HTTPException(status_code=404, detail="Sauvegarde non trouvée")
    
    backup, client_name = row
    
    # Récupérer les derniers événements
    result = await db.execute(
        select(BackupEvent)
        .where(BackupEvent.backup_id == backup_id)
        .order_by(BackupEvent.event_date.desc())
        .limit(50)
    )
    events = result.scalars().all()
    
    return BackupDetailResponse(
        id=backup.id,
        name=backup.name,
        backup_type=backup.backup_type,
        source_nas=backup.source_nas,
        source_device=backup.source_device,
        destination=backup.destination,
        destination_nas=backup.destination_nas,
        expected_schedule=backup.expected_schedule,
        expected_hour=backup.expected_hour,
        email_patterns=backup.email_patterns or [],
        notes=backup.notes,
        client_id=backup.client_id,
        client_name=client_name,
        current_status=backup.current_status,
        last_success_at=backup.last_success_at,
        last_failure_at=backup.last_failure_at,
        last_event_at=backup.last_event_at,
        total_success_count=backup.total_success_count,
        total_failure_count=backup.total_failure_count,
        last_size_bytes=backup.last_size_bytes,
        last_duration_seconds=backup.last_duration_seconds,
        is_active=backup.is_active,
        is_maintenance=backup.is_maintenance,
        maintenance_until=backup.maintenance_until,
        maintenance_reason=backup.maintenance_reason,
        created_at=backup.created_at,
        recent_events=[
            BackupEventResponse(
                id=e.id,
                event_type=e.event_type,
                event_date=e.event_date,
                duration_seconds=e.duration_seconds,
                transferred_size_bytes=e.transferred_size_bytes,
                error_message=e.error_message
            )
            for e in events
        ]
    )


@router.put("/{backup_id}", response_model=BackupResponse)
async def update_backup(
    backup_id: int,
    backup_data: BackupUpdate,
    current_user: User = Depends(get_current_tech_user),
    db: AsyncSession = Depends(get_db)
):
    """Met à jour une sauvegarde"""
    result = await db.execute(
        select(Backup, Client.name.label("client_name"))
        .join(Client)
        .where(Backup.id == backup_id)
    )
    row = result.one_or_none()
    
    if not row:
        raise HTTPException(status_code=404, detail="Sauvegarde non trouvée")
    
    backup, client_name = row
    
    update_data = backup_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(backup, field, value)
    
    await db.commit()
    await db.refresh(backup)
    
    return BackupResponse(
        id=backup.id,
        name=backup.name,
        backup_type=backup.backup_type,
        source_nas=backup.source_nas,
        source_device=backup.source_device,
        destination=backup.destination,
        destination_nas=backup.destination_nas,
        expected_schedule=backup.expected_schedule,
        expected_hour=backup.expected_hour,
        email_patterns=backup.email_patterns or [],
        notes=backup.notes,
        client_id=backup.client_id,
        client_name=client_name,
        current_status=backup.current_status,
        last_success_at=backup.last_success_at,
        last_failure_at=backup.last_failure_at,
        last_event_at=backup.last_event_at,
        total_success_count=backup.total_success_count,
        total_failure_count=backup.total_failure_count,
        last_size_bytes=backup.last_size_bytes,
        last_duration_seconds=backup.last_duration_seconds,
        is_active=backup.is_active,
        is_maintenance=backup.is_maintenance,
        maintenance_until=backup.maintenance_until,
        maintenance_reason=backup.maintenance_reason,
        created_at=backup.created_at
    )


@router.delete("/{backup_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_backup(
    backup_id: int,
    current_user: User = Depends(get_current_tech_user),
    db: AsyncSession = Depends(get_db)
):
    """Supprime une sauvegarde"""
    result = await db.execute(
        select(Backup).where(Backup.id == backup_id)
    )
    backup = result.scalar_one_or_none()
    
    if not backup:
        raise HTTPException(status_code=404, detail="Sauvegarde non trouvée")
    
    await db.delete(backup)
    await db.commit()


@router.post("/{backup_id}/maintenance")
async def toggle_maintenance(
    backup_id: int,
    enable: bool,
    until: Optional[datetime] = None,
    reason: Optional[str] = None,
    current_user: User = Depends(get_current_tech_user),
    db: AsyncSession = Depends(get_db)
):
    """Active/désactive le mode maintenance d'une sauvegarde"""
    result = await db.execute(
        select(Backup).where(Backup.id == backup_id)
    )
    backup = result.scalar_one_or_none()
    
    if not backup:
        raise HTTPException(status_code=404, detail="Sauvegarde non trouvée")
    
    backup.is_maintenance = enable
    backup.maintenance_until = until if enable else None
    backup.maintenance_reason = reason if enable else None
    
    await db.commit()
    
    return {
        "message": f"Mode maintenance {'activé' if enable else 'désactivé'}",
        "is_maintenance": backup.is_maintenance
    }


@router.get("/{backup_id}/events", response_model=List[BackupEventResponse])
async def get_backup_events(
    backup_id: int,
    limit: int = Query(default=100, le=500),
    offset: int = 0,
    event_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupère l'historique des événements d'une sauvegarde"""
    query = select(BackupEvent).where(BackupEvent.backup_id == backup_id)
    
    if event_type:
        query = query.where(BackupEvent.event_type == event_type)
    
    query = query.order_by(BackupEvent.event_date.desc()).offset(offset).limit(limit)
    
    result = await db.execute(query)
    events = result.scalars().all()
    
    return [
        BackupEventResponse(
            id=e.id,
            event_type=e.event_type,
            event_date=e.event_date,
            duration_seconds=e.duration_seconds,
            transferred_size_bytes=e.transferred_size_bytes,
            error_message=e.error_message
        )
        for e in events
    ]
