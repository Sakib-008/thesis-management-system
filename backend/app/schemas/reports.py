from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, field_validator
# These limits keep a report on one page of the printed sheet.
MAX_A, MAX_B, MAX_ITEM = 1200, 1800, 180
class ReportIn(BaseModel):
    section_a: str = Field(default="", max_length=MAX_A)
    section_b: str = Field(default="", max_length=MAX_B)
    next_works: list[str] = Field(default_factory=list, max_length=3)
    @field_validator("next_works")
    @classmethod
    def clean_items(cls, items: list[str]) -> list[str]:
        cleaned = [" ".join(item.split()) for item in items]
        if any(len(item) > MAX_ITEM for item in cleaned):
            raise ValueError(f"Each planned work must be {MAX_ITEM} characters or fewer")
        return cleaned
class SignIn(BaseModel):
    rating: Literal["poor", "average", "good", "excellent"]
    comment: str = Field(default="", max_length=160)
class ReturnIn(BaseModel):
    reason: str = Field(default="", max_length=500)
class SheetStudent(BaseModel):
    name: str
    student_number: str | None
class SheetHeader(BaseModel):
    department_line: str
    university_name: str
    course_code: str
    sheet_title: str
    students: list[SheetStudent]
    supervisor_name: str | None
class ReportOut(BaseModel):
    id: int
    meeting_id: int
    meeting_date: datetime
    status: str  # draft, submitted, returned or signed
    section_a: str
    section_b: str
    next_works: list[str]
    rating: str | None
    supervisor_comment: str
    signed_by_name: str | None
    signed_at: datetime | None
    returned_reason: str
    submitted_at: datetime | None
    updated_at: datetime
    due_at: datetime | None
    overdue: bool
    header: SheetHeader
class TaskOut(BaseModel):
    """One completed meeting and the state of its report, for the student's to-do list."""
    meeting_id: int
    meeting_date: datetime
    completed_at: datetime | None
    due_at: datetime | None
    overdue: bool
    report_id: int | None
    report_status: str | None
class OverviewRow(BaseModel):
    proposal_id: int
    title: str
    student_names: list[str]
    supervisor_name: str | None
    meetings_completed: int
    reports_submitted: int  # submitted or signed
    reports_signed: int
    overdue: int
class ReportSettings(BaseModel):
    university_name: str = Field(min_length=2, max_length=120)
    course_code: str = Field(min_length=1, max_length=30)
    sheet_title: str = Field(min_length=2, max_length=120)
    due_days: int = Field(ge=1, le=60)