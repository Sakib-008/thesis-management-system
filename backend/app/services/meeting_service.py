from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.errors import ConflictError, InvalidInputError, NotFoundError
from app.models.meetings import Meeting, WeeklyReport
from app.models.profile import Student, Supervisor
from app.models.thesis import ProposalStatus, SupervisorAssignment, ThesisProposal, thesis_members
from app.models.user import User, UserRole
from app.schemas.meetings import AcceptIn, CompleteIn, MeetingIn, MeetingOut
from app.services import proposal_service
from app.services.audit import log_audit
MAX_OPEN_REQUESTS = 3
def _now() -> datetime:
    return datetime.now(timezone.utc)
def aware(value: datetime) -> datetime:
    """A date sent without a time zone is taken as UTC."""
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
# ------------------------------------------- who belongs to which thesis (shared with the report service)
def proposal_of_thesis(db: Session, thesis_id: int) -> ThesisProposal | None:
    return db.scalar(select(ThesisProposal).where(ThesisProposal.thesis_id == thesis_id))
def supervisor_of_thesis(db: Session, thesis_id: int) -> Supervisor | None:
    return db.scalar(
        select(Supervisor)
        .join(SupervisorAssignment, SupervisorAssignment.supervisor_id == Supervisor.id)
        .join(ThesisProposal, ThesisProposal.id == SupervisorAssignment.proposal_id)
        .where(ThesisProposal.thesis_id == thesis_id)
    )
def is_assigned_supervisor(db: Session, thesis_id: int, user: User) -> bool:
    supervisor = supervisor_of_thesis(db, thesis_id)
    return supervisor is not None and supervisor.user_id == user.id
def students_of_thesis(db: Session, thesis_id: int) -> list[Student]:
    return list(db.scalars(
        select(Student).join(thesis_members, thesis_members.c.student_id == Student.id)
        .where(thesis_members.c.thesis_id == thesis_id).order_by(Student.id)
    ))
def own_thesis_id(db: Session, user: User) -> int | None:
    proposal = proposal_service.get_own(db, user)
    return proposal.thesis_id if proposal else None
def can_view_thesis(db: Session, thesis_id: int, user: User) -> bool:
    if user.role in (UserRole.coordinator, UserRole.admin):
        return True
    if user.role == UserRole.student:
        return own_thesis_id(db, user) == thesis_id
    if user.role == UserRole.supervisor:
        return is_assigned_supervisor(db, thesis_id, user)
    return False
# --------------------------------------------------------------------------- output
def serialize(db: Session, meeting: Meeting) -> MeetingOut:
    proposal = proposal_of_thesis(db, meeting.thesis_id)
    supervisor = supervisor_of_thesis(db, meeting.thesis_id)
    report = db.scalar(select(WeeklyReport).where(WeeklyReport.meeting_id == meeting.id))
    return MeetingOut(
        id=meeting.id, thesis_id=meeting.thesis_id, proposal_id=proposal.id if proposal else None,
        proposal_title=proposal.title if proposal else "",
        student_names=[s.user.full_name for s in students_of_thesis(db, meeting.thesis_id)],
        supervisor_name=supervisor.user.full_name if supervisor else None,
        meeting_date=meeting.meeting_date, agenda=meeting.agenda or "", mode=meeting.mode, location=meeting.location,
        status=meeting.status, decline_reason=meeting.decline_reason, discussion=meeting.discussion or "",
        decisions=meeting.decisions or "", next_meeting_date=meeting.next_meeting_date,
        completed_at=meeting.completed_at, created_at=meeting.created_at,
        report_id=report.id if report else None, report_status=report.status if report else None,
    )
def _get_visible(db: Session, meeting_id: int, user: User) -> Meeting:
    meeting = db.get(Meeting, meeting_id)
    if meeting is None or not can_view_thesis(db, meeting.thesis_id, user):
        raise NotFoundError("Meeting not found")
    return meeting
def get(db: Session, meeting_id: int, user: User) -> MeetingOut:
    return serialize(db, _get_visible(db, meeting_id, user))
def list_for(db: Session, user: User, status: str | None = None) -> list[MeetingOut]:
    stmt = select(Meeting)
    if user.role == UserRole.student:
        thesis_id = own_thesis_id(db, user)
        if thesis_id is None:
            return []
        stmt = stmt.where(Meeting.thesis_id == thesis_id)
    elif user.role == UserRole.supervisor:
        stmt = (
            stmt.join(ThesisProposal, ThesisProposal.thesis_id == Meeting.thesis_id)
            .join(SupervisorAssignment, SupervisorAssignment.proposal_id == ThesisProposal.id)
            .join(Supervisor, Supervisor.id == SupervisorAssignment.supervisor_id)
            .where(Supervisor.user_id == user.id)
        )
    if status:
        stmt = stmt.where(Meeting.status == status)
    return [serialize(db, m) for m in db.scalars(stmt.order_by(Meeting.meeting_date.desc()))]
