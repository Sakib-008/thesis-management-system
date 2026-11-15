from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.errors import ConflictError, InvalidInputError, NotFoundError
from app.models.ai import SystemSetting
from app.models.evaluation import Evaluation, EvaluationCriterion, ThesisResult
from app.models.profile import Supervisor
from app.models.thesis import SupervisorAssignment, ThesisProposal
from app.models.user import User, UserRole
from app.schemas.evaluation import (
    CriteriaIn,
    CriteriaOut,
    CriterionOut,
    EvaluationDetail,
    EvaluationIn,
    EvaluationOut,
    EvaluationRow,
    GradeBand,
    GradingIn,
    ResultComment,
    ResultCriterion,
    ResultOut,
    ScoreOut,
)
from app.services import meeting_service as meetings
from app.services.audit import log_audit

GRADING_KEY = "grading"
DEFAULT_BANDS = [
    {"min": 80, "grade": "A+"},
    {"min": 75, "grade": "A"},
    {"min": 70, "grade": "A-"},
    {"min": 65, "grade": "B+"},
    {"min": 60, "grade": "B"},
    {"min": 55, "grade": "B-"},
    {"min": 50, "grade": "C+"},
    {"min": 45, "grade": "C"},
    {"min": 40, "grade": "D"},
    {"min": 0, "grade": "F"},
]


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------- criteria
def _criterion_out(c: EvaluationCriterion) -> CriterionOut:
    return CriterionOut(
        id=c.id, name=c.name, description=c.description, weight=float(c.weight), is_active=c.is_active
    )


def _all_criteria(db: Session) -> list[EvaluationCriterion]:
    return list(
        db.scalars(select(EvaluationCriterion).order_by(EvaluationCriterion.sort_order, EvaluationCriterion.id))
    )


def criteria_out(db: Session, include_inactive: bool = False) -> CriteriaOut:
    rows = _all_criteria(db)
    total = round(sum(float(c.weight) for c in rows if c.is_active), 2)
    shown = rows if include_inactive else [c for c in rows if c.is_active]
    return CriteriaOut(criteria=[_criterion_out(c) for c in shown], active_total=total, valid=abs(total - 100) < 0.01)


def set_criteria(db: Session, actor: User, data: CriteriaIn) -> CriteriaOut:
    """Replace the whole list. The weights of the active criteria must add up to exactly 100."""
    names = [c.name.strip().casefold() for c in data.criteria]
    if len(set(names)) != len(names):
        raise InvalidInputError("Each criterion needs its own name")
    total = round(sum(c.weight for c in data.criteria if c.is_active), 2)
    if abs(total - 100) >= 0.01:
        raise InvalidInputError(f"The weights of the active criteria must add up to 100. They add up to {total:g}")
    existing = {c.id: c for c in _all_criteria(db)}
    kept: set[int] = set()
    for order, item in enumerate(data.criteria, start=1):
        row = existing.get(item.id) if item.id else None
        if row is None:
            row = EvaluationCriterion()
            db.add(row)
        row.name, row.description = item.name.strip(), item.description.strip()
        row.weight, row.is_active, row.sort_order = Decimal(str(item.weight)), item.is_active, order
        db.flush()
        kept.add(row.id)
    for cid, row in existing.items():
        if cid not in kept:
            db.delete(row)  # evaluations keep their own copy of the names and weights, so nothing is lost
    log_audit(db, actor.id, "evaluation.criteria_update", "settings", None, {"count": len(data.criteria)})
    db.flush()
    return criteria_out(db, include_inactive=True)


# ------------------------------------------------------------------ grading
def get_bands(db: Session) -> list[dict]:
    row = db.get(SystemSetting, GRADING_KEY)
    bands = (row.value.get("bands") if row else None) or DEFAULT_BANDS
    return sorted(bands, key=lambda b: -b["min"])


def set_grading(db: Session, actor: User, data: GradingIn) -> list[dict]:
    bands = sorted(({"min": b.min, "grade": b.grade.strip()} for b in data.bands), key=lambda b: -b["min"])
    row = db.get(SystemSetting, GRADING_KEY)
    if row is None:
        db.add(SystemSetting(key=GRADING_KEY, value={"bands": bands}, updated_by=actor.id))
    else:
        row.value = {"bands": bands}
        row.updated_by = actor.id
    log_audit(db, actor.id, "evaluation.grading_update", "settings", None, {"bands": len(bands)})
    db.flush()
    return bands


