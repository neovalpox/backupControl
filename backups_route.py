from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from app.db.session import get_db
from app.models import Backup, BackupEvent, Client
from app.schemas.backup import BackupCreate, BackupUpdate, BackupResponse
from app.api.auth import get_current_user

router = APIRouter()

@router.get("", response_model=List[BackupResponse])
async def get_backups(
    client_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = select(Backup)
    if client_id:
        query = query.where(Backup.client_id == client_id)
    query = query.order_by(Backup.name)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{backup_id}", response_model=BackupResponse)
async def get_backup(
    backup_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(select(Backup).where(Backup.id == backup_id))
    backup = result.scalar_one_or_none()
    if not backup:
        raise HTTPException(status_code=404, detail="Backup not found")
    return backup

@router.post("", response_model=BackupResponse)
async def create_backup(
    backup: BackupCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    db_backup = Backup(**backup.dict())
    db.add(db_backup)
    await db.commit()
    await db.refresh(db_backup)
    return db_backup

@router.put("/{backup_id}", response_model=BackupResponse)
async def update_backup(
    backup_id: int,
    backup: BackupUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(select(Backup).where(Backup.id == backup_id))
    db_backup = result.scalar_one_or_none()
    if not db_backup:
        raise HTTPException(status_code=404, detail="Backup not found")
    for field, value in backup.dict(exclude_unset=True).items():
        setattr(db_backup, field, value)
    await db.commit()
    await db.refresh(db_backup)
    return db_backup

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