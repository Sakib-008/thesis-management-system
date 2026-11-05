import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.embedder import get_embedder
from app.ai.similarity import Candidate, Query, find_matches
from app.ai.text import proposal_text
from app.core.errors import ConflictError, InvalidInputError, NotFoundError
from app.db.session import SessionLocal
from app.models.ai import SystemSetting
from app.models.duplicates import ProposalSimilarity
from app.models.thesis import ProposalReview, ProposalStatus, ThesisProposal
from app.models.user import User
from app.schemas.duplicate import DuplicateFlagOut, DuplicateOut, DuplicateSettings
from app.services import proposal_service
from app.services.audit import log_audit
from app.services.recommendation_service import _ensure_embeddings  # shared helper: stores and reuses vectors

log = logging.getLogger(__name__)

SETTINGS_KEY = "duplicate"
DEFAULT_SETTINGS = {"high_threshold": 85, "possible_threshold": 70}
MAX_MATCHES = 5


# ----------------------------------------------------------------- settings
def get_settings(db: Session) -> dict:
    row = db.get(SystemSetting, SETTINGS_KEY)
    return {**DEFAULT_SETTINGS, **(row.value if row else {})}


def update_settings(db: Session, actor: User, data: DuplicateSettings) -> dict:
    values = data.model_dump()
    if values["possible_threshold"] >= values["high_threshold"]:
        raise InvalidInputError("The 'possible' threshold must be lower than the 'likely' threshold")
    row = db.get(SystemSetting, SETTINGS_KEY)
    if row is None:
        db.add(SystemSetting(key=SETTINGS_KEY, value=values, updated_by=actor.id))
    else:
        row.value = values
        row.updated_by = actor.id
    log_audit(db, actor.id, "settings.update_duplicate", "settings", None, values)
    db.flush()
    return values


# ------------------------------------------------------------------ checking
def _text_of(p: ThesisProposal) -> str:
    return proposal_text(p.title, p.abstract, p.keywords, p.problem_statement, p.objectives)


def run_check(db: Session, proposal_id: int, actor_id: int | None, keep_decisions: bool = False) -> None:
    """Compare one proposal with every other submitted proposal and store the similar ones.

    keep_decisions=True (a coordinator re-checking by hand): flags that are still found keep their decision.
    keep_decisions=False (after a student resubmits): every flag starts again as pending, because the
    text has changed and the coordinator must judge the new version."""
    proposal = db.get(ThesisProposal, proposal_id)
    if proposal is None or proposal.status == ProposalStatus.draft:
        raise NotFoundError("Proposal not found")

    cfg = get_settings(db)
    others = list(db.scalars(
        select(ThesisProposal).where(ThesisProposal.id != proposal.id, ThesisProposal.status != ProposalStatus.draft)
    ))
    vectors = _ensure_embeddings(db, [("proposal", p.id, _text_of(p)) for p in [proposal, *others]], get_embedder())

    matches = find_matches(
        Query(proposal.title, vectors[("proposal", proposal.id)]),
        [Candidate(p.id, p.title, vectors[("proposal", p.id)]) for p in others],
        high=cfg["high_threshold"] / 100,
        possible=cfg["possible_threshold"] / 100,
        max_matches=MAX_MATCHES,
    )

    # Update in place so that the ids stay the same while the coordinator is looking at them.
    existing = {
        row.matched_proposal_id: row
        for row in db.scalars(select(ProposalSimilarity).where(ProposalSimilarity.proposal_id == proposal.id))
    }
    found = set()
    for m in matches:
        found.add(m.proposal_id)
        row = existing.get(m.proposal_id)
        if row is None:
            db.add(ProposalSimilarity(
                proposal_id=proposal.id, matched_proposal_id=m.proposal_id, similarity=round(m.similarity, 4),
                method=m.method, level=m.level,
            ))
            continue
        row.similarity, row.method, row.level = round(m.similarity, 4), m.method, m.level
        row.checked_at = datetime.now(timezone.utc)
        if not keep_decisions:
            row.decision, row.decided_by, row.decided_at, row.decision_note = "pending", None, None, ""
    for matched_id, row in existing.items():
        if matched_id not in found:
            db.delete(row)  # no longer similar
    log_audit(db, actor_id, "duplicate.check", "proposal", proposal.id, {"matches": len(matches)})
    db.flush()