def grade_for(bands: list[dict], total: float) -> str:
    for band in bands:  # highest first
        if total >= band["min"]:
            return band["grade"]
    return bands[-1]["grade"] if bands else ""


# --------------------------------------------------------------- who may see a thesis
def _supervised_proposals(db: Session, user: User) -> list[ThesisProposal]:
    stmt = select(ThesisProposal).join(SupervisorAssignment, SupervisorAssignment.proposal_id == ThesisProposal.id)
    if user.role == UserRole.supervisor:
        stmt = stmt.join(Supervisor, Supervisor.id == SupervisorAssignment.supervisor_id).where(
            Supervisor.user_id == user.id
        )
    return list(db.scalars(stmt.order_by(ThesisProposal.id)))


def _proposal_for(db: Session, thesis_id: int, user: User) -> ThesisProposal:
    """A thesis that has a supervisor, and that this person may evaluate: its supervisor or a coordinator."""
    proposal = meetings.proposal_of_thesis(db, thesis_id)
    supervisor = meetings.supervisor_of_thesis(db, thesis_id)
    if proposal is None or supervisor is None:
        raise NotFoundError("Thesis not found")
    if user.role == UserRole.supervisor and supervisor.user_id != user.id:
        raise NotFoundError("Thesis not found")
    if user.role not in (UserRole.supervisor, UserRole.coordinator):
        raise NotFoundError("Thesis not found")
    return proposal


# ---------------------------------------------------------------- marks
def _total(scores: list[dict]) -> float:
    weights = sum(s["weight"] for s in scores)
    if weights <= 0:
        return 0.0
    return round(sum(s["weight"] * (s["score"] or 0) for s in scores) / weights, 2)


def _evaluation_out(ev: Evaluation | None, evaluator: User, bands: list[dict]) -> EvaluationOut:
    if ev is None:
        return EvaluationOut(
            id=None,
            evaluator_name=evaluator.full_name,
            evaluator_role=evaluator.role.value,
            status="none",
            scores=[],
            comment="",
            total=0.0,
            grade="",
            submitted_at=None,
            updated_at=None,
        )
    total = float(ev.total)
    return EvaluationOut(
        id=ev.id,
        evaluator_name=ev.evaluator.full_name,
        evaluator_role=ev.evaluator.role.value,
        status=ev.status,
        scores=[ScoreOut(**s) for s in ev.scores_json],
        comment=ev.comment,
        total=total,
        grade=grade_for(bands, total) if ev.status == "final" else "",
        submitted_at=ev.submitted_at,
        updated_at=ev.updated_at,
    )


def _evaluations_of(db: Session, thesis_id: int) -> list[Evaluation]:
    return list(db.scalars(select(Evaluation).where(Evaluation.thesis_id == thesis_id).order_by(Evaluation.id)))


def _result_out(db: Session, thesis_id: int) -> ResultOut:
    row = db.scalar(select(ThesisResult).where(ThesisResult.thesis_id == thesis_id))
    if row is None:
        return ResultOut(published=False)
    return ResultOut(
        published=True,
        total=float(row.final_total),
        grade=row.grade,
        evaluators_count=row.evaluators_count,
        criteria=[ResultCriterion(**c) for c in row.breakdown],
        comments=[ResultComment(**c) for c in row.comments],
        published_at=row.published_at,
    )


def _names(db: Session, thesis_id: int) -> list[str]:
    return [s.user.full_name for s in meetings.students_of_thesis(db, thesis_id)]


