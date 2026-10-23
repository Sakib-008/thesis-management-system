from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.user import User, UserRole
from app.services.audit import log_audit

# Used to burn the same time as a real check when the email is unknown,
# so response timing doesn't reveal which emails exist.
_DUMMY_HASH = hash_password("not-a-real-password")


class EmailAlreadyRegistered(Exception):
    pass


class CannotModifyOwnAccount(Exception):
    pass


def get_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.strip().lower()))


def create_user(db: Session, *, email: str, full_name: str, password: str,
                role: UserRole, created_by: int | None = None) -> User:
    if get_by_email(db, email):
        raise EmailAlreadyRegistered()
    user = User(
        email=email.strip().lower(),
        full_name=full_name.strip(),
        password_hash=hash_password(password),
        role=role,
        created_by=created_by,
    )
    db.add(user)
    try:
        db.flush()  # assigns user.id and surfaces a unique-constraint race
    except IntegrityError:
        db.rollback()
        raise EmailAlreadyRegistered()
    return user


def authenticate(db: Session, email: str, password: str) -> User | None:
    user = get_by_email(db, email)
    if user is None:
        verify_password(password, _DUMMY_HASH)
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def list_users(db: Session, role: UserRole | None = None) -> list[User]:
    stmt = select(User).order_by(User.id)
    if role is not None:
        stmt = stmt.where(User.role == role)
    return list(db.scalars(stmt))


def update_user(db: Session, *, target: User, actor: User, full_name: str | None,
                role: UserRole | None, is_active: bool | None) -> User:
    # An admin must not lock themselves out by demoting or deactivating their own account.
    if target.id == actor.id:
        if (role is not None and role != UserRole.admin) or is_active is False:
            raise CannotModifyOwnAccount()

    before = {"role": target.role.value, "is_active": target.is_active, "full_name": target.full_name}
    if full_name is not None:
        target.full_name = full_name.strip()
    if role is not None:
        target.role = role
    if is_active is not None:
        target.is_active = is_active

    log_audit(db, actor.id, "user.update", "user", target.id, {
        "before": before,
        "after": {"role": target.role.value, "is_active": target.is_active, "full_name": target.full_name},
    })
    return target