def run_check_in_background(proposal_id: int, user_id: int | None) -> None:
    """Runs after a student's submission has been saved. It uses its own database session and must never
    break the submission: if the AI model is unavailable the coordinator can run the check by hand."""
    try:
        with SessionLocal() as db:
            run_check(db, proposal_id, user_id)
            db.commit()
    except Exception:
        log.exception("Automatic duplicate check failed for proposal %s", proposal_id)


# ------------------------------------------------------------------ reading
def list_matches(db: Session, proposal_id: int) -> list[DuplicateOut]:
    proposal = db.get(ThesisProposal, proposal_id)
    if proposal is None or proposal.status == ProposalStatus.draft:
        raise NotFoundError("Proposal not found")
    rows = db.scalars(
        select(ProposalSimilarity).where(ProposalSimilarity.proposal_id == proposal_id)
        .order_by(ProposalSimilarity.similarity.desc(), ProposalSimilarity.id)
    )
    return [
        DuplicateOut(
            id=row.id, similarity=round(float(row.similarity) * 100, 1), level=row.level, method=row.method,
            decision=row.decision, decision_note=row.decision_note, decided_at=row.decided_at,
            checked_at=row.checked_at, matched=proposal_service.serialize(db, row.matched),
        )
        for row in rows
    ]


def pending_flags(db: Session) -> list[DuplicateFlagOut]:
    """For the proposals list: which proposals waiting for review have an undecided similar proposal."""
    rows = db.execute(
        select(ProposalSimilarity.proposal_id, ProposalSimilarity.level, ProposalSimilarity.similarity)
        .join(ThesisProposal, ThesisProposal.id == ProposalSimilarity.proposal_id)
        .where(ProposalSimilarity.decision == "pending", ThesisProposal.status.in_(proposal_service.REVIEWABLE))
        .order_by(ProposalSimilarity.similarity.desc())
    ).all()
    best: dict[int, DuplicateFlagOut] = {}
    for proposal_id, level, similarity in rows:
        if proposal_id not in best:  # rows arrive best first
            best[proposal_id] = DuplicateFlagOut(
                proposal_id=proposal_id, level=level, similarity=round(float(similarity) * 100, 1),
            )
    return list(best.values())


# ----------------------------------------------------------------- deciding
def decide(db: Session, proposal_id: int, check_id: int, actor: User, decision: str, comment: str) -> None:
    row = db.get(ProposalSimilarity, check_id)
    if row is None or row.proposal_id != proposal_id:
        raise NotFoundError("Duplicate flag not found")
    if row.decision != "pending":
        raise ConflictError("This flag has already been decided")
    comment = comment.strip()

    if decision == "confirmed":
        # Reuses the normal review rules: the proposal must be waiting for review and a comment is required.
        proposal_service.review(db, proposal_id, actor, "revision_required", comment)
        latest = db.scalar(
            select(ProposalReview).where(ProposalReview.proposal_id == proposal_id)
            .order_by(ProposalReview.id.desc()).limit(1)
        )
        latest.reason = "duplicate"  # lets the student see why, without seeing the other proposal

    row.decision = decision
    row.decided_by = actor.id
    row.decided_at = datetime.now(timezone.utc)
    row.decision_note = comment
    action = "duplicate.confirm" if decision == "confirmed" else "duplicate.dismiss"
    log_audit(db, actor.id, action, "proposal", proposal_id, {"matched_proposal_id": row.matched_proposal_id})
    db.flush()