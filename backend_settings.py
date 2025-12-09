from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Any, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user

router = APIRouter()

class SettingUpdate(BaseModel):
    value: Any

class SettingResponse(BaseModel):
    key: str
    value: Any

    class Config:
        from_attributes = True

# In-memory settings storage (in production, use database)
_settings_store = {
    "notifications": {
        "discord_webhook": "",
        "teams_webhook": "",
        "slack_webhook": "",
        "enabled_channels": []
    }
}

@router.get("")
async def get_all_settings(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get all settings"""
    return _settings_store

@router.get("/{key}")
async def get_setting(
    key: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get a specific setting by key"""
    if key in _settings_store:
        return {"key": key, "value": _settings_store[key]}
    raise HTTPException(status_code=404, detail=f"Setting '{key}' not found")

@router.put("/{key}")
async def update_setting(
    key: str,
    setting: SettingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update a setting"""
    _settings_store[key] = setting.value
    return {"key": key, "value": setting.value}

@router.post("/notifications/test")
async def test_notification(
    channel: str,
    webhook_url: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Test notification channel"""
    import aiohttp
    
    url = webhook_url
    if not url:
        notifications = _settings_store.get("notifications", {})
        if channel == "discord":
            url = notifications.get("discord_webhook")
        elif channel == "teams":
            url = notifications.get("teams_webhook")
        elif channel == "slack":
            url = notifications.get("slack_webhook")
    
    if not url:
        raise HTTPException(status_code=400, detail=f"No webhook URL configured for {channel}")
    
    try:
        async with aiohttp.ClientSession() as session:
            if channel == "discord":
                payload = {"content": "🔔 Test notification from BackupControl"}
            elif channel == "teams":
                payload = {"text": "🔔 Test notification from BackupControl"}
            elif channel == "slack":
                payload = {"text": "🔔 Test notification from BackupControl"}
            else:
                payload = {"text": "🔔 Test notification from BackupControl"}
            
            async with session.post(url, json=payload) as response:
                if response.status in [200, 204]:
                    return {"success": True, "message": f"Test notification sent to {channel}"}
                else:
                    return {"success": False, "message": f"Failed with status {response.status}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send notification: {str(e)}")
