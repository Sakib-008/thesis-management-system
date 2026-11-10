from datetime import datetime, timezone

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session, selectinload

from app.ai.allocation import Candidate, allocate
from app.core.errors import ConflictError, InvalidInputError, NotFoundError
from app.models.allocation import AssignmentRun, AssignmentRunStatus
from app.models.ai import SupervisorRecommendation
from app.models.profile import Student, Supervisor
from app.models.thesis import (
    AssignmentMethod, ProposalReview, ProposalStatus, SupervisorAssignment, ThesisProposal, thesis_members,
)
from app.models.user import User
from app.schemas.allocation import (
    AssignmentOut, MatchedOut, MyAssignmentOut, ReadinessOut, RunOut, RunSummaryOut, UnmatchedOut, WaitingOut,
)
from app.services import proposal_service, recommendation_service
from app.services.audit import log_audit

# Allocation runs and manual assignments change the same counters, so they take turns.
ALLOCATION_LOCK = 4_242_001

REASON_MESSAGE = {
    "capacity": "Every well-matched supervisor is already at capacity",
    "no_good_match": "No supervisor reaches the minimum match score",
}


def _lock(db: Session) -> None:
    db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": ALLOCATION_LOCK})


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ------------------------------------------------------------------- queries
def _waiting(db: Session) -> list[tuple[ThesisProposal, Student]]:
    """Approved proposals that do not have a supervisor yet, with their student."""
    assigned = select(SupervisorAssignment.id).where(SupervisorAssignment.proposal_id == ThesisProposal.id).exists()
    rows = db.execute(
        select(ThesisProposal, Student)
        .join(thesis_members, thesis_members.c.thesis_id == ThesisProposal.thesis_id)
        .join(Student, Student.id == thesis_members.c.student_id)
        .options(selectinload(Student.user))
        .where(ThesisProposal.status == ProposalStatus.approved, ~assigned)
        .order_by(ThesisProposal.id)
    ).all()
    return [(proposal, student) for proposal, student in rows]


def _summary(run: AssignmentRun) -> RunSummaryOut:
    return RunSummaryOut(
        id=run.id, run_at=run.run_at, completed_at=run.completed_at,
        triggered_by_name=run.triggered_by_user.full_name, status=run.status.value, processed=run.processed,
        matched_count=run.matched_count, unmatched_count=run.unmatched_count,
    )


def _last_run(db: Session) -> AssignmentRun | None:
    return db.scalar(select(AssignmentRun).order_by(AssignmentRun.id.desc()).limit(1))


# ----------------------------------------------------------------- the check
def readiness(db: Session) -> ReadinessOut:
    waiting = _waiting(db)
    verified = sum(1 for _, student in waiting if student.cgpa_verified)
    places = db.execute(select(Supervisor.capacity, Supervisor.current_count)).all()
    free = [max(0, capacity - current) for capacity, current in places]
    last = _last_run(db)
    return ReadinessOut(
        waiting_total=len(waiting), waiting_verified=verified, waiting_unverified=len(waiting) - verified,
        open_slots=sum(free), supervisors_with_slots=sum(1 for n in free if n > 0),
        last_run=_summary(last) if last else None,
    )


