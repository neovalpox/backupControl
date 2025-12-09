"""
Routes avancees pour recuperation et analyse des e-mails
Version 2 - Creation automatique des clients et sauvegardes
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import asyncio
import re
from loguru import logger

from app.core.database import get_db
from app.core.security import get_current_user, get_current_tech_user
from app.models.user import User
from app.models.email import Email
from app.models.client import Client
from app.models.backup import Backup, BackupEvent
from app.services.settings_service import get_email_settings, get_ai_settings

router = APIRouter()


# ============================================
# Schemas
# ============================================

class FetchAndAnalyzeRequest(BaseModel):
    limit: int = 500
    folder: str = "INBOX"
    analyze: bool = True


class AnalysisResult(BaseModel):
    message_id: str
    subject: str
    sender: str
    received_at: Optional[datetime] = None
    is_backup_notification: bool
    backup_type: Optional[str] = None
    status: Optional[str] = None
    source_nas: Optional[str] = None
    task_name: Optional[str] = None
    confidence: int = 0


class FetchAndAnalyzeResponse(BaseModel):
    success: bool
    message: str
    total_fetched: int = 0
    total_analyzed: int = 0
    backup_notifications_found: int = 0
    clients_created: int = 0
    backups_created: int = 0
    events_created: int = 0
    by_status: Dict[str, int] = {}
    by_type: Dict[str, int] = {}
    emails: List[AnalysisResult] = []
    errors: List[str] = []


class AnalysisProgress(BaseModel):
    status: str
    progress: int
    current_step: str
    total_emails: int
    processed_emails: int
    errors: List[str]


# Variable globale pour le suivi de progression
_analysis_progress: Dict[str, Any] = {
    "status": "idle",
    "progress": 0,
    "current_step": "",
    "total_emails": 0,
    "processed_emails": 0,
    "errors": []
}


# ============================================
# Office 365 Email Fetching
# ============================================

async def fetch_office365_emails(
    client_id: str,
    client_secret: str,
    tenant_id: str,
    email_address: str,
    folder: str = "INBOX",
    limit: int = 500
) -> List[Dict[str, Any]]:
    """Recupere les emails via Microsoft Graph API"""
    import msal
    import httpx
    
    app = msal.ConfidentialClientApplication(
        client_id,
        authority=f"https://login.microsoftonline.com/{tenant_id}",
        client_credential=client_secret
    )
    
    result = app.acquire_token_for_client(
        scopes=["https://graph.microsoft.com/.default"]
    )
    
    if "access_token" not in result:
        raise Exception(f"Erreur d'authentification: {result.get('error_description', 'Unknown')}")
    
    access_token = result["access_token"]
    emails = []
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        headers = {"Authorization": f"Bearer {access_token}"}
        
        url = f"https://graph.microsoft.com/v1.0/users/{email_address}/mailFolders/{folder}/messages"
        params = {
            "$top": min(50, limit),
            "$orderby": "receivedDateTime desc",
            "$select": "id,subject,from,receivedDateTime,bodyPreview,body,isRead"
        }
        
        fetched = 0
        while fetched < limit:
            response = await client.get(url, headers=headers, params=params)
            
            if response.status_code != 200:
                raise Exception(f"Erreur Graph API: {response.status_code} - {response.text}")
            
            data = response.json()
            messages = data.get("value", [])
            
            if not messages:
                break
            
            for msg in messages:
                body_content = msg.get("body", {}).get("content", "")
                body_type = msg.get("body", {}).get("contentType", "text")
                
                if body_type == "html":
                    body_text = re.sub(r'<[^>]+>', ' ', body_content)
                    body_text = re.sub(r'\s+', ' ', body_text).strip()
                else:
                    body_text = body_content
                
                emails.append({
                    "message_id": msg.get("id"),
                    "subject": msg.get("subject", "(Sans sujet)"),
                    "sender": msg.get("from", {}).get("emailAddress", {}).get("address", "unknown"),
                    "received_at": msg.get("receivedDateTime"),
                    "body_preview": msg.get("bodyPreview", ""),
                    "body_text": body_text[:10000],
                    "body_html": body_content if body_type == "html" else None
                })
                fetched += 1
                
                if fetched >= limit:
                    break
            
            next_link = data.get("@odata.nextLink")
            if next_link and fetched < limit:
                url = next_link
                params = {}
            else:
                break
    
    return emails


# ============================================
# AI Analysis
# ============================================

async def analyze_email_with_ai(
    email_data: Dict[str, Any],
    ai_provider: str,
    api_key: str,
    model: str = None
) -> Dict[str, Any]:
    """Analyse un email avec l'IA"""
    import json
    
    email_content = f"""
Sujet: {email_data.get('subject', '')}
De: {email_data.get('sender', '')}
Date: {email_data.get('received_at', '')}

Contenu:
{email_data.get('body_text', email_data.get('body_preview', ''))[:3000]}
"""
    
    system_prompt = """Tu es un expert en analyse d'e-mails de notifications de sauvegarde IT.
Analyse l'email et determine:
1. S'il s'agit d'une notification de sauvegarde (ou autre: securite, UPS, mise a jour, etc)
2. Le type de sauvegarde: hyper_backup, active_backup, rsync, veeam, acronis, windows_backup, other
3. Le statut: success, failure, warning
4. Le NAS/serveur source (souvent au format NXXX## comme NABO03, NMER01, etc)
5. Le NAS/serveur destination
6. Le nom de la tache de sauvegarde
7. Les devices/peripheriques sauvegardes (pour Active Backup)

Reponds UNIQUEMENT en JSON valide:
{
    "is_backup_notification": boolean,
    "notification_type": "backup" | "security" | "update" | "ups" | "other",
    "backup_type": "hyper_backup" | "active_backup" | "rsync" | "veeam" | "acronis" | "windows_backup" | "other" | null,
    "status": "success" | "failure" | "warning" | null,
    "source_nas": string | null,
    "destination_nas": string | null,
    "task_name": string | null,
    "devices": [string] | null,
    "client_name": string | null,
    "confidence": number (0-100)
}"""

    try:
        if ai_provider == "claude":
            import anthropic
            
            client = anthropic.Anthropic(api_key=api_key)
            message = client.messages.create(
                model=model or "claude-3-haiku-20240307",
                max_tokens=512,
                system=system_prompt,
                messages=[{"role": "user", "content": f"Analyse cet e-mail:\n\n{email_content}"}]
            )
            response_text = message.content[0].text
            
        elif ai_provider == "openai":
            from openai import OpenAI
            
            client = OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model=model or "gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Analyse cet e-mail:\n\n{email_content}"}
                ],
                response_format={"type": "json_object"},
                max_tokens=512
            )
            response_text = response.choices[0].message.content
        else:
            raise ValueError(f"Provider IA non supporte: {ai_provider}")
        
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            return json.loads(json_match.group())
        return json.loads(response_text)
        
    except Exception as e:
        logger.error(f"Erreur analyse IA: {e}")
        return {
            "is_backup_notification": False,
            "backup_type": None,
            "status": None,
            "source_nas": None,
            "task_name": None,
            "confidence": 0,
            "error": str(e)
        }


