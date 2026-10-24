from pydantic import BaseModel, ConfigDict, Field


class NamedRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class NameIn(BaseModel):
    name: str = Field(min_length=2, max_length=150)


class ProgramIn(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    department_id: int


class ProgramUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    department_id: int | None = None


class ProgramOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    department_id: int


class DesignationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    default_capacity: int


class DesignationUpdate(BaseModel):
    default_capacity: int = Field(ge=1, le=50)