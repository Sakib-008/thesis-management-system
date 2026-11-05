from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from app.ai.embedder import Embedder, get_embedder, text_hash
from app.ai.recommender import Params, ProposalInput, SupervisorInput, recommend
from app.ai.scoring import Weights
from app.ai.text import proposal_text, supervisor_text
from app.core.errors import InvalidInputError, NotFoundError
from app.models.ai import SupervisorRecommendation, SystemSetting, TextEmbedding
from app.models.profile import Supervisor
from app.models.thesis import ProposalStatus, SupervisorAssignment, ThesisProposal
from app.models.user import User, UserRole
from app.schemas.recommendation import RecommendationOut, RecommendationSettings
from app.services import proposal_service
from app.services.audit import log_audit

SETTINGS_KEY = "recommendation"
DEFAULT_SETTINGS = {
    "weight_field": 40, "weight_semantic": 40, "weight_availability": 20,
    "top_n": 5, "min_score": 30, "cos_lo": 0.10, "cos_hi": 0.70,
}
ALLOWED_TOP_N = (3, 5, 10)


# ----------------------------------------------------------------- settings
def get_settings(db: Session) -> dict:
    row = db.get(SystemSetting, SETTINGS_KEY)
    return {**DEFAULT_SETTINGS, **(row.value if row else {})}


def update_settings(db: Session, actor: User, data: RecommendationSettings) -> dict:
    values = data.model_dump()
    if values["weight_field"] + values["weight_semantic"] + values["weight_availability"] != 100:
        raise InvalidInputError("The three weights must add up to exactly 100")
    if values["top_n"] not in ALLOWED_TOP_N:
        raise InvalidInputError("Supervisors shown must be 3, 5 or 10")
    if values["cos_lo"] >= values["cos_hi"]:
        raise InvalidInputError("The lower cosine value must be smaller than the upper one")

    row = db.get(SystemSetting, SETTINGS_KEY)
    if row is None:
        db.add(SystemSetting(key=SETTINGS_KEY, value=values, updated_by=actor.id))
    else:
        row.value = values
        row.updated_by = actor.id
    log_audit(db, actor.id, "settings.update_recommendation", "settings", None, values)
    db.flush()
    return values


def _params(cfg: dict) -> Params:
    return Params(
        weights=Weights(cfg["weight_field"], cfg["weight_semantic"], cfg["weight_availability"]),
        cos_lo=cfg["cos_lo"], cos_hi=cfg["cos_hi"], min_score=cfg["min_score"] / 100,
    )


# --------------------------------------------------------------- embeddings
def _ensure_embeddings(db: Session, wanted: list[tuple[str, int, str]], embedder: Embedder) -> dict:
    """Return a vector for every (kind, owner_id, text). Only texts that are new or changed are embedded."""
    existing = {}
    for kind in ("proposal", "supervisor"):
        ids = [owner for k, owner, _ in wanted if k == kind]
        if ids:
            rows = db.scalars(
                select(TextEmbedding).where(TextEmbedding.kind == kind, TextEmbedding.owner_id.in_(ids))
            )
            existing.update({(row.kind, row.owner_id): row for row in rows})

    vectors, stale = {}, []
    for kind, owner_id, text in wanted:
        digest = text_hash(embedder.name, text)
        row = existing.get((kind, owner_id))
        if row is not None and row.text_hash == digest:
            vectors[(kind, owner_id)] = list(row.vector)
        else:
            stale.append((kind, owner_id, text, digest))

    if stale:
        computed = embedder.embed([text for _, _, text, _ in stale])
        for (kind, owner_id, _, digest), vector in zip(stale, computed):
            row = existing.get((kind, owner_id))
            if row is None:
                db.add(TextEmbedding(
                    kind=kind, owner_id=owner_id, model=embedder.name, text_hash=digest, vector=vector,
                ))
            else:
                row.model, row.text_hash, row.vector = embedder.name, digest, vector
            vectors[(kind, owner_id)] = vector
        db.flush()
    return vectors


