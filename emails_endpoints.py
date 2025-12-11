

# ============================================
# Endpoints pour l'analyse IA des emails
# ============================================

analysis_state = {
    "status": "idle",
    "progress": 0,
    "current_step": "",
    "total_fetched": 0,
    "total_analyzed": 0
}


class BackupSummaryResponse(BaseModel):
    period_days: int
    total_backup_notifications: int
    by_status: Dict[str, int]
    by_type: Dict[str, int]
    by_nas: Dict[str, int]
    recent_failures: List[Dict]
    success_rate: float
    clients_count: int
    backups_count: int


class AnalyzedEmailResponse(BaseModel):
    id: int
    message_id: str
    subject: str
    sender: str
    received_at: Optional[datetime]
    is_backup_notification: bool
    detected_type: Optional[str]
    detected_status: Optional[str]
    detected_nas: Optional[str]
    ai_confidence: Optional[int]
    body_preview: Optional[str] = None

    class Config:
        from_attributes = True


class AnalyzedEmailListResponse(BaseModel):
    emails: List[AnalyzedEmailResponse]
    total: int


@router.get("/backup-summary", response_model=BackupSummaryResponse)
async def get_backup_summary(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Resume des notifications de sauvegarde sur une periode donnee"""
    from sqlalchemy import func
    from datetime import timedelta
    from app.models.client import Client
    from app.models.backup import Backup

    cutoff_date = datetime.utcnow() - timedelta(days=days)

    result = await db.execute(
        select(func.count(Email.id))
        .where(Email.is_backup_notification == True)
        .where(Email.received_at >= cutoff_date)
    )
    total_backup = result.scalar() or 0

    result = await db.execute(
        select(Email.detected_status, func.count(Email.id))
        .where(Email.is_backup_notification == True)
        .where(Email.received_at >= cutoff_date)
        .group_by(Email.detected_status)
    )
    by_status = {(row[0] or "unknown"): row[1] for row in result.all()}

    result = await db.execute(
        select(Email.detected_type, func.count(Email.id))
        .where(Email.is_backup_notification == True)
        .where(Email.received_at >= cutoff_date)
        .group_by(Email.detected_type)
    )
    by_type = {(row[0] or "unknown"): row[1] for row in result.all()}

    result = await db.execute(
        select(Email.detected_nas, func.count(Email.id))
        .where(Email.is_backup_notification == True)
        .where(Email.received_at >= cutoff_date)
        .group_by(Email.detected_nas)
    )
    by_nas = {(row[0] or "unknown"): row[1] for row in result.all()}

    result = await db.execute(
        select(Email)
        .where(Email.is_backup_notification == True)
        .where(Email.detected_status == "failure")
        .where(Email.received_at >= cutoff_date)
        .order_by(Email.received_at.desc())
        .limit(10)
    )
    failures = result.scalars().all()
    recent_failures = [
        {
            "id": e.id,
            "subject": e.subject,
            "nas": e.detected_nas,
            "type": e.detected_type,
            "date": e.received_at.isoformat() if e.received_at else None
        }
        for e in failures
    ]

    success_count = by_status.get("success", 0)
    failure_count = by_status.get("failure", 0)
    total_with_status = success_count + failure_count
    success_rate = (success_count / total_with_status * 100) if total_with_status > 0 else 0

    result = await db.execute(select(func.count(Client.id)))
    clients_count = result.scalar() or 0

    result = await db.execute(select(func.count(Backup.id)))
    backups_count = result.scalar() or 0

    return BackupSummaryResponse(
        period_days=days,
        total_backup_notifications=total_backup,
        by_status=by_status,
        by_type=by_type,
        by_nas=by_nas,
        recent_failures=recent_failures,
        success_rate=round(success_rate, 1),
        clients_count=clients_count,
        backups_count=backups_count
    )


@router.get("/analyzed", response_model=AnalyzedEmailListResponse)
async def get_analyzed_emails(
    backup_only: bool = False,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Liste des emails analyses avec pagination"""
    from sqlalchemy import func

    query = select(Email)

    if backup_only:
        query = query.where(Email.is_backup_notification == True)

    count_query = select(func.count(Email.id))
    if backup_only:
        count_query = count_query.where(Email.is_backup_notification == True)
    result = await db.execute(count_query)
    total = result.scalar() or 0

    query = query.order_by(Email.received_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    emails = result.scalars().all()

    return AnalyzedEmailListResponse(
        emails=[
            AnalyzedEmailResponse(
                id=e.id,
                message_id=e.message_id,
                subject=e.subject,
                sender=e.sender,
                received_at=e.received_at,
                is_backup_notification=e.is_backup_notification,
                detected_type=e.detected_type,
                detected_status=e.detected_status,
                detected_nas=e.detected_nas,
                ai_confidence=e.ai_confidence,
                body_preview=e.body_text[:200] if e.body_text else None
            )
            for e in emails
        ],
        total=total
    )


@router.get("/analyzed/{email_id}")
async def get_analyzed_email_detail(
    email_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Detail complet d un email analyse"""
    result = await db.execute(
        select(Email).where(Email.id == email_id)
    )
    email = result.scalar_one_or_none()

    if not email:
        raise HTTPException(status_code=404, detail="Email non trouve")

    return {
        "id": email.id,
        "subject": email.subject,
        "sender": email.sender,
        "received_at": email.received_at.isoformat() if email.received_at else None,
        "body_text": email.body_text,
        "body_html": getattr(email, "body_html", None),
        "is_backup_notification": email.is_backup_notification,
        "detected_type": email.detected_type,
        "detected_status": email.detected_status,
        "detected_nas": email.detected_nas,
        "ai_confidence": email.ai_confidence,
        "ai_extracted_data": email.ai_extracted_data
    }


@router.get("/analysis/progress")
async def get_analysis_progress(
    current_user: User = Depends(get_current_user)
):
    """Retourne la progression de l analyse en cours"""
    return analysis_state
