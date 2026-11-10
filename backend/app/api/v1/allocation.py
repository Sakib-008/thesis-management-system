from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.allocation import (
    AssignIn, AssignmentOut, ReadinessOut, RunOut, RunSummaryOut, WaitingOut,
)
from app.services import allocation_service as svc

router = APIRouter(tags=["allocation"])
staff = require_roles(UserRole.coordinator, UserRole.admin)


@router.get("/allocation/readiness", response_model=ReadinessOut)
def readiness(_: User = Depends(staff), db: Session = Depends(get_db)):
    return svc.readiness(db)


@router.post("/allocation/runs", response_model=RunOut)
def run_allocation(actor: User = Depends(staff), db: Session = Depends(get_db)):
    """Place every waiting student with a verified CGPA. All or nothing: it is one transaction."""
    result = svc.run(db, actor)
    db.commit()
    return result


@router.get("/allocation/runs", response_model=list[RunSummaryOut])
def list_runs(_: User = Depends(staff), db: Session = Depends(get_db)):
    return svc.list_runs(db)


@router.get("/allocation/runs/{run_id}", response_model=RunOut)
def get_run(run_id: int, _: User = Depends(staff), db: Session = Depends(get_db)):
    return svc.get_run(db, run_id)


@router.get("/assignments", response_model=list[AssignmentOut])
def list_assignments(_: User = Depends(staff), db: Session = Depends(get_db)):
    return svc.list_assignments(db)


@router.get("/assignments/waiting", response_model=list[WaitingOut])
def list_waiting(_: User = Depends(staff), db: Session = Depends(get_db)):
    return svc.list_waiting(db)


@router.put("/proposals/{proposal_id}/assignment", response_model=list[AssignmentOut])
def assign_supervisor(
    proposal_id: int, body: AssignIn, actor: User = Depends(staff), db: Session = Depends(get_db)
):
    """Give an approved proposal a supervisor, or change it. A reason is required."""
    svc.assign_manually(db, proposal_id, body.supervisor_id, actor, body.reason)
    db.commit()
    return svc.list_assignments(db)
