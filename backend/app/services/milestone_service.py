from datetime import date, datetime, timezone
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, InvalidInputError, NotFoundError
from app.models.profile import Supervisor
from app.models.supervision import Feedback, Milestone, MilestoneStatus, MilestoneSubmission
from app.models.thesis import SupervisorAssignment, ThesisProposal
from app.models.user import User, UserRole
from app.schemas.supervision import (
    FeedbackOut, FileInfo, MilestoneIn, MilestoneOut, MilestoneUpdate, ProgressOut, SubmissionOut,
)
from app.services import file_storage, proposal_service
from app.services import meeting_service as access
from app.services.audit import log_audit

# A student can hand in work only while the milestone is in one of these states.
OPEN_FOR_WORK = (MilestoneStatus.not_started, MilestoneStatus.in_progress, MilestoneStatus.revision_required)
IN_REVIEW = (MilestoneStatus.submitted, MilestoneStatus.under_review)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _today() -> date:
    return _now().date()


# ----------------------------------------------------------------- who may see what
def _milestone_visible(db: Session, milestone_id: int, user: User) -> Milestone:
    milestone = db.get(Milestone, milestone_id)
    if milestone is None or not access.can_view_thesis(db, milestone.thesis_id, user):
        raise NotFoundError("Milestone not found")
    return milestone


def _milestone_of_supervisor(db: Session, milestone_id: int, user: User) -> Milestone:
    milestone = db.get(Milestone, milestone_id)
    if milestone is None or not access.is_assigned_supervisor(db, milestone.thesis_id, user):
        raise NotFoundError("Milestone not found")
    return milestone


def _submission_visible(db: Session, submission_id: int, user: User) -> MilestoneSubmission:
    submission = db.get(MilestoneSubmission, submission_id)
    if submission is None or not access.can_view_thesis(db, submission.milestone.thesis_id, user):
        raise NotFoundError("Submission not found")
    return submission


def _submission_of_supervisor(db: Session, submission_id: int, user: User) -> MilestoneSubmission:
    submission = db.get(MilestoneSubmission, submission_id)
    if submission is None or not access.is_assigned_supervisor(db, submission.milestone.thesis_id, user):
        raise NotFoundError("Submission not found")
    return submission


def _scope(stmt, user: User, db: Session, thesis_column, thesis_id: int | None = None):
    """Limit a query to the theses this person may see: a student's own, a supervisor's students', or all (staff)."""
    if user.role == UserRole.student:
        own = access.own_thesis_id(db, user)
        return stmt.where(thesis_column == (own if own is not None else -1))
    if user.role == UserRole.supervisor:
        stmt = (
            stmt.where(thesis_column.in_(
                select(ThesisProposal.thesis_id)
                .join(SupervisorAssignment, SupervisorAssignment.proposal_id == ThesisProposal.id)
                .join(Supervisor, Supervisor.id == SupervisorAssignment.supervisor_id)
                .where(Supervisor.user_id == user.id)
            ))
        )
    return stmt.where(thesis_column == thesis_id) if thesis_id is not None else stmt


# --------------------------------------------------------------------- output
def _names(db: Session, thesis_id: int) -> list[str]:
    return [s.user.full_name for s in access.students_of_thesis(db, thesis_id)]


def _feedback_out(db: Session, fb: Feedback) -> FeedbackOut:
    milestone = fb.submission.milestone
    return FeedbackOut(
        id=fb.id, submission_id=fb.submission_id, milestone_id=milestone.id, milestone_title=milestone.title,
        student_names=_names(db, milestone.thesis_id), given_by_name=fb.author.full_name, content=fb.content,
        status=fb.status, created_at=fb.created_at, resolved_at=fb.resolved_at,
    )


def _submission_out(db: Session, sub: MilestoneSubmission) -> SubmissionOut:
    file_info = None
    if sub.file_path:
        file_info = FileInfo(
            original_name=sub.original_name or "file", size_bytes=sub.size_bytes or 0,
            content_type=sub.content_type or "application/octet-stream",
        )
    return SubmissionOut(
        id=sub.id, milestone_id=sub.milestone_id, milestone_title=sub.milestone.title,
        student_names=_names(db, sub.milestone.thesis_id), submitted_by_name=sub.submitter.full_name, note=sub.note,
        file=file_info, status=sub.status.value, submitted_at=sub.submitted_at,
        reviewed_by_name=sub.reviewer.full_name if sub.reviewer else None, reviewed_at=sub.reviewed_at,
        feedback=[_feedback_out(db, fb) for fb in sub.feedback],
    )


def _milestone_out(db: Session, m: Milestone) -> MilestoneOut:
    done = m.status == MilestoneStatus.completed
    days_left = None if done else (m.deadline - _today()).days
    open_feedback = db.scalar(
        select(func.count(Feedback.id))
        .join(MilestoneSubmission, MilestoneSubmission.id == Feedback.submission_id)
        .where(MilestoneSubmission.milestone_id == m.id, Feedback.status == "open")
    ) or 0
    return MilestoneOut(
        id=m.id, thesis_id=m.thesis_id, student_names=_names(db, m.thesis_id), title=m.title,
        description=m.description or "", start_date=m.start_date, deadline=m.deadline, status=m.status.value,
        overdue=(not done and days_left is not None and days_left < 0), days_left=days_left,
        submissions_count=len(m.submissions), open_feedback_count=open_feedback,
        latest_submission_id=m.submissions[0].id if m.submissions else None, created_at=m.created_at,
    )


