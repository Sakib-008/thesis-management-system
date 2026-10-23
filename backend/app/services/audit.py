from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def log_audit(db: Session, user_id: int | None, action: str, entity: str,
              entity_id: int | None = None, meta: dict | None = None) -> None:
    """Add an audit row to the current transaction. The caller commits."""
    db.add(AuditLog(user_id=user_id, action=action, entity=entity, entity_id=entity_id, meta=meta))