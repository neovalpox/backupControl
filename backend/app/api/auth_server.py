"""
Routes d'authentification
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user
)
from app.core.config import settings
from app.models.user import User

router = APIRouter()


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str
    full_name: str = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/login", response_model=Token)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """Authentification utilisateur"""
    # Recherche de l'utilisateur
    result = await db.execute(
        select(User).where(
            (User.email == request.email) | (User.username == request.email)
        )
    )
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte d├®sactiv├®"
        )
    
    # Mise ├á jour de la derni├¿re connexion
    user.last_login = datetime.utcnow()
    await db.commit()
    
    # Cr├®ation du token
    access_token = create_access_token(
        data={"sub": str(user.id), "role": user.role}
    )
    
    return Token(
        access_token=access_token,
        expires_in=settings.access_token_expire_minutes * 60,
        user={
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
            "language": user.language,
            "theme": user.theme
        }
    )


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """Cr├®ation d'un nouveau compte (premier utilisateur devient admin)"""
    # V├®rifier si c'est le premier utilisateur
    result = await db.execute(select(User))
    existing_users = result.scalars().all()
    is_first_user = len(existing_users) == 0
    
    # V├®rifier si l'email existe d├®j├á
    result = await db.execute(
        select(User).where(User.email == request.email)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cet email est d├®j├á utilis├®"
        )
    
    # V├®rifier si le username existe d├®j├á
    result = await db.execute(
        select(User).where(User.username == request.username)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce nom d'utilisateur est d├®j├á utilis├®"
        )
    
    # Cr├®ation de l'utilisateur
    user = User(
        email=request.email,
        username=request.username,
        hashed_password=get_password_hash(request.password),
        full_name=request.full_name,
        role="admin" if is_first_user else "readonly"  # Premier = admin
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return {
        "message": "Compte cr├®├® avec succ├¿s",
        "user_id": user.id,
        "role": user.role
    }


@router.get("/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """R├®cup├¿re les informations de l'utilisateur connect├®"""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "language": current_user.language,
        "theme": current_user.theme,
        "notify_email": current_user.notify_email,
        "notify_push": current_user.notify_push,
        "created_at": current_user.created_at,
        "last_login": current_user.last_login
    }


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Change le mot de passe de l'utilisateur connect├®"""
    if not verify_password(request.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mot de passe actuel incorrect"
        )
    
    current_user.hashed_password = get_password_hash(request.new_password)
    await db.commit()
    
    return {"message": "Mot de passe modifi├® avec succ├¿s"}


@router.post("/refresh")
async def refresh_token(
    current_user: User = Depends(get_current_user)
):
    """Rafra├«chit le token d'authentification"""
    access_token = create_access_token(
        data={"sub": str(current_user.id), "role": current_user.role}
    )
    
    return Token(
        access_token=access_token,
        expires_in=settings.access_token_expire_minutes * 60,
        user={
            "id": current_user.id,
            "email": current_user.email,
            "username": current_user.username,
            "full_name": current_user.full_name,
            "role": current_user.role
        }
    )