def list_theses(db: Session, user: User) -> list[EvaluationRow]:
    bands = get_bands(db)
    out = []
    for proposal in _supervised_proposals(db, user):
        evaluations = _evaluations_of(db, proposal.thesis_id)
        finals = [e for e in evaluations if e.status == "final"]
        mine = next((e for e in evaluations if e.evaluator_id == user.id), None)
        average = round(sum(float(e.total) for e in finals) / len(finals), 2) if finals else None
        supervisor = meetings.supervisor_of_thesis(db, proposal.thesis_id)
        out.append(
            EvaluationRow(
                thesis_id=proposal.thesis_id,
                proposal_id=proposal.id,
                title=proposal.title,
                student_names=_names(db, proposal.thesis_id),
                supervisor_name=supervisor.user.full_name if supervisor else None,
                my_status=mine.status if mine else "none",
                finals=len(finals),
                drafts=len(evaluations) - len(finals),
                average=average,
                grade=grade_for(bands, average) if average is not None else None,
                published=_result_out(db, proposal.thesis_id).published,
            )
        )
    return out


def detail(db: Session, thesis_id: int, user: User) -> EvaluationDetail:
    proposal = _proposal_for(db, thesis_id, user)
    bands = get_bands(db)
    evaluations = _evaluations_of(db, thesis_id)
    mine = next((e for e in evaluations if e.evaluator_id == user.id), None)
    others = [e for e in evaluations if e.evaluator_id != user.id] if user.role == UserRole.coordinator else []
    criteria = criteria_out(db)
    result = _result_out(db, thesis_id)
    finals = sum(1 for e in evaluations if e.status == "final")
    drafts = len(evaluations) - finals
    blocked = None
    if result.published:
        blocked = "The result is already published"
    elif finals == 0:
        blocked = "No evaluation has been submitted yet"
    elif drafts > 0:
        blocked = "Some evaluators have not finished their evaluation"
    supervisor = meetings.supervisor_of_thesis(db, thesis_id)
    return EvaluationDetail(
        thesis_id=thesis_id,
        proposal_id=proposal.id,
        title=proposal.title,
        student_names=_names(db, thesis_id),
        supervisor_name=supervisor.user.full_name if supervisor else None,
        criteria=criteria.criteria,
        criteria_valid=criteria.valid,
        bands=[GradeBand(**b) for b in bands],
        mine=_evaluation_out(mine, user, bands),
        others=[_evaluation_out(e, e.evaluator, bands) for e in others],
        result=result,
        can_publish=user.role == UserRole.coordinator and blocked is None,
        blocked_reason=blocked,
    )


def _editable(db: Session, thesis_id: int, user: User) -> tuple[Evaluation | None, list[EvaluationCriterion]]:
    _proposal_for(db, thesis_id, user)
    criteria = [c for c in _all_criteria(db) if c.is_active]
    if not criteria or abs(sum(float(c.weight) for c in criteria) - 100) >= 0.01:
        raise ConflictError("The evaluation criteria are not ready. The admin must set weights that add up to 100")
    if _result_out(db, thesis_id).published:
        raise ConflictError("The result is published. The coordinator must unpublish it before anything changes")
    mine = db.scalar(select(Evaluation).where(Evaluation.thesis_id == thesis_id, Evaluation.evaluator_id == user.id))
    if mine is not None and mine.status == "final":
        raise ConflictError("Your evaluation is final. Ask the coordinator to reopen it to change it")
    return mine, criteria


def save_mine(db: Session, thesis_id: int, user: User, data: EvaluationIn) -> Evaluation:
    mine, criteria = _editable(db, thesis_id, user)
    by_id = {c.id: c for c in criteria}
    given: dict[int, float] = {}
    for item in data.scores:
        if item.criterion_id not in by_id:
            raise InvalidInputError("One of the scores is for a criterion that does not exist")
        given[item.criterion_id] = item.score
    scores = [
        {"criterion_id": c.id, "name": c.name, "weight": float(c.weight), "score": given.get(c.id)} for c in criteria
    ]
    if mine is None:
        mine = Evaluation(thesis_id=thesis_id, evaluator_id=user.id, status="draft")
        db.add(mine)
    mine.scores_json = scores
    mine.comment = data.comment.strip()
    mine.total = Decimal(str(_total(scores)))
    mine.updated_at = _now()
    db.flush()
    return mine


