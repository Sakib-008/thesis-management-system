"""Create the first admin account.

Run inside the backend container:
    docker compose exec backend python -m app.scripts.create_admin
"""
import getpass
import sys

from app.db.session import SessionLocal
from app.models.user import UserRole
from app.services import user_service
from app.services.audit import log_audit


def main() -> None:
    email = input("Admin email: ").strip()
    full_name = input("Full name: ").strip()
    password = getpass.getpass("Password (min 8 characters): ")
    if getpass.getpass("Confirm password: ") != password:
        sys.exit("Passwords do not match.")
    if len(password) < 8 or "@" not in email or len(full_name) < 2:
        sys.exit("Invalid input: need a valid email, a name, and a password of at least 8 characters.")

    with SessionLocal() as db:
        try:
            user = user_service.create_user(
                db, email=email, full_name=full_name, password=password, role=UserRole.admin,
            )
        except user_service.EmailAlreadyRegistered:
            sys.exit("A user with that email already exists.")
        log_audit(db, user.id, "user.bootstrap_admin", "user", user.id)
        db.commit()
    print(f"Admin created: {email}")


if __name__ == "__main__":
    main()