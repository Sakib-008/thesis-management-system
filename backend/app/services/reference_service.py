from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError


def get_or_404(db: Session, model, obj_id: int, label: str):
    obj = db.get(model, obj_id)
    if obj is None:
        raise NotFoundError(f"{label} not found")
    return obj


def save_new(db: Session, obj, duplicate_message: str):
    db.add(obj)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise ConflictError(duplicate_message)
    return obj


def save_changes(db: Session, duplicate_message: str) -> None:
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise ConflictError(duplicate_message)


def remove(db: Session, obj, in_use_message: str) -> None:
    db.delete(obj)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise ConflictError(in_use_message)