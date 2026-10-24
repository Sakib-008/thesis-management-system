from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.errors import NotFoundError
from app.db.session import get_db
from app.models.profile import Supervisor
from app.models.user import User, UserRole
from app.schemas.profile import SupervisorAdminUpdate, SupervisorCreate, SupervisorOut, SupervisorUpdate
from app.services import profile_service
from app.services.reference_service import get_or_404

router = APIRouter(prefix="/supervisors", tags=["supervisors"])

supervisor_only = require_roles(UserRole.supervisor)
staff = require_roles(UserRole.coordinator, UserRole.admin)
admin_only = require_roles(UserRole.admin)


@router.get("/me", response_model=SupervisorOut)
def get_my_profile(user: User = Depends(supervisor_only), db: Session = Depends(get_db)):
    supervisor = profile_service.get_supervisor_by_user(db, user.id)
    if supervisor is None:
        raise NotFoundError("Supervisor profile not found")
    return supervisor


@router.post("/me", response_model=SupervisorOut, status_code=status.HTTP_201_CREATED)
def create_my_profile(body: SupervisorCreate, user: User = Depends(supervisor_only), db: Session = Depends(get_db)):
    supervisor = profile_service.create_supervisor(
        db, user, department_id=body.department_id, designation_id=body.designation_id,
        expertise=body.expertise, field_ids=body.field_ids,
    )
    db.commit()
    return profile_service.get_supervisor_full(db, supervisor.id)


@router.put("/me", response_model=SupervisorOut)
def update_my_profile(body: SupervisorUpdate, user: User = Depends(supervisor_only), db: Session = Depends(get_db)):
    supervisor = profile_service.get_supervisor_by_user(db, user.id)
    if supervisor is None:
        raise NotFoundError("Supervisor profile not found")
    profile_service.update_supervisor_profile(
        db, supervisor, department_id=body.department_id,
        expertise=body.expertise, field_ids=body.field_ids,
    )
    db.commit()
    return profile_service.get_supervisor_full(db, supervisor.id)


@router.get("", response_model=list[SupervisorOut])
def list_supervisors(db: Session = Depends(get_db), _: User = Depends(staff)):
    return profile_service.list_supervisors(db)


@router.patch("/{supervisor_id}", response_model=SupervisorOut)
def admin_update_supervisor(supervisor_id: int, body: SupervisorAdminUpdate, db: Session = Depends(get_db),
                            admin: User = Depends(admin_only)):
    """Admin sets a supervisor's designation and capacity."""
    supervisor = get_or_404(db, Supervisor, supervisor_id, "Supervisor")
    profile_service.admin_update_supervisor(
        db, supervisor, admin, designation_id=body.designation_id, capacity=body.capacity,
    )
    db.commit()
    return profile_service.get_supervisor_full(db, supervisor_id)