# ----------------------------------------------------------------- a run
def run(db: Session, actor: User) -> RunOut:
    """Place every waiting student who has a verified CGPA. Everything happens in one transaction: if anything
    fails (for example the AI model is unavailable) nothing at all is changed."""
    _lock(db)
    waiting = _waiting(db)
    eligible = [(proposal, student) for proposal, student in waiting if student.cgpa_verified]
    skipped = sorted(
        (student.user.full_name for _, student in waiting if not student.cgpa_verified), key=str.casefold
    )
    if not eligible:
        raise InvalidInputError("No students are waiting for a supervisor with a verified CGPA")

    allocation_run = AssignmentRun(triggered_by=actor.id, status=AssignmentRunStatus.running)
    db.add(allocation_run)
    db.flush()

    # Lock the supervisors, so the number of free places cannot change while this run works.
    supervisors = list(db.scalars(select(Supervisor).order_by(Supervisor.id).with_for_update()))
    by_id = {s.id: s for s in supervisors}
    free = {s.id: s.capacity - s.current_count for s in supervisors}

    # Fresh recommendations for every waiting student, using today's capacity and settings.
    for proposal, _ in eligible:
        recommendation_service.generate(db, proposal.id, actor)

    min_score = recommendation_service.get_settings(db)["min_score"] / 100
    proposal_ids = [proposal.id for proposal, _ in eligible]
    ranking: dict[int, list[tuple[int, float, int]]] = {pid: [] for pid in proposal_ids}
    for pid, supervisor_id, score, why in db.execute(
        select(
            SupervisorRecommendation.proposal_id, SupervisorRecommendation.supervisor_id,
            SupervisorRecommendation.final_score, SupervisorRecommendation.reasons_json,
        ).where(SupervisorRecommendation.proposal_id.in_(proposal_ids))
    ):
        ranking[pid].append((supervisor_id, float(score), why["rank"]))

    approved_at = dict(db.execute(
        select(ProposalReview.proposal_id, func.max(ProposalReview.created_at))
        .where(ProposalReview.proposal_id.in_(proposal_ids), ProposalReview.decision == "approved")
        .group_by(ProposalReview.proposal_id)
    ).all())

    candidates = [
        Candidate(
            key=proposal.id, student_id=student.id, cgpa=float(student.cgpa),
            approved_at=approved_at.get(proposal.id, proposal.updated_at),
            ranking=[(sid, score) for sid, score, _ in sorted(ranking[proposal.id], key=lambda r: r[2])],
        )
        for proposal, student in eligible
    ]

    placements = allocate(candidates, free, min_score)
    by_proposal = {proposal.id: (proposal, student) for proposal, student in eligible}
    matched, unmatched = [], []

    for placement in placements:
        proposal, student = by_proposal[placement.key]
        student.merit_rank = placement.position  # saved for the record, never returned by any API
        name = student.user.full_name
        if placement.supervisor_id is None:
            unmatched.append(UnmatchedOut(
                proposal_id=proposal.id, student_name=name, title=proposal.title, reason=placement.reason,
                message=REASON_MESSAGE[placement.reason],
            ))
            continue

        supervisor = by_id[placement.supervisor_id]
        supervisor.current_count += 1
        db.add(SupervisorAssignment(
            proposal_id=proposal.id, student_id=student.id, supervisor_id=supervisor.id,
            assignment_run_id=allocation_run.id, assigned_by=actor.id, method=AssignmentMethod.merit_allocation,
            match_score=round(placement.score, 4),
        ))
        matched.append(MatchedOut(
            proposal_id=proposal.id, student_name=name, title=proposal.title, supervisor_id=supervisor.id,
            supervisor_name=supervisor.user.full_name, score=round(placement.score * 100, 1),
            choice=placement.choice,
        ))

    # The coordinator sees results in alphabetical order, so the order of service can never be guessed.
    matched.sort(key=lambda m: m.student_name.casefold())
    unmatched.sort(key=lambda u: u.student_name.casefold())

    allocation_run.processed = len(placements)
    allocation_run.matched_count = len(matched)
    allocation_run.unmatched_count = len(unmatched)
    allocation_run.status = (
        AssignmentRunStatus.completed_with_exceptions if unmatched else AssignmentRunStatus.completed
    )
    allocation_run.completed_at = _now()
    allocation_run.result_json = {
        "matched": [m.model_dump() for m in matched],
        "unmatched": [u.model_dump() for u in unmatched],
        "skipped_unverified": skipped,
    }
    log_audit(db, actor.id, "allocation.run", "assignment_run", allocation_run.id,
              {"processed": len(placements), "matched": len(matched), "unmatched": len(unmatched)})
    db.flush()
    return get_run(db, allocation_run.id)


def get_run(db: Session, run_id: int) -> RunOut:
    allocation_run = db.get(AssignmentRun, run_id)
    if allocation_run is None:
        raise NotFoundError("Allocation run not found")
    result = allocation_run.result_json or {}
    return RunOut(
        **_summary(allocation_run).model_dump(),
        matched=[MatchedOut(**m) for m in result.get("matched", [])],
        unmatched=[UnmatchedOut(**u) for u in result.get("unmatched", [])],
        skipped_unverified=result.get("skipped_unverified", []),
    )


def list_runs(db: Session) -> list[RunSummaryOut]:
    return [_summary(r) for r in db.scalars(select(AssignmentRun).order_by(AssignmentRun.id.desc()))]


