"""
Routes de gestion des clients
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user, get_current_tech_user
from app.models.user import User
from app.models.client import Client
from app.models.backup import Backup

router = APIRouter()


class ClientBase(BaseModel):
    name: str
    short_name: str
    description: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    contract_type: Optional[str] = None
    sla_hours: int = 24
    email_patterns: List[str] = []
    nas_identifiers: List[str] = []
    notes: Optional[str] = None
    custom_alert_thresholds: Optional[dict] = None


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    short_name: Optional[str] = None
    description: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    contract_type: Optional[str] = None
    sla_hours: Optional[int] = None
    email_patterns: Optional[List[str]] = None
    nas_identifiers: Optional[List[str]] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None
    custom_alert_thresholds: Optional[dict] = None


class BackupSummary(BaseModel):
    id: int
    name: str
    backup_type: str
    current_status: str
    last_success_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class ClientResponse(ClientBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    backups_count: int = 0
    backups_ok: int = 0
    backups_warning: int = 0
    backups_critical: int = 0
    
    class Config:
        from_attributes = True


class ClientDetailResponse(ClientResponse):
    backups: List[BackupSummary] = []


@router.get("/", response_model=List[ClientResponse])
async def list_clients(
    active_only: bool = True,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Liste tous les clients"""
    query = select(Client)
    if active_only:
        query = query.where(Client.is_active == True)
    query = query.order_by(Client.name)
    
    result = await db.execute(query)
    clients = result.scalars().all()
    
    # Enrichir avec les stats des sauvegardes
    response = []
    for client in clients:
        result = await db.execute(
            select(Backup).where(Backup.client_id == client.id)
        )
        backups = result.scalars().all()
        
        client_data = ClientResponse(
            id=client.id,
            name=client.name,
            short_name=client.short_name,
            description=client.description,
            contact_name=client.contact_name,
            contact_email=client.contact_email,
            contact_phone=client.contact_phone,
            contract_type=client.contract_type,
            sla_hours=client.sla_hours,
            email_patterns=client.email_patterns or [],
            nas_identifiers=client.nas_identifiers or [],
            notes=client.notes,
            custom_alert_thresholds=client.custom_alert_thresholds,
            is_active=client.is_active,
            created_at=client.created_at,
            updated_at=client.updated_at,
            backups_count=len(backups),
            backups_ok=sum(1 for b in backups if b.current_status == "ok"),
            backups_warning=sum(1 for b in backups if b.current_status in ["warning", "alert"]),
            backups_critical=sum(1 for b in backups if b.current_status in ["critical", "failed"])
        )
        response.append(client_data)
    
    return response


@router.post("/", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_client(
    client_data: ClientCreate,
    current_user: User = Depends(get_current_tech_user),
    db: AsyncSession = Depends(get_db)
):
    """Crée un nouveau client"""
    # Vérifier l'unicité du short_name
    result = await db.execute(
        select(Client).where(Client.short_name == client_data.short_name)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Ce nom court est déjà utilisé"
        )
    
    client = Client(**client_data.model_dump())
    db.add(client)
    await db.commit()
    await db.refresh(client)
    
    return ClientResponse(
        **client_data.model_dump(),
        id=client.id,
        is_active=client.is_active,
        created_at=client.created_at,
        updated_at=client.updated_at
    )


@router.get("/{client_id}", response_model=ClientDetailResponse)
async def get_client(
    client_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupère un client avec ses sauvegardes"""
    result = await db.execute(
        select(Client).where(Client.id == client_id)
    )
    client = result.scalar_one_or_none()
    
    if not client:
        raise HTTPException(status_code=404, detail="Client non trouvé")
    
    # Récupérer les sauvegardes
    result = await db.execute(
        select(Backup).where(Backup.client_id == client_id)
    )
    backups = result.scalars().all()
    
    return ClientDetailResponse(
        id=client.id,
        name=client.name,
        short_name=client.short_name,
        description=client.description,
        contact_name=client.contact_name,
        contact_email=client.contact_email,
        contact_phone=client.contact_phone,
        contract_type=client.contract_type,
        sla_hours=client.sla_hours,
        email_patterns=client.email_patterns or [],
        nas_identifiers=client.nas_identifiers or [],
        notes=client.notes,
        custom_alert_thresholds=client.custom_alert_thresholds,
        is_active=client.is_active,
        created_at=client.created_at,
        updated_at=client.updated_at,
        backups_count=len(backups),
        backups_ok=sum(1 for b in backups if b.current_status == "ok"),
        backups_warning=sum(1 for b in backups if b.current_status in ["warning", "alert"]),
        backups_critical=sum(1 for b in backups if b.current_status in ["critical", "failed"]),
        backups=[BackupSummary(
            id=b.id,
            name=b.name,
            backup_type=b.backup_type,
            current_status=b.current_status,
            last_success_at=b.last_success_at
        ) for b in backups]
    )


@router.put("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: int,
    client_data: ClientUpdate,
    current_user: User = Depends(get_current_tech_user),
    db: AsyncSession = Depends(get_db)
):
    """Met à jour un client"""
    result = await db.execute(
        select(Client).where(Client.id == client_id)
    )
    client = result.scalar_one_or_none()
    
    if not client:
        raise HTTPException(status_code=404, detail="Client non trouvé")
    
    # Vérifier l'unicité du short_name si modifié
    if client_data.short_name and client_data.short_name != client.short_name:
        result = await db.execute(
            select(Client).where(Client.short_name == client_data.short_name)
        )
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Ce nom court est déjà utilisé")
    
    # Mise à jour
    update_data = client_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(client, field, value)
    
    await db.commit()
    await db.refresh(client)
    
    # Récupérer stats
    result = await db.execute(
        select(Backup).where(Backup.client_id == client_id)
    )
    backups = result.scalars().all()
    
    return ClientResponse(
        id=client.id,
        name=client.name,
        short_name=client.short_name,
        description=client.description,
        contact_name=client.contact_name,
        contact_email=client.contact_email,
        contact_phone=client.contact_phone,
        contract_type=client.contract_type,
        sla_hours=client.sla_hours,
        email_patterns=client.email_patterns or [],
        nas_identifiers=client.nas_identifiers or [],
        notes=client.notes,
        custom_alert_thresholds=client.custom_alert_thresholds,
        is_active=client.is_active,
        created_at=client.created_at,
        updated_at=client.updated_at,
        backups_count=len(backups),
        backups_ok=sum(1 for b in backups if b.current_status == "ok"),
        backups_warning=sum(1 for b in backups if b.current_status in ["warning", "alert"]),
        backups_critical=sum(1 for b in backups if b.current_status in ["critical", "failed"])
    )


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: int,
    current_user: User = Depends(get_current_tech_user),
    db: AsyncSession = Depends(get_db)
):
    """Supprime un client (et ses sauvegardes)"""
    result = await db.execute(
        select(Client).where(Client.id == client_id)
    )
    client = result.scalar_one_or_none()
    
    if not client:
        raise HTTPException(status_code=404, detail="Client non trouvé")
    
    await db.delete(client)
    await db.commit()
