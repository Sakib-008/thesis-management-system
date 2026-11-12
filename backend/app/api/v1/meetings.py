from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.meetings import AcceptIn, CompleteIn, DeclineIn, MeetingIn, MeetingOut
from app.services import meeting_service as svc
router = APIRouter(prefix="/meetings", tags=["meetings"])
student_only = require_roles(UserRole.student)
supervisor_only = require_roles(UserRole.supervisor)
@router.get("", response_model=list[MeetingOut])
def list_meetings(status: str | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """A student sees their own meetings, a supervisor those of their students, staff see all."""
    return svc.list_for(db, user, status)
@router.post("", response_model=MeetingOut)
def request_meeting(body: MeetingIn, user: User = Depends(student_only), db: Session = Depends(get_db)):
    meeting = svc.request_meeting(db, user, body)
    db.commit()
    return svc.serialize(db, meeting)
@router.get("/{meeting_id}", response_model=MeetingOut)
def get_meeting(meeting_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.get(db, meeting_id, user)
@router.post("/{meeting_id}/cancel", response_model=MeetingOut)
def cancel_meeting(meeting_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    meeting = svc.cancel(db, meeting_id, user)
    db.commit()
    return svc.serialize(db, meeting)
@router.post("/{meeting_id}/accept", response_model=MeetingOut)
def accept_meeting(
    meeting_id: int, body: AcceptIn, user: User = Depends(supervisor_only), db: Session = Depends(get_db)
):
    meeting = svc.accept(db, meeting_id, user, body)
    db.commit()
    return svc.serialize(db, meeting)
@router.post("/{meeting_id}/decline", response_model=MeetingOut)
def decline_meeting(
    meeting_id: int, body: DeclineIn, user: User = Depends(supervisor_only), db: Session = Depends(get_db)
):
    meeting = svc.decline(db, meeting_id, user, body.reason)
    db.commit()
    return svc.serialize(db, meeting)
@router.post("/{meeting_id}/complete", response_model=MeetingOut)
def complete_meeting(
    meeting_id: int, body: CompleteIn, user: User = Depends(supervisor_only), db: Session = Depends(get_db)
):
    """Record what was discussed. This opens the weekly report for the student."""
    meeting = svc.complete(db, meeting_id, user, body)
    db.commit()
    return svc.serialize(db, meeting)