# ------------------------------------------------------------------- milestones
def list_milestones(db: Session, user: User, thesis_id: int | None = None) -> list[MilestoneOut]:
    stmt = _scope(select(Milestone), user, db, Milestone.thesis_id, thesis_id)
    return [_milestone_out(db, m) for m in db.scalars(stmt.order_by(Milestone.deadline, Milestone.id))]


def get_milestone(db: Session, milestone_id: int, user: User) -> MilestoneOut:
    return _milestone_out(db, _milestone_visible(db, milestone_id, user))


def create_milestone(db: Session, user: User, data: MilestoneIn) -> Milestone:
    if not access.is_assigned_supervisor(db, data.thesis_id, user):
        raise NotFoundError("Thesis not found")
    milestone = Milestone(
        thesis_id=data.thesis_id, title=data.title.strip(), description=data.description.strip(),
        start_date=data.start_date, deadline=data.deadline, status=MilestoneStatus.not_started,
    )
    db.add(milestone)
    db.flush()
    log_audit(db, user.id, "milestone.create", "milestone", milestone.id, {"title": milestone.title})
    return milestone


def update_milestone(db: Session, milestone_id: int, user: User, data: MilestoneUpdate) -> Milestone:
    milestone = _milestone_of_supervisor(db, milestone_id, user)
    if milestone.status == MilestoneStatus.completed:
        raise ConflictError("A completed milestone cannot be changed")
    milestone.title = data.title.strip()
    milestone.description = data.description.strip()
    milestone.start_date = data.start_date
    milestone.deadline = data.deadline
    log_audit(db, user.id, "milestone.update", "milestone", milestone.id)
    db.flush()
    return milestone


def delete_milestone(db: Session, milestone_id: int, user: User) -> None:
    milestone = _milestone_of_supervisor(db, milestone_id, user)
    if milestone.submissions:
        raise ConflictError("This milestone already has submissions and cannot be deleted")
    log_audit(db, user.id, "milestone.delete", "milestone", milestone.id, {"title": milestone.title})
    db.delete(milestone)
    db.flush()


# --------------------------------------------------------------- the student hands in work
def submit(db: Session, user: User, milestone_id: int, note: str, upload: UploadFile | None) -> MilestoneSubmission:
    milestone = db.get(Milestone, milestone_id)
    if milestone is None or milestone.thesis_id != access.own_thesis_id(db, user):
        raise NotFoundError("Milestone not found")
    if milestone.status not in OPEN_FOR_WORK:
        raise ConflictError("This milestone is not open for a new submission")
    if upload is not None and not upload.filename:
        upload = None  # a form with no file chosen
    note = (note or "").strip()
    if not note and upload is None:
        raise InvalidInputError("Add a note, a file, or both")

    stored = file_storage.store_upload(upload) if upload is not None else None
    try:
        submission = MilestoneSubmission(
            milestone_id=milestone.id, submitted_by=user.id, note=note, status=MilestoneStatus.submitted,
            file_path=stored.path if stored else None, original_name=stored.original_name if stored else None,
            size_bytes=stored.size if stored else None, content_type=stored.content_type if stored else None,
            sha256=stored.sha256 if stored else None,
        )
        db.add(submission)
        milestone.status = MilestoneStatus.submitted
        # This submission answers the supervisor's earlier feedback on the same milestone.
        for earlier in milestone.submissions:
            for fb in earlier.feedback:
                if fb.status == "open":
                    fb.status, fb.resolved_at = "resolved", _now()
        log_audit(db, user.id, "milestone.submit", "milestone", milestone.id, {"has_file": stored is not None})
        db.flush()
    except Exception:
        file_storage.delete_quietly(stored.path if stored else None)
        raise
    return submission


# ----------------------------------------------------------- the supervisor reviews
def review(db: Session, submission_id: int, user: User, decision: str, feedback: str) -> MilestoneSubmission:
    submission = _submission_of_supervisor(db, submission_id, user)
    if submission.status != MilestoneStatus.submitted:
        raise ConflictError("This submission has already been reviewed")
    text = feedback.strip()
    approved = decision == "approved"
    if not approved and not text:
        raise InvalidInputError("Explain what the student needs to change")

    new_status = MilestoneStatus.completed if approved else MilestoneStatus.revision_required
    submission.status = new_status
    submission.milestone.status = new_status
    submission.reviewed_by = user.id
    submission.reviewed_at = _now()
    if text:
        db.add(Feedback(
            submission_id=submission.id, given_by=user.id, content=text,
            status="resolved" if approved else "open", resolved_at=_now() if approved else None,
        ))
    log_audit(db, user.id, f"milestone.{'approve' if approved else 'request_revision'}", "milestone",
              submission.milestone_id, {"submission": submission.id})
    db.flush()
    return submission