# ============================================
# Client/Backup Auto-Creation
# ============================================

async def get_or_create_client(
    db: AsyncSession,
    nas_identifier: str
) -> tuple:
    """Recupere ou cree un client base sur l'identifiant NAS. Retourne (client, created)"""
    from sqlalchemy import cast, String, text
    from sqlalchemy.dialects.postgresql import JSONB
    
    prefix_match = re.match(r'^(N[A-Z]{2,4})\d*', nas_identifier.upper())
    client_prefix = prefix_match.group(1) if prefix_match else nas_identifier.upper()
    
    # Chercher par short_name d'abord
    result = await db.execute(
        select(Client).where(Client.short_name == client_prefix)
    )
    client = result.scalar_one_or_none()
    
    # Sinon chercher par nas_identifiers (en utilisant une requete compatible JSON)
    if not client:
        result = await db.execute(
            select(Client).where(
                cast(Client.nas_identifiers, String).ilike(f'%"{nas_identifier.upper()}"%')
            )
        )
        client = result.scalar_one_or_none()
    
    if client:
        if client.nas_identifiers is None:
            client.nas_identifiers = []
        if nas_identifier.upper() not in client.nas_identifiers:
            client.nas_identifiers = client.nas_identifiers + [nas_identifier.upper()]
        return client, False
    
    client = Client(
        name=f"Client {client_prefix}",
        short_name=client_prefix,
        description=f"Client cree automatiquement depuis l'analyse des emails",
        nas_identifiers=[nas_identifier.upper()],
        is_active=True
    )
    db.add(client)
    await db.flush()
    
    logger.info(f"Client cree automatiquement: {client.name} (NAS: {nas_identifier})")
    return client, True


