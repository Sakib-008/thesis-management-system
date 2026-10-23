from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.user import AdminCreateUserRequest, AdminUpdateUserRequest, UserOut
from app.services import user_service
from app.services.audit import log_audit

router = APIRouter(prefix="/users", tags=["users (admin)"])

admin_only = require_roles(UserRole.admin)


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(body: AdminCreateUserRequest, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    """Only an admin can create coordinator and admin accounts."""
    try:
        user = user_service.create_user(
            db, email=body.email, full_name=body.full_name,
            password=body.password, role=body.role, created_by=admin.id,
        )
    except user_service.EmailAlreadyRegistered:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    log_audit(db, admin.id, "user.create", "user", user.id, {"role": user.role.value})
    db.commit()
    db.refresh(user)
    return user


@router.get("", response_model=list[UserOut])
def list_users(role: UserRole | None = None, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    return user_service.list_users(db, role)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, body: AdminUpdateUserRequest, db: Session = Depends(get_db),
                admin: User = Depends(admin_only)):
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    try:
        user_service.update_user(db, target=target, actor=admin, full_name=body.full_name,
                                 role=body.role, is_active=body.is_active)
    except user_service.CannotModifyOwnAccount:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "You cannot deactivate or demote your own account")
    db.commit()
    db.refresh(target)
    return target