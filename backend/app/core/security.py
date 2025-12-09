"""
Utilitaires de sécurité
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User

# Logger
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# Configuration du hachage des mots de passe
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Schéma Bearer pour JWT
security = HTTPBearer()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Vérifie un mot de passe contre son hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash un mot de passe"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Crée un token JWT"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    
    print(f"[CREATE_TOKEN] Data: {to_encode}, Secret: {settings.secret_key[:10]}...")
    
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    """Décode un token JWT"""
    print(f"[DECODE_TOKEN] Token: {token[:50]}..., Secret: {settings.secret_key[:10]}...")
    
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        print(f"[DECODE_TOKEN] Success: {payload}")
        return payload
    except JWTError as e:
        print(f"[DECODE_TOKEN] Error: {e}")
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Récupère l'utilisateur courant à partir du token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Identifiants invalides",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = credentials.credentials
    print(f"[GET_USER] Token received: {token[:50] if token else 'None'}...")
    
    payload = decode_token(token)

    if payload is None:
        print("[GET_USER] Payload is None!")
        raise credentials_exception

    user_id_str = payload.get("sub")
    print(f"[GET_USER] User ID from token: {user_id_str}")
    
    if user_id_str is None:
        print("[GET_USER] user_id is None!")
        raise credentials_exception
    
    # Convertir string en int (le sub est stocké comme string dans le token)
    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        print(f"[GET_USER] Cannot convert user_id to int: {user_id_str}")
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        print(f"[GET_USER] No user with id {user_id}")
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé"
        )

    print(f"[GET_USER] Success: {user.email}")
    return user


async def get_current_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Vérifie que l'utilisateur est administrateur"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs"
        )
    return current_user


async def get_current_tech_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Vérifie que l'utilisateur est au moins technicien"""
    if current_user.role not in ["admin", "technician"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux techniciens"
        )
    return current_user