# -------------------------------------------------------------------- the student
def request_meeting(db: Session, user: User, data: MeetingIn) -> Meeting:
    proposal = proposal_service.get_own(db, user)
    if proposal is None or proposal.status != ProposalStatus.approved:
        raise ConflictError("You can request a meeting once your proposal is approved")
    if supervisor_of_thesis(db, proposal.thesis_id) is None:
        raise ConflictError("You can request a meeting once a supervisor has been assigned")
    when = aware(data.meeting_date)
    if when < _now() - timedelta(minutes=5):
        raise InvalidInputError("Choose a date and time in the future")
    waiting = db.scalars(
        select(Meeting.id).where(Meeting.thesis_id == proposal.thesis_id, Meeting.status == "requested")
    )
    if len(list(waiting)) >= MAX_OPEN_REQUESTS:
        raise ConflictError(f"You already have {MAX_OPEN_REQUESTS} requests waiting for an answer")
    meeting = Meeting(
        thesis_id=proposal.thesis_id, meeting_date=when, agenda=data.agenda.strip(), mode=data.mode,
        location=data.location.strip(), status="requested", requested_by=user.id,
    )
    db.add(meeting)
    db.flush()
    log_audit(db, user.id, "meeting.request", "meeting", meeting.id, {"date": when.isoformat()})
    return meeting
def cancel(db: Session, meeting_id: int, user: User) -> Meeting:
    meeting = _get_visible(db, meeting_id, user)
    by_student = user.role == UserRole.student and meeting.status in ("requested", "scheduled")
    by_supervisor = user.role == UserRole.supervisor and meeting.status == "scheduled"
    if not (by_student or by_supervisor):
        raise ConflictError("This meeting cannot be cancelled")
    meeting.status = "cancelled"
    meeting.updated_at = _now()
    log_audit(db, user.id, "meeting.cancel", "meeting", meeting.id)
    db.flush()
    return meeting
# ----------------------------------------------------------------- the supervisor
def _get_as_supervisor(db: Session, meeting_id: int, user: User) -> Meeting:
    meeting = db.get(Meeting, meeting_id)
    if meeting is None or not is_assigned_supervisor(db, meeting.thesis_id, user):
        raise NotFoundError("Meeting not found")
    return meeting
def accept(db: Session, meeting_id: int, user: User, data: AcceptIn) -> Meeting:
    meeting = _get_as_supervisor(db, meeting_id, user)
    if meeting.status != "requested":
        raise ConflictError("Only a requested meeting can be accepted")
    if data.meeting_date is not None:
        when = aware(data.meeting_date)
        if when < _now() - timedelta(minutes=5):
            raise InvalidInputError("Choose a date and time in the future")
        meeting.meeting_date = when
    if data.location is not None:
        meeting.location = data.location.strip()
    meeting.status = "scheduled"
    meeting.updated_at = _now()
    log_audit(db, user.id, "meeting.accept", "meeting", meeting.id)
    db.flush()
    return meeting
def decline(db: Session, meeting_id: int, user: User, reason: str) -> Meeting:
    meeting = _get_as_supervisor(db, meeting_id, user)
    if meeting.status != "requested":
        raise ConflictError("Only a requested meeting can be declined")
    if not reason.strip():
        raise InvalidInputError("Tell the student why, or suggest another time")
    meeting.status = "declined"
    meeting.decline_reason = reason.strip()
    meeting.updated_at = _now()
    log_audit(db, user.id, "meeting.decline", "meeting", meeting.id)
    db.flush()
    return meeting
def complete(db: Session, meeting_id: int, user: User, data: CompleteIn) -> Meeting:
    """The supervisor records what was discussed. This is what lets the student write the weekly report."""
    meeting = _get_as_supervisor(db, meeting_id, user)
    if meeting.status != "scheduled":
        raise ConflictError("Only a scheduled meeting can be recorded as held")
    if len(data.discussion.strip()) < 10:
        raise InvalidInputError("Write a short note of what was discussed")
    meeting.discussion = data.discussion.strip()
    meeting.decisions = data.decisions.strip()
    meeting.next_meeting_date = aware(data.next_meeting_date) if data.next_meeting_date else None
    meeting.status = "completed"
    meeting.completed_at = _now()
    meeting.updated_at = _now()
    log_audit(db, user.id, "meeting.complete", "meeting", meeting.id)
    db.flush()
    return meeting