async def get_or_create_backup(
    db: AsyncSession,
    client: Client,
    analysis: Dict[str, Any],
    email_data: Dict[str, Any]
) -> tuple:
    """Recupere ou cree une tache de sauvegarde. Retourne (backup, created)"""
    
    source_nas = (analysis.get("source_nas") or "UNKNOWN").upper()
    backup_type = analysis.get("backup_type") or "other"
    task_name = analysis.get("task_name") or ""
    destination_nas = analysis.get("destination_nas") or ""
    devices = analysis.get("devices") or []
    
    if task_name:
        backup_name = f"{source_nas} - {task_name}"
    elif backup_type == "active_backup" and devices:
        backup_name = f"{source_nas} - Active Backup - {', '.join(devices[:3])}"
    else:
        backup_name = f"{source_nas} - {backup_type}"
    
    # Chercher une sauvegarde existante similaire
    query = select(Backup).where(
        Backup.client_id == client.id,
        Backup.source_nas == source_nas,
        Backup.backup_type == backup_type
    )
    
    if task_name:
        query = query.where(
            or_(
                Backup.name == backup_name,
                Backup.name.ilike(f"%{task_name}%")
            )
        )
    
    result = await db.execute(query)
    backup = result.scalar_one_or_none()
    
    if backup:
        return backup, False
    
    backup = Backup(
        client_id=client.id,
        name=backup_name,
        backup_type=backup_type,
        source_nas=source_nas,
        destination_nas=destination_nas.upper() if destination_nas else None,
        source_device=", ".join(devices) if devices else None,
        current_status="unknown",
        is_active=True
    )
    db.add(backup)
    await db.flush()
    
    logger.info(f"Sauvegarde creee automatiquement: {backup.name}")
    return backup, True


