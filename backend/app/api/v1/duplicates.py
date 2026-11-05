from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.duplicate import (
    DuplicateDecisionIn, DuplicateFlagOut, DuplicateOut, DuplicateSettings,
)
from app.services import duplicate_service as svc

router = APIRouter(tags=["duplicates"])

# Students never see duplicate information, not even about their own proposal.
staff = require_roles(UserRole.coordinator, UserRole.admin)
admin_only = require_roles(UserRole.admin)


@router.get("/duplicates/pending", response_model=list[DuplicateFlagOut])
def pending_flags(_: User = Depends(staff), db: Session = Depends(get_db)):
    return svc.pending_flags(db)


@router.get("/proposals/{proposal_id}/duplicates", response_model=list[DuplicateOut])
def list_duplicates(proposal_id: int, _: User = Depends(staff), db: Session = Depends(get_db)):
    return svc.list_matches(db, proposal_id)


@router.post("/proposals/{proposal_id}/duplicates/check", response_model=list[DuplicateOut])
def run_duplicate_check(proposal_id: int, actor: User = Depends(staff), db: Session = Depends(get_db)):
    """Run the check now. The first call loads the AI model and can take a while."""
    svc.run_check(db, proposal_id, actor.id, keep_decisions=True)
    db.commit()
    return svc.list_matches(db, proposal_id)


@router.post("/proposals/{proposal_id}/duplicates/{check_id}/decision", response_model=list[DuplicateOut])
def decide_duplicate(
    proposal_id: int, check_id: int, body: DuplicateDecisionIn,
    actor: User = Depends(staff), db: Session = Depends(get_db),
):
    """'dismissed' means not a duplicate. 'confirmed' asks the student to revise (a comment is required)."""
    svc.decide(db, proposal_id, check_id, actor, body.decision, body.comment)
    db.commit()
    return svc.list_matches(db, proposal_id)


@router.get("/settings/duplicate", response_model=DuplicateSettings)
def get_duplicate_settings(_: User = Depends(staff), db: Session = Depends(get_db)):
    return svc.get_settings(db)


@router.put("/settings/duplicate", response_model=DuplicateSettings)
def update_duplicate_settings(
    body: DuplicateSettings, actor: User = Depends(admin_only), db: Session = Depends(get_db)
):
    values = svc.update_settings(db, actor, body)
    db.commit()
    return values