# ------------------------------------------------------- manual assignment
def assign_manually(db: Session, proposal_id: int, supervisor_id: int, actor: User, reason: str) -> None:
    """Give an approved proposal a supervisor, or move it to a different one. A reason is always required."""
    reason = reason.strip()
    if not reason:
        raise InvalidInputError("Give a reason for this assignment")
    _lock(db)
    proposal = db.get(ThesisProposal, proposal_id)
    if proposal is None or proposal.status == ProposalStatus.draft:
        raise NotFoundError("Proposal not found")
    if proposal.status != ProposalStatus.approved:
        raise ConflictError("Only an approved proposal can be given a supervisor")
    supervisor = db.scalar(select(Supervisor).where(Supervisor.id == supervisor_id).with_for_update())
    if supervisor is None:
        raise NotFoundError("Supervisor not found")
    assignment = db.scalar(select(SupervisorAssignment).where(SupervisorAssignment.proposal_id == proposal_id))
    if assignment is not None and assignment.supervisor_id == supervisor_id:
        raise ConflictError("The student already has this supervisor")
    if supervisor.current_count >= supervisor.capacity:
        raise ConflictError(f"{supervisor.user.full_name} is already at capacity")

    stored = db.scalar(
        select(SupervisorRecommendation.final_score).where(
            SupervisorRecommendation.proposal_id == proposal_id,
            SupervisorRecommendation.supervisor_id == supervisor_id,
        )
    )

    previous_id = None
    if assignment is None:
        student_id = db.scalar(
            select(thesis_members.c.student_id).where(thesis_members.c.thesis_id == proposal.thesis_id)
        )
        assignment = SupervisorAssignment(
            proposal_id=proposal_id, student_id=student_id, supervisor_id=supervisor_id
        )
        db.add(assignment)
        action = "assignment.assign"
    else:
        previous = db.scalar(select(Supervisor).where(Supervisor.id == assignment.supervisor_id).with_for_update())
        previous.current_count = max(0, previous.current_count - 1)
        previous_id = previous.id
        action = "assignment.change"

    assignment.supervisor_id = supervisor_id
    assignment.method = AssignmentMethod.manual_override
    assignment.assigned_by = actor.id
    assignment.assigned_at = _now()
    assignment.reason = reason
    assignment.match_score = stored
    supervisor.current_count += 1
    log_audit(db, actor.id, action, "proposal", proposal_id,
              {"from_supervisor": previous_id, "to_supervisor": supervisor_id, "reason": reason})
    db.flush()


# ------------------------------------------------------------------ reading
def list_assignments(db: Session) -> list[AssignmentOut]:
    rows = db.scalars(
        select(SupervisorAssignment)
        .options(
            selectinload(SupervisorAssignment.proposal),
            selectinload(SupervisorAssignment.student).selectinload(Student.user),
            selectinload(SupervisorAssignment.supervisor).selectinload(Supervisor.user),
            selectinload(SupervisorAssignment.supervisor).selectinload(Supervisor.designation),
        )
        .order_by(SupervisorAssignment.assigned_at.desc())
    )
    return [
        AssignmentOut(
            id=a.id, proposal_id=a.proposal_id, title=a.proposal.title, student_name=a.student.user.full_name,
            supervisor_id=a.supervisor_id, supervisor_name=a.supervisor.user.full_name,
            designation=a.supervisor.designation.name, method=a.method.value,
            score=round(float(a.match_score) * 100, 1) if a.match_score is not None else None,
            reason=a.reason, assigned_at=a.assigned_at, run_id=a.assignment_run_id,
        )
        for a in rows
    ]


def list_waiting(db: Session) -> list[WaitingOut]:
    last = _last_run(db)
    notes = {u["proposal_id"]: u["message"] for u in (last.result_json or {}).get("unmatched", [])} if last else {}
    waiting = [
        WaitingOut(
            proposal_id=proposal.id, title=proposal.title, student_name=student.user.full_name,
            cgpa_verified=student.cgpa_verified, note=notes.get(proposal.id),
        )
        for proposal, student in _waiting(db)
    ]
    return sorted(waiting, key=lambda w: w.student_name.casefold())


def my_assignment(db: Session, proposal_id: int, user: User) -> MyAssignmentOut:
    proposal_service.get_visible(db, proposal_id, user)  # same visibility rules as the proposal itself
    assignment = db.scalar(
        select(SupervisorAssignment)
        .options(
            selectinload(SupervisorAssignment.supervisor).selectinload(Supervisor.user),
            selectinload(SupervisorAssignment.supervisor).selectinload(Supervisor.designation),
            selectinload(SupervisorAssignment.supervisor).selectinload(Supervisor.department),
        )
        .where(SupervisorAssignment.proposal_id == proposal_id)
    )
    if assignment is None:
        raise NotFoundError("No supervisor has been assigned yet")
    supervisor = assignment.supervisor
    return MyAssignmentOut(
        supervisor_name=supervisor.user.full_name, designation=supervisor.designation.name,
        email=supervisor.user.email, department=supervisor.department.name, assigned_at=assignment.assigned_at,
    )