def submit_mine(db: Session, thesis_id: int, user: User) -> Evaluation:
    mine, _ = _editable(db, thesis_id, user)
    if mine is None or any(s["score"] is None for s in mine.scores_json):
        raise InvalidInputError("Give a score for every criterion before you submit")
    mine.status = "final"
    mine.submitted_at = mine.updated_at = _now()
    log_audit(db, user.id, "evaluation.submit", "thesis", thesis_id, {"total": float(mine.total)})
    db.flush()
    return mine


def discard_mine(db: Session, thesis_id: int, user: User) -> None:
    """Throw away my own unfinished evaluation. Without this, a forgotten draft would block publishing for good."""
    _proposal_for(db, thesis_id, user)
    mine = db.scalar(select(Evaluation).where(Evaluation.thesis_id == thesis_id, Evaluation.evaluator_id == user.id))
    if mine is None:
        raise NotFoundError("You have not started an evaluation for this thesis")
    if mine.status == "final":
        raise ConflictError("Your evaluation is final. Ask the coordinator to reopen it first")
    if _result_out(db, thesis_id).published:
        raise ConflictError("The result is published. The coordinator must unpublish it before anything changes")
    db.delete(mine)
    log_audit(db, user.id, "evaluation.discard", "thesis", thesis_id)
    db.flush()


def reopen(db: Session, thesis_id: int, evaluation_id: int, user: User) -> Evaluation:
    _proposal_for(db, thesis_id, user)
    ev = db.get(Evaluation, evaluation_id)
    if ev is None or ev.thesis_id != thesis_id:
        raise NotFoundError("Evaluation not found")
    if _result_out(db, thesis_id).published:
        raise ConflictError("Unpublish the result first")
    if ev.status != "final":
        raise ConflictError("This evaluation is not final")
    ev.status, ev.submitted_at, ev.updated_at = "draft", None, _now()
    log_audit(db, user.id, "evaluation.reopen", "thesis", thesis_id, {"evaluator": ev.evaluator_id})
    db.flush()
    return ev


# ---------------------------------------------------------------- publishing
def publish(db: Session, thesis_id: int, user: User) -> ResultOut:
    _proposal_for(db, thesis_id, user)
    if _result_out(db, thesis_id).published:
        raise ConflictError("The result is already published")
    evaluations = _evaluations_of(db, thesis_id)
    finals = [e for e in evaluations if e.status == "final"]
    if not finals:
        raise ConflictError("No evaluation has been submitted yet")
    if len(finals) < len(evaluations):
        raise ConflictError("Some evaluators have not finished their evaluation")
    total = round(sum(float(e.total) for e in finals) / len(finals), 2)
    per_criterion: dict[int, dict] = {}
    for ev in finals:
        for s in ev.scores_json:
            slot = per_criterion.setdefault(
                s["criterion_id"], {"name": s["name"], "weight": s["weight"], "sum": 0.0, "n": 0}
            )
            slot["sum"] += s["score"]
            slot["n"] += 1
    breakdown = [
        {"name": v["name"], "weight": v["weight"], "average": round(v["sum"] / v["n"], 2)}
        for v in per_criterion.values()
    ]
    comments = [{"evaluator_name": e.evaluator.full_name, "comment": e.comment} for e in finals if e.comment]
    db.add(
        ThesisResult(
            thesis_id=thesis_id,
            final_total=Decimal(str(total)),
            grade=grade_for(get_bands(db), total),
            evaluators_count=len(finals),
            breakdown=breakdown,
            comments=comments,
            published_by=user.id,
        )
    )
    log_audit(db, user.id, "evaluation.publish", "thesis", thesis_id, {"total": total})
    db.flush()
    return _result_out(db, thesis_id)


def unpublish(db: Session, thesis_id: int, user: User) -> None:
    _proposal_for(db, thesis_id, user)
    row = db.scalar(select(ThesisResult).where(ThesisResult.thesis_id == thesis_id))
    if row is None:
        raise ConflictError("The result is not published")
    db.delete(row)
    log_audit(db, user.id, "evaluation.unpublish", "thesis", thesis_id)
    db.flush()


def my_result(db: Session, user: User) -> ResultOut:
    thesis_id = meetings.own_thesis_id(db, user)
    if thesis_id is None:
        return ResultOut(published=False)
    return _result_out(db, thesis_id)
