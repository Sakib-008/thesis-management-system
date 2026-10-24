from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import ConflictError, InvalidInputError, NotFoundError
from app.models.profile import Student, Supervisor
from app.models.reference import Department, Program, ResearchField, SupervisorDesignation
from app.models.user import User
from app.services.audit import log_audit
from app.services.reference_service import get_or_404

_STUDENT_LOAD = (selectinload(Student.user), selectinload(Student.department), selectinload(Student.program))
_SUPERVISOR_LOAD = (selectinload(Supervisor.user), selectinload(Supervisor.department),
                    selectinload(Supervisor.designation), selectinload(Supervisor.fields))


# ---------------------------------------------------------------- students
def get_student_by_user(db: Session, user_id: int) -> Student | None:
    return db.scalar(select(Student).options(*_STUDENT_LOAD).where(Student.user_id == user_id))


def get_student_full(db: Session, student_id: int) -> Student:
    student = db.scalar(select(Student).options(*_STUDENT_LOAD).where(Student.id == student_id))
    if student is None:
        raise NotFoundError("Student not found")
    return student


def list_students(db: Session) -> list[Student]:
    return list(db.scalars(select(Student).options(*_STUDENT_LOAD).order_by(Student.id)))


def upsert_student(db: Session, user: User, *, department_id: int, program_id: int,
                   batch: str, cgpa: float) -> Student:
    department = get_or_404(db, Department, department_id, "Department")
    program = get_or_404(db, Program, program_id, "Program")
    if program.department_id != department.id:
        raise InvalidInputError("The selected program does not belong to the selected department")

    new_cgpa = Decimal(str(round(cgpa, 2)))
    student = get_student_by_user(db, user.id)
    if student is None:
        student = Student(user_id=user.id, department_id=department.id, program_id=program.id,
                          batch=batch.strip(), cgpa=new_cgpa, cgpa_verified=False)
        db.add(student)
    else:
        if student.cgpa != new_cgpa:
            student.cgpa_verified = False  # any change to CGPA must be verified again
        student.department_id = department.id
        student.program_id = program.id
        student.batch = batch.strip()
        student.cgpa = new_cgpa
    db.flush()
    return student


def verify_cgpa(db: Session, student_id: int, actor: User) -> None:
    student = get_or_404(db, Student, student_id, "Student")
    student.cgpa_verified = True
    log_audit(db, actor.id, "student.verify_cgpa", "student", student.id, {"cgpa": float(student.cgpa)})


# ------------------------------------------------------------- supervisors
def get_supervisor_by_user(db: Session, user_id: int) -> Supervisor | None:
    return db.scalar(select(Supervisor).options(*_SUPERVISOR_LOAD).where(Supervisor.user_id == user_id))


def get_supervisor_full(db: Session, supervisor_id: int) -> Supervisor:
    supervisor = db.scalar(select(Supervisor).options(*_SUPERVISOR_LOAD).where(Supervisor.id == supervisor_id))
    if supervisor is None:
        raise NotFoundError("Supervisor not found")
    return supervisor


def list_supervisors(db: Session) -> list[Supervisor]:
    return list(db.scalars(select(Supervisor).options(*_SUPERVISOR_LOAD).order_by(Supervisor.id)))


def _load_fields(db: Session, field_ids: list[int]) -> list[ResearchField]:
    ids = set(field_ids)
    if not ids:
        return []
    fields = list(db.scalars(select(ResearchField).where(ResearchField.id.in_(ids))))
    if len(fields) != len(ids):
        raise InvalidInputError("One or more research fields do not exist")
    return fields


def create_supervisor(db: Session, user: User, *, department_id: int, designation_id: int,
                      expertise: str, field_ids: list[int]) -> Supervisor:
    if get_supervisor_by_user(db, user.id) is not None:
        raise ConflictError("Supervisor profile already exists")
    department = get_or_404(db, Department, department_id, "Department")
    designation = get_or_404(db, SupervisorDesignation, designation_id, "Designation")
    supervisor = Supervisor(
        user_id=user.id,
        department_id=department.id,
        designation_id=designation.id,
        capacity=designation.default_capacity,  # capacity comes from the designation, not from the user
        expertise=expertise.strip(),
        fields=_load_fields(db, field_ids),
    )
    db.add(supervisor)
    db.flush()
    return supervisor


def update_supervisor_profile(db: Session, supervisor: Supervisor, *, department_id: int,
                              expertise: str, field_ids: list[int]) -> Supervisor:
    department = get_or_404(db, Department, department_id, "Department")
    supervisor.department_id = department.id
    supervisor.expertise = expertise.strip()
    supervisor.fields = _load_fields(db, field_ids)
    db.flush()
    return supervisor


def admin_update_supervisor(db: Session, supervisor: Supervisor, actor: User, *,
                            designation_id: int | None, capacity: int | None) -> None:
    before = {"designation_id": supervisor.designation_id, "capacity": supervisor.capacity}
    if designation_id is not None and designation_id != supervisor.designation_id:
        designation = get_or_404(db, SupervisorDesignation, designation_id, "Designation")
        supervisor.designation_id = designation.id
        supervisor.capacity = designation.default_capacity  # new tier resets capacity to its default
    if capacity is not None:
        supervisor.capacity = capacity
    if supervisor.capacity < supervisor.current_count:
        raise InvalidInputError(
            f"Capacity cannot be lower than the current supervision count ({supervisor.current_count})")
    log_audit(db, actor.id, "supervisor.update", "supervisor", supervisor.id, {
        "before": before,
        "after": {"designation_id": supervisor.designation_id, "capacity": supervisor.capacity},
    })