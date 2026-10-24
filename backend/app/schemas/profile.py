from pydantic import BaseModel, ConfigDict, Field

from app.schemas.reference import DesignationOut, NamedRef


class UserBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str


class StudentIn(BaseModel):
    department_id: int
    program_id: int
    batch: str = Field(min_length=1, max_length=20)
    cgpa: float = Field(ge=0, le=4)


class StudentOut(BaseModel):
    """merit_rank is deliberately absent: it must never leave the server."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    user: UserBrief
    department: NamedRef
    program: NamedRef
    batch: str
    cgpa: float
    cgpa_verified: bool


class SupervisorCreate(BaseModel):
    department_id: int
    designation_id: int
    expertise: str = Field(default="", max_length=2000)
    field_ids: list[int] = Field(default_factory=list, max_length=20)


class SupervisorUpdate(BaseModel):
    """Supervisors cannot change their own designation or capacity."""
    department_id: int
    expertise: str = Field(default="", max_length=2000)
    field_ids: list[int] = Field(default_factory=list, max_length=20)


class SupervisorAdminUpdate(BaseModel):
    designation_id: int | None = None
    capacity: int | None = Field(default=None, ge=0, le=50)


class SupervisorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user: UserBrief
    department: NamedRef
    designation: DesignationOut
    capacity: int
    current_count: int
    expertise: str
    fields: list[NamedRef]