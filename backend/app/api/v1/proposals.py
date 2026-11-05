from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.errors import NotFoundError
from app.db.session import get_db
from app.models.thesis import ProposalStatus
from app.models.user import User, UserRole
from app.schemas.proposal import ProposalIn, ProposalOut, ReviewIn, ReviewOut, VersionOut
from app.services import duplicate_service, proposal_service as svc

router = APIRouter(prefix="/proposals", tags=["proposals"])

student_only = require_roles(UserRole.student)
staff = require_roles(UserRole.coordinator, UserRole.admin)
not_student = require_roles(UserRole.supervisor, UserRole.coordinator, UserRole.admin)


# The "/me" routes come first so that "me" is never read as a proposal id.
@router.get("/me", response_model=ProposalOut)
def get_my_proposal(user: User = Depends(student_only), db: Session = Depends(get_db)):
    proposal = svc.get_own(db, user)
    if proposal is None:
        raise NotFoundError("You have not started a proposal yet")
    return svc.serialize(db, proposal)


@router.put("/me", response_model=ProposalOut)
def save_my_proposal(body: ProposalIn, user: User = Depends(student_only), db: Session = Depends(get_db)):
    """Create the proposal on the first save, then update it while it is a draft or needs revision."""
    proposal = svc.save_draft(db, user, body)
    db.commit()
    return svc.serialize(db, proposal)


@router.post("/me/submit", response_model=ProposalOut)
def submit_my_proposal(
    background: BackgroundTasks, user: User = Depends(student_only), db: Session = Depends(get_db)
):
    proposal = svc.submit(db, user)
    db.commit()
    # The duplicate check runs after the response is sent, so a slow or unavailable AI model never blocks a student.
    background.add_task(duplicate_service.run_check_in_background, proposal.id, user.id)
    return svc.serialize(db, proposal)


@router.get("", response_model=list[ProposalOut])
def list_proposals(status: ProposalStatus | None = None, user: User = Depends(not_student),
                   db: Session = Depends(get_db)):
    """Coordinators and admins see every submitted proposal; supervisors see only their students'."""
    return [svc.serialize(db, p) for p in svc.list_for(db, user, status)]


@router.get("/{proposal_id}", response_model=ProposalOut)
def get_proposal(proposal_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.serialize(db, svc.get_visible(db, proposal_id, user))


@router.get("/{proposal_id}/versions", response_model=list[VersionOut])
def list_versions(proposal_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    svc.get_visible(db, proposal_id, user)
    return svc.versions_of(db, proposal_id)


@router.get("/{proposal_id}/reviews", response_model=list[ReviewOut])
def list_reviews(proposal_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    svc.get_visible(db, proposal_id, user)
    return svc.reviews_of(db, proposal_id)


@router.post("/{proposal_id}/start-review", response_model=ProposalOut)
def start_review(proposal_id: int, actor: User = Depends(staff), db: Session = Depends(get_db)):
    proposal = svc.start_review(db, proposal_id, actor)
    db.commit()
    return svc.serialize(db, proposal)


@router.post("/{proposal_id}/review", response_model=ProposalOut)
def review_proposal(proposal_id: int, body: ReviewIn, actor: User = Depends(staff), db: Session = Depends(get_db)):
    proposal = svc.review(db, proposal_id, actor, body.decision, body.comment)
    db.commit()
    return svc.serialize(db, proposal)