from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.recommendation import RecommendationOut, RecommendationSettings
from app.services import recommendation_service as svc

router = APIRouter(tags=["recommendations"])

staff = require_roles(UserRole.coordinator, UserRole.admin)
admin_only = require_roles(UserRole.admin)
can_read = require_roles(UserRole.student, UserRole.coordinator, UserRole.admin)


@router.post("/proposals/{proposal_id}/recommendations", response_model=list[RecommendationOut])
def generate_recommendations(proposal_id: int, actor: User = Depends(staff), db: Session = Depends(get_db)):
    """Score all supervisors for this proposal. The first call loads the AI model and can take a while."""
    svc.generate(db, proposal_id, actor)
    db.commit()
    return svc.read(db, proposal_id, actor)


@router.get("/proposals/{proposal_id}/recommendations", response_model=list[RecommendationOut])
def get_recommendations(
    proposal_id: int,
    limit: int | None = Query(default=None, ge=1, le=50),
    user: User = Depends(can_read),
    db: Session = Depends(get_db),
):
    """Coordinators and admins can always read them; a student only after a supervisor has been assigned."""
    return svc.read(db, proposal_id, user, limit)


@router.get("/settings/recommendation", response_model=RecommendationSettings)
def get_recommendation_settings(_: User = Depends(staff), db: Session = Depends(get_db)):
    return svc.get_settings(db)


@router.put("/settings/recommendation", response_model=RecommendationSettings)
def update_recommendation_settings(
    body: RecommendationSettings, actor: User = Depends(admin_only), db: Session = Depends(get_db)
):
    values = svc.update_settings(db, actor, body)
    db.commit()
    return values