async def create_backup_event(
    db: AsyncSession,
    backup: Backup,
    email: Email,
    analysis: Dict[str, Any]
) -> tuple:
    """Cree un evenement de sauvegarde. Retourne (event, created)"""
    
    status = analysis.get("status") or "unknown"
    event_type = status if status in ["success", "failure", "warning"] else "unknown"
    
    result = await db.execute(
        select(BackupEvent).where(
            BackupEvent.backup_id == backup.id,
            BackupEvent.email_id == email.id
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing, False
    
    event = BackupEvent(
        backup_id=backup.id,
        email_id=email.id,
        event_type=event_type,
        event_date=email.received_at or datetime.utcnow(),
        message=email.subject,
        parsed_data=analysis
    )
    db.add(event)
    
    if event_type == "success":
        backup.last_success_at = email.received_at
        backup.total_success_count = (backup.total_success_count or 0) + 1
        backup.current_status = "ok"
    elif event_type == "failure":
        backup.last_failure_at = email.received_at
        backup.total_failure_count = (backup.total_failure_count or 0) + 1
        backup.current_status = "failed"
    
    backup.last_event_at = email.received_at
    
    await db.flush()
    return event, True


# ============================================
# Endpoints
# ============================================

@router.get("/analysis/progress", response_model=AnalysisProgress)
async def get_analysis_progress(
    current_user: User = Depends(get_current_user)
):
    """Retourne la progression de l'analyse en cours"""
    return AnalysisProgress(**_analysis_progress)


@router.post("/fetch-and-analyze", response_model=FetchAndAnalyzeResponse)
async def fetch_and_analyze_emails(
    request: FetchAndAnalyzeRequest,
    current_user: User = Depends(get_current_tech_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Recupere les derniers emails, les analyse avec l'IA,
    et cree automatiquement les clients/sauvegardes/evenements.
    """
    global _analysis_progress
    
    clients_created = 0
    backups_created = 0
    events_created = 0
    
    try:
        _analysis_progress = {
            "status": "fetching",
            "progress": 0,
            "current_step": "Recuperation des parametres...",
            "total_emails": 0,
            "processed_emails": 0,
            "errors": []
        }
        
        email_settings = await get_email_settings(db)
        ai_settings = await get_ai_settings(db)
        
        email_type = email_settings.get("email_type", "imap")
        
        _analysis_progress["current_step"] = f"Connexion {email_type}..."
        _analysis_progress["progress"] = 5
        
        emails = []
        
        if email_type == "office365":
            client_id = email_settings.get("office365_client_id")
            client_secret = email_settings.get("office365_client_secret")
            tenant_id = email_settings.get("office365_tenant_id")
            email_address = email_settings.get("email_address")
            
            if not all([client_id, client_secret, tenant_id, email_address]):
                return FetchAndAnalyzeResponse(
                    success=False,
                    message="Configuration Office 365 incomplete",
                    errors=["Verifiez Client ID, Secret, Tenant ID et adresse email"]
                )
            
            _analysis_progress["current_step"] = f"Recuperation de {request.limit} emails Office 365..."
            emails = await fetch_office365_emails(
                client_id, client_secret, tenant_id, email_address,
                request.folder, request.limit
            )
        else:
            return FetchAndAnalyzeResponse(
                success=False,
                message=f"Type d'email non supporte pour l'instant: {email_type}",
                errors=["Seul Office 365 est supporte actuellement"]
            )
        
        _analysis_progress["total_emails"] = len(emails)
        _analysis_progress["progress"] = 20
        _analysis_progress["current_step"] = f"{len(emails)} emails recuperes"
        
        if not emails:
            return FetchAndAnalyzeResponse(
                success=True,
                message="Aucun email trouve",
                total_fetched=0
            )
        
        results = []
        errors = []
        
        ai_provider = ai_settings.get("ai_provider", "claude")
        api_key = ai_settings.get("claude_api_key") if ai_provider == "claude" else ai_settings.get("openai_api_key")
        model = ai_settings.get("ai_model")
        
        if not api_key:
            return FetchAndAnalyzeResponse(
                success=False,
                message=f"Cle API {ai_provider} non configuree",
                total_fetched=len(emails),
                errors=[f"Configurez la cle API {ai_provider} dans les parametres"]
            )
        
        _analysis_progress["status"] = "analyzing"
        
        for i, email_data in enumerate(emails):
            try:
                progress = 20 + int((i / len(emails)) * 75)
                _analysis_progress["progress"] = progress
                _analysis_progress["processed_emails"] = i + 1
                _analysis_progress["current_step"] = f"Analyse {i+1}/{len(emails)}: {email_data.get('subject', '')[:40]}..."
                
                analysis = await analyze_email_with_ai(email_data, ai_provider, api_key, model)
                
                existing = await db.execute(
                    select(Email).where(Email.message_id == email_data["message_id"])
                )
                db_email = existing.scalar_one_or_none()
                
                received_at = email_data.get("received_at")
                if isinstance(received_at, str):
                    try:
                        received_at = datetime.fromisoformat(received_at.replace("Z", "+00:00"))
                    except:
                        received_at = datetime.utcnow()
                
                if not db_email:
                    db_email = Email(
                        message_id=email_data["message_id"],
                        subject=email_data.get("subject", ""),
                        sender=email_data.get("sender", ""),
                        received_at=received_at,
                        body_text=email_data.get("body_text", ""),
                        body_html=email_data.get("body_html"),
                        is_backup_notification=analysis.get("is_backup_notification", False),
                        detected_type=analysis.get("backup_type"),
                        detected_status=analysis.get("status"),
                        detected_nas=analysis.get("source_nas"),
                        ai_extracted_data=analysis,
                        ai_confidence=analysis.get("confidence", 0),
                        is_processed=True,
                        processed_at=datetime.utcnow()
                    )
                    db.add(db_email)
                    await db.flush()
                else:
                    db_email.is_backup_notification = analysis.get("is_backup_notification", False)
                    db_email.detected_type = analysis.get("backup_type")
                    db_email.detected_status = analysis.get("status")
                    db_email.detected_nas = analysis.get("source_nas")
                    db_email.ai_extracted_data = analysis
                    db_email.ai_confidence = analysis.get("confidence", 0)
                    db_email.is_processed = True
                    db_email.processed_at = datetime.utcnow()
                
                if analysis.get("is_backup_notification") and analysis.get("source_nas"):
                    client, client_new = await get_or_create_client(db, analysis["source_nas"])
                    if client_new:
                        clients_created += 1
                    
                    backup, backup_new = await get_or_create_backup(db, client, analysis, email_data)
                    if backup_new:
                        backups_created += 1
                    
                    event, event_new = await create_backup_event(db, backup, db_email, analysis)
                    if event_new:
                        events_created += 1
                    
                    db_email.detected_client_id = client.id
                
                results.append(AnalysisResult(
                    message_id=email_data["message_id"],
                    subject=email_data.get("subject", ""),
                    sender=email_data.get("sender", ""),
                    received_at=received_at,
                    is_backup_notification=analysis.get("is_backup_notification", False),
                    backup_type=analysis.get("backup_type"),
                    status=analysis.get("status"),
                    source_nas=analysis.get("source_nas"),
                    task_name=analysis.get("task_name"),
                    confidence=analysis.get("confidence", 0)
                ))
                
                if (i + 1) % 10 == 0:
                    await db.commit()
                    await asyncio.sleep(0.5)
                    
            except Exception as e:
                logger.error(f"Erreur analyse email {email_data.get('subject', '')}: {e}")
                errors.append(f"Erreur: {str(e)[:100]}")
                _analysis_progress["errors"].append(str(e))
        
        await db.commit()
        
        backup_count = sum(1 for r in results if r.is_backup_notification)
        by_status = {}
        by_type = {}
        
        for r in results:
            if r.is_backup_notification:
                status = r.status or "unknown"
                by_status[status] = by_status.get(status, 0) + 1
                
                btype = r.backup_type or "unknown"
                by_type[btype] = by_type.get(btype, 0) + 1
        
        _analysis_progress["status"] = "complete"
        _analysis_progress["progress"] = 100
        _analysis_progress["current_step"] = "Analyse terminee"
        
        return FetchAndAnalyzeResponse(
            success=True,
            message=f"Analyse terminee: {backup_count} notifications, {clients_created} clients, {backups_created} sauvegardes, {events_created} evenements",
            total_fetched=len(emails),
            total_analyzed=len(results),
            backup_notifications_found=backup_count,
            clients_created=clients_created,
            backups_created=backups_created,
            events_created=events_created,
            by_status=by_status,
            by_type=by_type,
            emails=results,
            errors=errors
        )
        
    except Exception as e:
        logger.error(f"Erreur fetch-and-analyze: {e}")
        _analysis_progress["status"] = "error"
        _analysis_progress["current_step"] = str(e)
        
        return FetchAndAnalyzeResponse(
            success=False,
            message=f"Erreur: {str(e)}",
            errors=[str(e)]
        )


@router.get("/analyzed")
async def get_analyzed_emails(
    backup_only: bool = False,
    limit: int = 200,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Liste les emails analyses avec pagination"""
    
    query = select(Email).where(Email.is_processed == True)
    
    if backup_only:
        query = query.where(Email.is_backup_notification == True)
    
    query = query.order_by(Email.received_at.desc()).offset(offset).limit(limit)
    
    result = await db.execute(query)
    emails = result.scalars().all()
    
    count_query = select(func.count(Email.id)).where(Email.is_processed == True)
    if backup_only:
        count_query = count_query.where(Email.is_backup_notification == True)
    total = (await db.execute(count_query)).scalar()
    
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "emails": [
            {
                "id": e.id,
                "message_id": e.message_id,
                "subject": e.subject,
                "sender": e.sender,
                "received_at": e.received_at.isoformat() if e.received_at else None,
                "is_backup_notification": e.is_backup_notification,
                "detected_type": e.detected_type,
                "detected_status": e.detected_status,
                "detected_nas": e.detected_nas,
                "ai_confidence": e.ai_confidence,
                "body_preview": e.body_text[:200] if e.body_text else None
            }
            for e in emails
        ]
    }


@router.get("/analyzed/{email_id}")
async def get_analyzed_email_detail(
    email_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Detail d'un email analyse"""
    
    result = await db.execute(
        select(Email).where(Email.id == email_id)
    )
    email = result.scalar_one_or_none()
    
    if not email:
        raise HTTPException(status_code=404, detail="Email non trouve")
    
    return {
        "id": email.id,
        "message_id": email.message_id,
        "subject": email.subject,
        "sender": email.sender,
        "received_at": email.received_at.isoformat() if email.received_at else None,
        "body_text": email.body_text,
        "body_html": email.body_html,
        "is_backup_notification": email.is_backup_notification,
        "detected_type": email.detected_type,
        "detected_status": email.detected_status,
        "detected_nas": email.detected_nas,
        "detected_client_id": email.detected_client_id,
        "ai_confidence": email.ai_confidence,
        "ai_extracted_data": email.ai_extracted_data,
        "is_processed": email.is_processed,
        "processed_at": email.processed_at.isoformat() if email.processed_at else None
    }


@router.get("/backup-summary")
async def get_backup_summary(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Resume des sauvegardes analysees"""
    from datetime import timedelta
    
    since = datetime.utcnow() - timedelta(days=days)
    
    result = await db.execute(
        select(func.count(Email.id))
        .where(Email.is_backup_notification == True)
        .where(Email.received_at >= since)
    )
    total = result.scalar() or 0
    
    result = await db.execute(
        select(Email.detected_status, func.count(Email.id))
        .where(Email.is_backup_notification == True)
        .where(Email.received_at >= since)
        .group_by(Email.detected_status)
    )
    by_status = {row[0] or "unknown": row[1] for row in result.all()}
    
    result = await db.execute(
        select(Email.detected_type, func.count(Email.id))
        .where(Email.is_backup_notification == True)
        .where(Email.received_at >= since)
        .group_by(Email.detected_type)
    )
    by_type = {row[0] or "unknown": row[1] for row in result.all()}
    
    result = await db.execute(
        select(Email.detected_nas, func.count(Email.id))
        .where(Email.is_backup_notification == True)
        .where(Email.received_at >= since)
        .where(Email.detected_nas.isnot(None))
        .group_by(Email.detected_nas)
    )
    by_nas = {row[0]: row[1] for row in result.all()}
    
    result = await db.execute(
        select(Email)
        .where(Email.is_backup_notification == True)
        .where(Email.detected_status == "failure")
        .where(Email.received_at >= since)
        .order_by(Email.received_at.desc())
        .limit(10)
    )
    recent_failures = [
        {
            "id": e.id,
            "subject": e.subject,
            "nas": e.detected_nas,
            "type": e.detected_type,
            "date": e.received_at.isoformat() if e.received_at else None
        }
        for e in result.scalars().all()
    ]
    
    clients_count = (await db.execute(select(func.count(Client.id)))).scalar() or 0
    backups_count = (await db.execute(select(func.count(Backup.id)))).scalar() or 0
    
    success_count = by_status.get("success", 0)
    success_rate = round((success_count / total * 100) if total > 0 else 0, 1)
    
    return {
        "period_days": days,
        "total_backup_notifications": total,
        "by_status": by_status,
        "by_type": by_type,
        "by_nas": by_nas,
        "recent_failures": recent_failures,
        "success_rate": success_rate,
        "clients_count": clients_count,
        "backups_count": backups_count
    }
