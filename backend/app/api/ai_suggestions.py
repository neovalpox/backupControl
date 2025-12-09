"""
Routes pour les suggestions IA
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user, get_current_tech_user
from app.models.user import User
from app.models.ai_suggestion import AISuggestion

router = APIRouter()


class SuggestionResponse(BaseModel):
    id: int
    category: str
    priority: str
    title: str
    description: Optional[str]
    recommendation: Optional[str]
    is_dismissed: bool
    is_implemented: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


@router.get("/suggestions", response_model=List[SuggestionResponse])
async def get_suggestions(
    include_dismissed: bool = False,
    include_implemented: bool = False,
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupère les suggestions IA actives"""
    query = select(AISuggestion)
    
    if not include_dismissed:
        query = query.where(AISuggestion.is_dismissed == False)
    if not include_implemented:
        query = query.where(AISuggestion.is_implemented == False)
    if category:
        query = query.where(AISuggestion.category == category)
    
    query = query.order_by(
        AISuggestion.priority.desc(),
        AISuggestion.created_at.desc()
    )
    
    result = await db.execute(query)
    suggestions = result.scalars().all()
    
    return [
        SuggestionResponse(
            id=s.id,
            category=s.category,
            priority=s.priority,
            title=s.title,
            description=s.description,
            recommendation=s.recommendation,
            is_dismissed=s.is_dismissed,
            is_implemented=s.is_implemented,
            created_at=s.created_at
        )
        for s in suggestions
    ]


@router.get("/suggestions/{suggestion_id}", response_model=SuggestionResponse)
async def get_suggestion(
    suggestion_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupère une suggestion spécifique"""
    result = await db.execute(
        select(AISuggestion).where(AISuggestion.id == suggestion_id)
    )
    suggestion = result.scalar_one_or_none()
    
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion non trouvée")
    
    return SuggestionResponse(
        id=suggestion.id,
        category=suggestion.category,
        priority=suggestion.priority,
        title=suggestion.title,
        description=suggestion.description,
        recommendation=suggestion.recommendation,
        is_dismissed=suggestion.is_dismissed,
        is_implemented=suggestion.is_implemented,
        created_at=suggestion.created_at
    )


@router.post("/suggestions/{suggestion_id}/dismiss")
async def dismiss_suggestion(
    suggestion_id: int,
    reason: Optional[str] = None,
    current_user: User = Depends(get_current_tech_user),
    db: AsyncSession = Depends(get_db)
):
    """Rejette une suggestion"""
    result = await db.execute(
        select(AISuggestion).where(AISuggestion.id == suggestion_id)
    )
    suggestion = result.scalar_one_or_none()
    
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion non trouvée")
    
    suggestion.is_dismissed = True
    suggestion.dismissed_by = current_user.id
    suggestion.dismissed_at = datetime.utcnow()
    suggestion.dismiss_reason = reason
    
    await db.commit()
    
    return {"message": "Suggestion rejetée"}


@router.post("/suggestions/{suggestion_id}/implement")
async def mark_implemented(
    suggestion_id: int,
    current_user: User = Depends(get_current_tech_user),
    db: AsyncSession = Depends(get_db)
):
    """Marque une suggestion comme implémentée"""
    result = await db.execute(
        select(AISuggestion).where(AISuggestion.id == suggestion_id)
    )
    suggestion = result.scalar_one_or_none()
    
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion non trouvée")
    
    suggestion.is_implemented = True
    suggestion.implemented_by = current_user.id
    suggestion.implemented_at = datetime.utcnow()
    
    await db.commit()
    
    return {"message": "Suggestion marquée comme implémentée"}


@router.post("/generate")
async def generate_suggestions_now(
    current_user: User = Depends(get_current_tech_user)
):
    """Génère de nouvelles suggestions maintenant"""
    from app.services.scheduler import scheduler_service
    
    try:
        await scheduler_service._generate_ai_suggestions()
        return {"message": "Suggestions générées avec succès"}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de la génération: {str(e)}"
        )
