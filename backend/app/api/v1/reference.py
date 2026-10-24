from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.reference import Department, Program, ResearchField, SupervisorDesignation
from app.models.user import User, UserRole
from app.schemas.reference import (DesignationOut, DesignationUpdate, NamedRef, NameIn,
                                   ProgramIn, ProgramOut, ProgramUpdate)
from app.services import reference_service as ref
from app.services.audit import log_audit

router = APIRouter(tags=["reference data"])

admin_only = require_roles(UserRole.admin)
admin_or_coordinator = require_roles(UserRole.admin, UserRole.coordinator)


# ------------------------------------------------------------ departments
@router.get("/departments", response_model=list[NamedRef])
def list_departments(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return list(db.scalars(select(Department).order_by(Department.name)))


@router.post("/departments", response_model=NamedRef, status_code=status.HTTP_201_CREATED)
def create_department(body: NameIn, db: Session = Depends(get_db), actor: User = Depends(admin_only)):
    obj = ref.save_new(db, Department(name=body.name.strip()), "A department with this name already exists")
    log_audit(db, actor.id, "department.create", "department", obj.id, {"name": obj.name})
    db.commit()
    return obj


@router.patch("/departments/{department_id}", response_model=NamedRef)
def rename_department(department_id: int, body: NameIn, db: Session = Depends(get_db),
                      actor: User = Depends(admin_only)):
    obj = ref.get_or_404(db, Department, department_id, "Department")
    obj.name = body.name.strip()
    ref.save_changes(db, "A department with this name already exists")
    log_audit(db, actor.id, "department.update", "department", obj.id, {"name": obj.name})
    db.commit()
    return obj


@router.delete("/departments/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_department(department_id: int, db: Session = Depends(get_db), actor: User = Depends(admin_only)):
    obj = ref.get_or_404(db, Department, department_id, "Department")
    name = obj.name
    ref.remove(db, obj, "This department is still used by programs, students or supervisors")
    log_audit(db, actor.id, "department.delete", "department", department_id, {"name": name})
    db.commit()


# --------------------------------------------------------------- programs
@router.get("/programs", response_model=list[ProgramOut])
def list_programs(department_id: int | None = None, db: Session = Depends(get_db),
                  _: User = Depends(get_current_user)):
    stmt = select(Program).order_by(Program.name)
    if department_id is not None:
        stmt = stmt.where(Program.department_id == department_id)
    return list(db.scalars(stmt))


@router.post("/programs", response_model=ProgramOut, status_code=status.HTTP_201_CREATED)
def create_program(body: ProgramIn, db: Session = Depends(get_db), actor: User = Depends(admin_only)):
    ref.get_or_404(db, Department, body.department_id, "Department")
    obj = ref.save_new(db, Program(name=body.name.strip(), department_id=body.department_id),
                       "This department already has a program with this name")
    log_audit(db, actor.id, "program.create", "program", obj.id, {"name": obj.name})
    db.commit()
    return obj


@router.patch("/programs/{program_id}", response_model=ProgramOut)
def update_program(program_id: int, body: ProgramUpdate, db: Session = Depends(get_db),
                   actor: User = Depends(admin_only)):
    obj = ref.get_or_404(db, Program, program_id, "Program")
    if body.name is not None:
        obj.name = body.name.strip()
    if body.department_id is not None:
        ref.get_or_404(db, Department, body.department_id, "Department")
        obj.department_id = body.department_id
    ref.save_changes(db, "This department already has a program with this name")
    log_audit(db, actor.id, "program.update", "program", obj.id, {"name": obj.name})
    db.commit()
    return obj


@router.delete("/programs/{program_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_program(program_id: int, db: Session = Depends(get_db), actor: User = Depends(admin_only)):
    obj = ref.get_or_404(db, Program, program_id, "Program")
    name = obj.name
    ref.remove(db, obj, "This program is still used by students")
    log_audit(db, actor.id, "program.delete", "program", program_id, {"name": name})
    db.commit()


# ----------------------------------------------------------- designations
@router.get("/supervisor-designations", response_model=list[DesignationOut])
def list_designations(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return list(db.scalars(select(SupervisorDesignation).order_by(SupervisorDesignation.default_capacity.desc())))


@router.patch("/supervisor-designations/{designation_id}", response_model=DesignationOut)
def update_designation(designation_id: int, body: DesignationUpdate, db: Session = Depends(get_db),
                       actor: User = Depends(admin_only)):
    """Changes the default for supervisors who register afterwards; existing capacities are untouched."""
    obj = ref.get_or_404(db, SupervisorDesignation, designation_id, "Designation")
    obj.default_capacity = body.default_capacity
    log_audit(db, actor.id, "designation.update", "designation", obj.id,
              {"name": obj.name, "default_capacity": obj.default_capacity})
    db.commit()
    return obj


# --------------------------------------------------------- research fields
@router.get("/research-fields", response_model=list[NamedRef])
def list_research_fields(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return list(db.scalars(select(ResearchField).order_by(ResearchField.name)))


@router.post("/research-fields", response_model=NamedRef, status_code=status.HTTP_201_CREATED)
def create_research_field(body: NameIn, db: Session = Depends(get_db), actor: User = Depends(admin_or_coordinator)):
    obj = ref.save_new(db, ResearchField(name=body.name.strip()), "A research field with this name already exists")
    log_audit(db, actor.id, "research_field.create", "research_field", obj.id, {"name": obj.name})
    db.commit()
    return obj


@router.patch("/research-fields/{field_id}", response_model=NamedRef)
def rename_research_field(field_id: int, body: NameIn, db: Session = Depends(get_db),
                          actor: User = Depends(admin_or_coordinator)):
    obj = ref.get_or_404(db, ResearchField, field_id, "Research field")
    obj.name = body.name.strip()
    ref.save_changes(db, "A research field with this name already exists")
    log_audit(db, actor.id, "research_field.update", "research_field", obj.id, {"name": obj.name})
    db.commit()
    return obj


@router.delete("/research-fields/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_research_field(field_id: int, db: Session = Depends(get_db), actor: User = Depends(admin_or_coordinator)):
    """Also removes the field from any supervisor/proposal that used it (ON DELETE CASCADE)."""
    obj = ref.get_or_404(db, ResearchField, field_id, "Research field")
    name = obj.name
    ref.remove(db, obj, "This research field cannot be deleted")
    log_audit(db, actor.id, "research_field.delete", "research_field", field_id, {"name": name})
    db.commit()