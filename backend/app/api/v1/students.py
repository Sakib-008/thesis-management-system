from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.errors import NotFoundError
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.profile import StudentIn, StudentOut
from app.services import profile_service

router = APIRouter(prefix="/students", tags=["students"])

student_only = require_roles(UserRole.student)
staff = require_roles(UserRole.coordinator, UserRole.admin)


@router.get("/me", response_model=StudentOut)
def get_my_profile(user: User = Depends(student_only), db: Session = Depends(get_db)):
    student = profile_service.get_student_by_user(db, user.id)
    if student is None:
        raise NotFoundError("Student profile not found")
    return student


@router.put("/me", response_model=StudentOut)
def save_my_profile(body: StudentIn, user: User = Depends(student_only), db: Session = Depends(get_db)):
    """Create or update the logged-in student's profile."""
    student = profile_service.upsert_student(
        db, user, department_id=body.department_id, program_id=body.program_id,
        batch=body.batch, cgpa=body.cgpa,
    )
    db.commit()
    return profile_service.get_student_full(db, student.id)


@router.get("", response_model=list[StudentOut])
def list_students(db: Session = Depends(get_db), _: User = Depends(staff)):
    return profile_service.list_students(db)


@router.post("/{student_id}/verify-cgpa", response_model=StudentOut)
def verify_cgpa(student_id: int, db: Session = Depends(get_db), actor: User = Depends(staff)):
    profile_service.verify_cgpa(db, student_id, actor)
    db.commit()
    return profile_service.get_student_full(db, student_id)