# --------------------------------------------------------------- generating
def generate(db: Session, proposal_id: int, actor: User) -> None:
    """Score every supervisor for one proposal and store the ranked result, replacing the previous one."""
    proposal = db.get(ThesisProposal, proposal_id)
    if proposal is None or proposal.status == ProposalStatus.draft:
        raise NotFoundError("Proposal not found")

    cfg = get_settings(db)
    supervisors = list(db.scalars(
        select(Supervisor).options(selectinload(Supervisor.fields)).order_by(Supervisor.id)
    ))
    embedder = get_embedder()

    wanted = [("proposal", proposal.id, proposal_text(
        proposal.title, proposal.abstract, proposal.keywords, proposal.problem_statement, proposal.objectives))]
    for sup in supervisors:
        if sup.expertise.strip():
            wanted.append(("supervisor", sup.id, supervisor_text([f.name for f in sup.fields], sup.expertise)))
    vectors = _ensure_embeddings(db, wanted, embedder)

    inputs = [
        SupervisorInput(
            id=sup.id, field_names={f.name for f in sup.fields},
            embedding=vectors.get(("supervisor", sup.id)), capacity=sup.capacity, current=sup.current_count,
        )
        for sup in supervisors
    ]
    results = recommend(
        ProposalInput({f.name for f in proposal.fields}, vectors[("proposal", proposal.id)]), inputs, _params(cfg)
    )

    db.execute(delete(SupervisorRecommendation).where(SupervisorRecommendation.proposal_id == proposal.id))
    capacity = {s.id: (s.current_count, s.capacity) for s in supervisors}
    for r in results:
        current, cap = capacity[r.supervisor_id]
        db.add(SupervisorRecommendation(
            proposal_id=proposal.id, supervisor_id=r.supervisor_id,
            field_score=round(r.field, 4), semantic_score=round(r.semantic, 4),
            workload_score=round(r.availability, 4), final_score=round(r.total, 4),
            reasons_json={
                "rank": r.rank,
                "weights": {"field": cfg["weight_field"], "semantic": cfg["weight_semantic"],
                            "availability": cfg["weight_availability"]},
                "components": {"field": r.field, "semantic": r.semantic, "availability": r.availability},
                "matched_fields": r.matched_fields,
                "cosine": r.cosine,
                "capacity": {"current": current, "capacity": cap},
                "flags": r.flags,
                "summary": r.summary,
            },
        ))
    log_audit(db, actor.id, "recommendation.generate", "proposal", proposal.id, {"supervisors": len(results)})
    db.flush()


# ------------------------------------------------------------------ reading
def read(db: Session, proposal_id: int, user: User, limit: int | None = None) -> list[RecommendationOut]:
    proposal = db.get(ThesisProposal, proposal_id)
    if proposal is None or proposal.status == ProposalStatus.draft:
        raise NotFoundError("Proposal not found")

    if user.role == UserRole.student:
        own = proposal_service.get_own(db, user)
        if own is None or own.id != proposal.id:
            raise NotFoundError("Proposal not found")
        assigned = db.scalar(
            select(SupervisorAssignment.id).where(SupervisorAssignment.proposal_id == proposal.id)
        )
        if assigned is None:
            raise NotFoundError("Recommendations are shown after a supervisor has been assigned")

    rows = list(db.scalars(
        select(SupervisorRecommendation)
        .options(
            selectinload(SupervisorRecommendation.supervisor).selectinload(Supervisor.user),
            selectinload(SupervisorRecommendation.supervisor).selectinload(Supervisor.designation),
            selectinload(SupervisorRecommendation.supervisor).selectinload(Supervisor.department),
        )
        .where(SupervisorRecommendation.proposal_id == proposal.id)
    ))
    rows.sort(key=lambda row: row.reasons_json["rank"])
    if limit is None:
        limit = get_settings(db)["top_n"]

    out = []
    for row in rows[:limit]:
        why, sup = row.reasons_json, row.supervisor
        out.append(RecommendationOut(
            supervisor_id=sup.id, supervisor_name=sup.user.full_name, designation=sup.designation.name,
            department=sup.department.name, rank=why["rank"],
            score=round(float(row.final_score) * 100, 1), field=round(float(row.field_score) * 100, 1),
            semantic=round(float(row.semantic_score) * 100, 1),
            availability=round(float(row.workload_score) * 100, 1),
            cosine=why["cosine"], matched_fields=why["matched_fields"],
            capacity=why["capacity"]["capacity"], current=why["capacity"]["current"],
            flags=why["flags"], summary=why["summary"], generated_at=row.generated_at,
        ))
    return out