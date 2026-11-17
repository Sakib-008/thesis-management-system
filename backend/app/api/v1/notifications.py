from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.notifications import NotificationOut, UnreadOut
from app.services import notification_service as svc

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    unread_only: bool = False, limit: int = 30, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """The person's own notifications, newest first. Reminders that are due are created first."""
    svc.refresh_reminders(db, user, force=True)
    db.commit()
    return svc.list_for(db, user, unread_only, limit)


@router.get("/unread-count", response_model=UnreadOut)
def unread_count(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if svc.refresh_reminders(db, user):
        db.commit()
    return UnreadOut(unread=svc.unread_count(db, user))


@router.post("/read-all")
def read_all(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    changed = svc.mark_all_read(db, user)
    db.commit()
    return {"marked": changed}


@router.post("/{notification_id}/read")
def read_one(notification_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    svc.mark_read(db, user, notification_id)
    db.commit()
    return {"ok": True}
