from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.user import User, UserRole
from app.schemas.audit import AuditLogOut

router = APIRouter(prefix="/audit-logs", tags=["audit logs"])


@router.get("", response_model=list[AuditLogOut])
def list_audit_logs(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
):
    """Most recent audit entries first."""
    stmt = (
        select(AuditLog)
        .options(selectinload(AuditLog.user))
        .order_by(AuditLog.timestamp.desc(), AuditLog.id.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt))