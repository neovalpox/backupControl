from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.db.session import get_db
from app.models import Setting
from app.api.auth import get_current_user
from pydantic import BaseModel

router = APIRouter()

class SettingUpdate(BaseModel):
    value: any

class SettingResponse(BaseModel):
    key: str
    value: any

    class Config:
        from_attributes = True

@router.get("", response_model=List[SettingResponse])
async def get_all_settings(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(select(Setting))
    return result.scalars().all()

@router.get("/{key}")
async def get_setting(
    key: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(select(Setting).where(Setting.key == key))
    setting = result.scalar_one_or_none()
    if not setting:
        return {"key": key, "value": None}
    return {"key": setting.key, "value": setting.value}

@router.put("/{key}")
async def update_setting(
    key: str,
    data: SettingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(select(Setting).where(Setting.key == key))
    setting = result.scalar_one_or_none()
    if setting:
        setting.value = data.value
    else:
        setting = Setting(key=key, value=data.value)
        db.add(setting)
    await db.commit()
    return {"key": key, "value": data.value}