def add_feedback(db: Session, submission_id: int, user: User, content: str) -> Feedback:
    submission = _submission_of_supervisor(db, submission_id, user)
    feedback = Feedback(submission_id=submission.id, given_by=user.id, content=content.strip(), status="open")
    db.add(feedback)
    log_audit(db, user.id, "feedback.add", "milestone", submission.milestone_id, {"submission": submission.id})
    db.flush()
    return feedback


def resolve_feedback(db: Session, feedback_id: int, user: User) -> Feedback:
    feedback = db.get(Feedback, feedback_id)
    if feedback is None or feedback.submission.milestone.thesis_id != access.own_thesis_id(db, user):
        raise NotFoundError("Feedback not found")
    if feedback.status != "open":
        raise ConflictError("This feedback is already resolved")
    feedback.status, feedback.resolved_at = "resolved", _now()
    log_audit(db, user.id, "feedback.resolve", "feedback", feedback.id)
    db.flush()
    return feedback


# ---------------------------------------------------------------------- reading
def list_submissions(
    db: Session, user: User, status: str | None = None, milestone_id: int | None = None
) -> list[SubmissionOut]:
    stmt = _scope(select(MilestoneSubmission).join(Milestone), user, db, Milestone.thesis_id)
    if status:
        try:
            stmt = stmt.where(MilestoneSubmission.status == MilestoneStatus(status))
        except ValueError:
            raise InvalidInputError("Unknown status") from None
    if milestone_id is not None:
        stmt = stmt.where(MilestoneSubmission.milestone_id == milestone_id)
    return [_submission_out(db, s) for s in db.scalars(stmt.order_by(MilestoneSubmission.submitted_at.desc()))]


def get_submission(db: Session, submission_id: int, user: User) -> SubmissionOut:
    return _submission_out(db, _submission_visible(db, submission_id, user))


def download_submission(db: Session, submission_id: int, user: User) -> tuple[Path, str, str]:
    submission = _submission_visible(db, submission_id, user)
    if not submission.file_path:
        raise NotFoundError("This submission has no file")
    return (
        file_storage.path_of(submission.file_path), submission.original_name or "file",
        submission.content_type or "application/octet-stream",
    )


def get_feedback(db: Session, feedback_id: int, user: User) -> FeedbackOut:
    feedback = db.get(Feedback, feedback_id)
    if feedback is None or not access.can_view_thesis(db, feedback.submission.milestone.thesis_id, user):
        raise NotFoundError("Feedback not found")
    return _feedback_out(db, feedback)


def list_feedback(db: Session, user: User, status: str | None = None) -> list[FeedbackOut]:
    stmt = _scope(
        select(Feedback).join(MilestoneSubmission, MilestoneSubmission.id == Feedback.submission_id).join(Milestone),
        user, db, Milestone.thesis_id,
    )
    if status:
        stmt = stmt.where(Feedback.status == status)
    return [_feedback_out(db, fb) for fb in db.scalars(stmt.order_by(Feedback.created_at.desc()))]


# --------------------------------------------------------------------- progress
def progress(db: Session, user: User) -> list[ProgressOut]:
    """One row per thesis the person may see. The percentage is the share of milestones completed."""
    proposals = select(ThesisProposal).join(
        SupervisorAssignment, SupervisorAssignment.proposal_id == ThesisProposal.id
    )
    if user.role == UserRole.student:
        own = proposal_service.get_own(db, user)
        theses = [own] if own is not None else []
    else:
        stmt = proposals
        if user.role == UserRole.supervisor:
            stmt = (
                stmt.join(Supervisor, Supervisor.id == SupervisorAssignment.supervisor_id)
                .where(Supervisor.user_id == user.id)
            )
        theses = list(db.scalars(stmt.order_by(ThesisProposal.id)))

    today = _today()
    out = []
    for proposal in theses:
        milestones = list(db.scalars(select(Milestone).where(Milestone.thesis_id == proposal.thesis_id)))
        unfinished = [m for m in milestones if m.status != MilestoneStatus.completed]
        completed = len(milestones) - len(unfinished)
        supervisor = access.supervisor_of_thesis(db, proposal.thesis_id)
        out.append(ProgressOut(
            thesis_id=proposal.thesis_id, proposal_id=proposal.id, title=proposal.title,
            student_names=_names(db, proposal.thesis_id),
            supervisor_name=supervisor.user.full_name if supervisor else None, total=len(milestones),
            completed=completed, in_review=sum(1 for m in unfinished if m.status in IN_REVIEW),
            revision_required=sum(1 for m in unfinished if m.status == MilestoneStatus.revision_required),
            overdue=sum(1 for m in unfinished if m.deadline < today),
            percent=round(100 * completed / len(milestones)) if milestones else 0,
            next_deadline=min((m.deadline for m in unfinished), default=None),
        ))
    return out