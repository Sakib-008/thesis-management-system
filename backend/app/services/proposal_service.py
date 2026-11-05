from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, InvalidInputError, NotFoundError
from app.models.profile import Student, Supervisor
from app.models.reference import ResearchField
from app.models.thesis import (
    ProposalReview, ProposalStatus, ProposalVersion, SupervisorAssignment, Thesis, ThesisProposal,
    thesis_members,
)
from app.models.user import User, UserRole
from app.schemas.profile import UserBrief
from app.schemas.proposal import ProposalIn, ProposalOut, ReviewOut
from app.schemas.reference import NamedRef
from app.services.audit import log_audit

# Statuses in which the student may still change the proposal
EDITABLE = {ProposalStatus.draft, ProposalStatus.revision_required}
# Statuses in which a coordinator can still give a decision
REVIEWABLE = {ProposalStatus.submitted, ProposalStatus.resubmitted, ProposalStatus.under_review}

# Minimum content before a proposal can be submitted: (attribute, label, minimum length)
REQUIRED_TEXT = [
    ("title", "title", 5),
    ("abstract", "abstract", 40),
    ("problem_statement", "problem statement", 20),
    ("objectives", "objectives", 10),
    ("methodology", "methodology", 20),
]


# ------------------------------------------------------------------ helpers
def _now() -> datetime:
    return datetime.now(timezone.utc)


def _clean_keywords(raw: list[str]) -> list[str]:
    keywords, seen = [], set()
    for item in raw:
        word = " ".join(item.split())
        if not word:
            continue
        if len(word) > 60:
            raise InvalidInputError("Each keyword must be 60 characters or fewer")
        if word.lower() not in seen:
            seen.add(word.lower())
            keywords.append(word)
    return keywords


def _load_fields(db: Session, field_ids: list[int]) -> list[ResearchField]:
    ids = set(field_ids)
    if not ids:
        return []
    fields = list(db.scalars(select(ResearchField).where(ResearchField.id.in_(ids))))
    if len(fields) != len(ids):
        raise InvalidInputError("One or more research fields do not exist")
    return fields


def _apply(db: Session, proposal: ThesisProposal, data: ProposalIn) -> None:
    proposal.title = data.title.strip()
    proposal.abstract = data.abstract.strip()
    proposal.problem_statement = data.problem_statement.strip()
    proposal.objectives = data.objectives.strip()
    proposal.methodology = data.methodology.strip()
    proposal.expected_outcome = data.expected_outcome.strip()
    proposal.references_text = data.references_text.strip()
    proposal.keywords = _clean_keywords(data.keywords)
    proposal.fields = _load_fields(db, data.field_ids)
    proposal.updated_at = _now()
    proposal.thesis.title = proposal.title or "Untitled thesis"





def _snapshot(proposal: ThesisProposal) -> dict:
    return {
        "title": proposal.title,
        "abstract": proposal.abstract,
        "problem_statement": proposal.problem_statement,
        "objectives": proposal.objectives,
        "methodology": proposal.methodology,
        "expected_outcome": proposal.expected_outcome or "",
        "references_text": proposal.references_text,
        "keywords": list(proposal.keywords),
        "fields": [f.name for f in proposal.fields],
    }


def _latest_version_no(db: Session, proposal_id: int) -> int:
    latest = db.scalar(
        select(func.max(ProposalVersion.version_no)).where(ProposalVersion.proposal_id == proposal_id)
    )
    return latest or 0


def _require_complete(proposal: ThesisProposal) -> None:
    missing = [
        label for attr, label, minimum in REQUIRED_TEXT if len((getattr(proposal, attr) or "").strip()) < minimum
    ]
    if not proposal.fields:
        missing.append("at least one research field")
    if missing:
        raise InvalidInputError("Complete these before submitting: " + ", ".join(missing))


# ------------------------------------------------------------- student side
def get_own(db: Session, user: User) -> ThesisProposal | None:
    return db.scalar(
        select(ThesisProposal)
        .join(thesis_members, thesis_members.c.thesis_id == ThesisProposal.thesis_id)
        .join(Student, Student.id == thesis_members.c.student_id)
        .where(Student.user_id == user.id)
    )


def save_draft(db: Session, user: User, data: ProposalIn) -> ThesisProposal:
    """Create the student's proposal on first save, then update it while it is still editable."""
    proposal = get_own(db, user)
    if proposal is None:
        student = db.scalar(select(Student).where(Student.user_id == user.id))
        if student is None:
            raise InvalidInputError("Complete your student profile before creating a proposal")
        thesis = Thesis(title=data.title.strip() or "Untitled thesis")
        thesis.members.append(student)
        proposal = ThesisProposal(thesis=thesis, status=ProposalStatus.draft)
        db.add(proposal)
    elif proposal.status not in EDITABLE:
        raise ConflictError("This proposal can no longer be edited")
    _apply(db, proposal, data)
    db.flush()
    return proposal


def submit(db: Session, user: User) -> ThesisProposal:
    proposal = get_own(db, user)
    if proposal is None:
        raise NotFoundError("You have not started a proposal yet")
    if proposal.status not in EDITABLE:
        raise ConflictError("This proposal has already been submitted")
    _require_complete(proposal)

    proposal.status = (
        ProposalStatus.resubmitted if proposal.status == ProposalStatus.revision_required
        else ProposalStatus.submitted
    )
    version_no = _latest_version_no(db, proposal.id) + 1
    db.add(ProposalVersion(proposal_id=proposal.id, version_no=version_no, content_snapshot=_snapshot(proposal)))
    proposal.updated_at = _now()
    log_audit(db, user.id, "proposal.submit", "proposal", proposal.id,
               {"version": version_no, "status": proposal.status.value})
    db.flush()
    return proposal


