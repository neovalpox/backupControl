from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.backup import Backup, BackupEvent
from app.models.client import Client

router = APIRouter()

@router.get("")
async def get_backups(
    client_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    backup_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = select(Backup)
    
    if client_id:
        query = query.where(Backup.client_id == client_id)
    if status:
        query = query.where(Backup.last_status == status)
    if backup_type:
        query = query.where(Backup.backup_type == backup_type)
    
    query = query.order_by(Backup.name)
    result = await db.execute(query)
    backups = result.scalars().all()
    
    # Convert to dicts with client info
    backup_list = []
    for backup in backups:
        backup_dict = {
            "id": backup.id,
            "name": backup.name,
            "client_id": backup.client_id,
            "backup_type": backup.backup_type,
            "last_status": backup.last_status,
            "last_run": backup.last_run.isoformat() if backup.last_run else None,
            "last_size": backup.last_size,
            "schedule": backup.schedule,
            "created_at": backup.created_at.isoformat() if backup.created_at else None,
        }
        # Get client name
        client_result = await db.execute(select(Client).where(Client.id == backup.client_id))
        client = client_result.scalar_one_or_none()
        if client:
            backup_dict["client_name"] = client.name
        backup_list.append(backup_dict)
    
    return backup_list

@router.get("/by-client/{client_id}")
async def get_backups_by_client(
    client_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get all backups for a specific client"""
    result = await db.execute(
        select(Backup).where(Backup.client_id == client_id).order_by(Backup.name)
    )
    backups = result.scalars().all()
    
    backup_list = []
    for backup in backups:
        backup_dict = {
            "id": backup.id,
            "name": backup.name,
            "client_id": backup.client_id,
            "backup_type": backup.backup_type,
            "last_status": backup.last_status,
            "last_run": backup.last_run.isoformat() if backup.last_run else None,
            "last_size": backup.last_size,
            "schedule": backup.schedule,
            "created_at": backup.created_at.isoformat() if backup.created_at else None,
        }
        backup_list.append(backup_dict)
    
    return backup_list

@router.get("/last-sync")
async def get_last_sync(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get the last backup sync time"""
    result = await db.execute(
        select(func.max(Backup.last_run))
    )
    last_sync = result.scalar()
    return {"last_sync": last_sync.isoformat() if last_sync else None}

@router.get("/{backup_id}")
async def get_backup(
    backup_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(select(Backup).where(Backup.id == backup_id))
    backup = result.scalar_one_or_none()
    if not backup:
        raise HTTPException(status_code=404, detail="Backup not found")
    
    return {
        "id": backup.id,
        "name": backup.name,
        "client_id": backup.client_id,
        "backup_type": backup.backup_type,
        "last_status": backup.last_status,
        "last_run": backup.last_run.isoformat() if backup.last_run else None,
        "last_size": backup.last_size,
        "schedule": backup.schedule,
        "created_at": backup.created_at.isoformat() if backup.created_at else None,
    }

@router.delete("/{backup_id}")
async def delete_backup(
    backup_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(select(Backup).where(Backup.id == backup_id))
    db_backup = result.scalar_one_or_none()
    if not db_backup:
        raise HTTPException(status_code=404, detail="Backup not found")
    await db.delete(db_backup)
    await db.commit()
    return {"message": "Backup deleted"}
