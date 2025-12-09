"""
Routes de gestion des utilisateurs
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_current_user, get_current_admin_user, get_password_hash
from app.models.user import User, UserRole

router = APIRouter()


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    full_name: Optional[str]
    role: str
    is_active: bool
    language: str
    theme: str
    
    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str
    full_name: Optional[str] = None
    role: str = "readonly"


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    language: Optional[str] = None
    theme: Optional[str] = None


@router.get("/", response_model=List[UserResponse])
async def list_users(
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Liste tous les utilisateurs (admin uniquement)"""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return users


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Crée un nouvel utilisateur (admin uniquement)"""
    # Vérification email unique
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    
    # Vérification username unique
    result = await db.execute(select(User).where(User.username == user_data.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Nom d'utilisateur déjà utilisé")
    
    # Validation du rôle
    if user_data.role not in [r.value for r in UserRole]:
        raise HTTPException(status_code=400, detail="Rôle invalide")
    
    user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        role=user_data.role
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return user


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupère un utilisateur par ID"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Met à jour un utilisateur"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    # Empêcher la désactivation du dernier admin
    if user_data.is_active == False and user.role == "admin":
        result = await db.execute(
            select(User).where(User.role == "admin", User.is_active == True)
        )
        admins = result.scalars().all()
        if len(admins) <= 1:
            raise HTTPException(
                status_code=400,
                detail="Impossible de désactiver le dernier administrateur"
            )
    
    # Mise à jour des champs
    update_data = user_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    
    await db.commit()
    await db.refresh(user)
    
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Supprime un utilisateur"""
    if user_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="Impossible de supprimer votre propre compte"
        )
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    await db.delete(user)
    await db.commit()


@router.put("/me/preferences")
async def update_preferences(
    preferences: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Met à jour les préférences de l'utilisateur connecté"""
    # Ne permettre que certains champs
    allowed_fields = ["language", "theme", "notify_email", "notify_push", "full_name"]
    update_data = preferences.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        if field in allowed_fields:
            setattr(current_user, field, value)
    
    await db.commit()
    await db.refresh(current_user)
    
    return {"message": "Préférences mises à jour"}
