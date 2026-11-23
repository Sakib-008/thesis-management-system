from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.evaluation import (
    CriteriaIn,
    CriteriaOut,
    EvaluationDetail,
    EvaluationIn,
    EvaluationRow,
    GradeBand,
    GradingIn,
    GradingOut,
    ResultOut,
)
from app.services import evaluation_service as svc

router = APIRouter(prefix="/evaluation", tags=["evaluation"])

admin_only = require_roles(UserRole.admin)
coordinator_only = require_roles(UserRole.coordinator)
evaluators = require_roles(UserRole.supervisor, UserRole.coordinator)
staff = require_roles(UserRole.supervisor, UserRole.coordinator, UserRole.admin)
student_only = require_roles(UserRole.student)


# ------------------------------------------------------- criteria and grading
@router.get("/criteria", response_model=CriteriaOut)
def get_criteria(user: User = Depends(staff), db: Session = Depends(get_db)):
    """The admin sees every criterion, including the ones switched off. Everyone else sees the active ones."""
    return svc.criteria_out(db, include_inactive=user.role == UserRole.admin)


@router.put("/criteria", response_model=CriteriaOut)
def put_criteria(body: CriteriaIn, user: User = Depends(admin_only), db: Session = Depends(get_db)):
    result = svc.set_criteria(db, user, body)
    db.commit()
    return result


@router.get("/grading", response_model=GradingOut)
def get_grading(_: User = Depends(staff), db: Session = Depends(get_db)):
    return GradingOut(bands=[GradeBand(**b) for b in svc.get_bands(db)])


@router.put("/grading", response_model=GradingOut)
def put_grading(body: GradingIn, user: User = Depends(admin_only), db: Session = Depends(get_db)):
    bands = svc.set_grading(db, user, body)
    db.commit()
    return GradingOut(bands=[GradeBand(**b) for b in bands])


# ------------------------------------------------------------------ evaluating
# Marks belong to each student. The student is chosen with ?student_id=; without it, the first student of the team.
StudentQuery = Query(default=None, description="The student the marks are for")


@router.get("/theses", response_model=list[EvaluationRow])
def list_theses(user: User = Depends(evaluators), db: Session = Depends(get_db)):
    """One row for each student. A supervisor sees their own students, a coordinator every supervised student."""
    return svc.list_theses(db, user)


@router.get("/theses/{thesis_id}", response_model=EvaluationDetail)
def get_thesis(
    thesis_id: int,
    student_id: int | None = StudentQuery,
    user: User = Depends(evaluators),
    db: Session = Depends(get_db),
):
    return svc.detail(db, thesis_id, user, student_id)


@router.put("/theses/{thesis_id}/mine", response_model=EvaluationDetail)
def save_mine(
    thesis_id: int,
    body: EvaluationIn,
    student_id: int | None = StudentQuery,
    user: User = Depends(evaluators),
    db: Session = Depends(get_db),
):
    svc.save_mine(db, thesis_id, user, body, student_id)
    db.commit()
    return svc.detail(db, thesis_id, user, student_id)


@router.delete("/theses/{thesis_id}/mine", response_model=EvaluationDetail)
def discard_mine(
    thesis_id: int,
    student_id: int | None = StudentQuery,
    user: User = Depends(evaluators),
    db: Session = Depends(get_db),
):
    """Throw away my own draft evaluation, so that it no longer blocks publishing."""
    svc.discard_mine(db, thesis_id, user, student_id)
    db.commit()
    return svc.detail(db, thesis_id, user, student_id)


@router.post("/theses/{thesis_id}/mine/submit", response_model=EvaluationDetail)
def submit_mine(
    thesis_id: int,
    student_id: int | None = StudentQuery,
    user: User = Depends(evaluators),
    db: Session = Depends(get_db),
):
    svc.submit_mine(db, thesis_id, user, student_id)
    db.commit()
    return svc.detail(db, thesis_id, user, student_id)


@router.post("/theses/{thesis_id}/evaluations/{evaluation_id}/reopen", response_model=EvaluationDetail)
def reopen(
    thesis_id: int,
    evaluation_id: int,
    user: User = Depends(coordinator_only),
    db: Session = Depends(get_db),
):
    evaluation = svc.reopen(db, thesis_id, evaluation_id, user)
    db.commit()
    return svc.detail(db, thesis_id, user, evaluation.student_id)


@router.post("/theses/{thesis_id}/publish", response_model=EvaluationDetail)
def publish(
    thesis_id: int,
    student_id: int | None = StudentQuery,
    user: User = Depends(coordinator_only),
    db: Session = Depends(get_db),
):
    """Publish one student's result. The other students of the team are published on their own."""
    svc.publish(db, thesis_id, user, student_id)
    db.commit()
    return svc.detail(db, thesis_id, user, student_id)


@router.post("/theses/{thesis_id}/unpublish", response_model=EvaluationDetail)
def unpublish(
    thesis_id: int,
    student_id: int | None = StudentQuery,
    user: User = Depends(coordinator_only),
    db: Session = Depends(get_db),
):
    svc.unpublish(db, thesis_id, user, student_id)
    db.commit()
    return svc.detail(db, thesis_id, user, student_id)


# --------------------------------------------------------------------- student
@router.get("/my-result", response_model=ResultOut)
def my_result(user: User = Depends(student_only), db: Session = Depends(get_db)):
    """The published result of the signed-in student only. Until it is published, they see nothing of it."""
    return svc.my_result(db, user)