# ------------------------------------------------------- coordinator actions
def _get(db: Session, proposal_id: int) -> ThesisProposal:
    proposal = db.get(ThesisProposal, proposal_id)
    if proposal is None or proposal.status == ProposalStatus.draft:
        raise NotFoundError("Proposal not found")



    return proposal


def start_review(db: Session, proposal_id: int, actor: User) -> ThesisProposal:
    proposal = _get(db, proposal_id)
    if proposal.status not in (ProposalStatus.submitted, ProposalStatus.resubmitted):
        raise ConflictError("Only a submitted proposal can be marked as under review")
    proposal.status = ProposalStatus.under_review
    proposal.updated_at = _now()
    log_audit(db, actor.id, "proposal.start_review", "proposal", proposal.id)
    db.flush()
    return proposal


def review(db: Session, proposal_id: int, actor: User, decision: str, comment: str) -> ThesisProposal:
    proposal = _get(db, proposal_id)
    if proposal.status not in REVIEWABLE:
        raise ConflictError("This proposal is not waiting for review")
    comment = comment.strip()
    if decision == "revision_required" and not comment:
        raise InvalidInputError("Explain what the student needs to change")

    proposal.status = ProposalStatus.approved if decision == "approved" else ProposalStatus.revision_required
    proposal.updated_at = _now()
    version_no = _latest_version_no(db, proposal.id)
    db.add(ProposalReview(proposal_id=proposal.id, version_no=version_no, reviewer_id=actor.id,
                          decision=decision, comment=comment))
    log_audit(db, actor.id, f"proposal.{decision}", "proposal", proposal.id, {"version": version_no})
    db.flush()
    return proposal


# ------------------------------------------------------------------ reading
def _can_view(db: Session, proposal: ThesisProposal, user: User) -> bool:
    if user.role in (UserRole.coordinator, UserRole.admin):
        return proposal.status != ProposalStatus.draft # drafts stay private to the student
    if user.role == UserRole.student:
        own = get_own(db, user)
        return own is not None and own.id == proposal.id
    if user.role == UserRole.supervisor:
        return db.scalar(
            select(SupervisorAssignment.id)
            .join(Supervisor, Supervisor.id == SupervisorAssignment.supervisor_id)
            .where(SupervisorAssignment.proposal_id == proposal.id, Supervisor.user_id == user.id)
        ) is not None
    return False


def get_visible(db: Session, proposal_id: int, user: User) -> ThesisProposal:
    proposal = db.get(ThesisProposal, proposal_id)
    if proposal is None or not _can_view(db, proposal, user):
        raise NotFoundError("Proposal not found") # same answer whether it exists or not
    return proposal


def list_for(db: Session, user: User, status: ProposalStatus | None = None) -> list[ThesisProposal]:
    stmt = select(ThesisProposal).where(ThesisProposal.status != ProposalStatus.draft)
    if user.role == UserRole.supervisor:
        stmt = (
            stmt.join(SupervisorAssignment, SupervisorAssignment.proposal_id == ThesisProposal.id)
            .join(Supervisor, Supervisor.id == SupervisorAssignment.supervisor_id)
            .where(Supervisor.user_id == user.id)
        )
    if status is not None:
        stmt = stmt.where(ThesisProposal.status == status)
    return list(db.scalars(stmt.order_by(ThesisProposal.updated_at.desc())))


def versions_of(db: Session, proposal_id: int) -> list[ProposalVersion]:
    return list(db.scalars(
        select(ProposalVersion).where(ProposalVersion.proposal_id == proposal_id)
        .order_by(ProposalVersion.version_no.desc())
    ))


def reviews_of(db: Session, proposal_id: int) -> list[ProposalReview]:
    return list(db.scalars(
        select(ProposalReview).where(ProposalReview.proposal_id == proposal_id).order_by(ProposalReview.id.desc())
    ))


def serialize(db: Session, proposal: ThesisProposal) -> ProposalOut:
    owner = db.scalar(
        select(User)
        .join(Student, Student.user_id == User.id)



         .join(thesis_members, thesis_members.c.student_id == Student.id)
         .where(thesis_members.c.thesis_id == proposal.thesis_id)
         .limit(1)
    )
    version_count, submitted_at = db.execute(
        select(func.count(ProposalVersion.id), func.max(ProposalVersion.created_at))
        .where(ProposalVersion.proposal_id == proposal.id)
    ).one()
    latest = db.scalar(
        select(ProposalReview).where(ProposalReview.proposal_id == proposal.id)
        .order_by(ProposalReview.id.desc()).limit(1)
    )
    return ProposalOut(
        id=proposal.id,
        thesis_id=proposal.thesis_id,
        title=proposal.title,
        abstract=proposal.abstract,
        problem_statement=proposal.problem_statement,
        objectives=proposal.objectives,
        methodology=proposal.methodology,
        expected_outcome=proposal.expected_outcome or "",
        references_text=proposal.references_text,
        keywords=list(proposal.keywords),
        status=proposal.status,
        fields=[NamedRef.model_validate(f) for f in proposal.fields],
        student=UserBrief.model_validate(owner) if owner else None,
        version_count=version_count,
        submitted_at=submitted_at,
        latest_review=ReviewOut.model_validate(latest) if latest else None,
        created_at=proposal.created_at,
        updated_at=proposal.updated_at,
    )
