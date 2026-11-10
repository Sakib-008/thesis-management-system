from datetime import datetime
from pydantic import BaseModel, Field

# Nothing in this file contains a CGPA or a merit position.
# The order in which students were served never leaves the server.


class MatchedOut(BaseModel):
    proposal_id: int
    student_name: str
    title: str
    supervisor_id: int
    supervisor_name: str
    score: float  # percent
    choice: int  # 1 means the student's best-ranked supervisor


class UnmatchedOut(BaseModel):
    proposal_id: int
    student_name: str
    title: str
    reason: str  # "capacity" or "no_good_match"
    message: str


class RunSummaryOut(BaseModel):
    id: int
    run_at: datetime
    completed_at: datetime | None
    triggered_by_name: str
    status: str
    processed: int
    matched_count: int
    unmatched_count: int


class RunOut(RunSummaryOut):
    matched: list[MatchedOut]
    unmatched: list[UnmatchedOut]
    skipped_unverified: list[str]


class ReadinessOut(BaseModel):
    waiting_total: int
    waiting_verified: int
    waiting_unverified: int
    open_slots: int
    supervisors_with_slots: int
    last_run: RunSummaryOut | None


class AssignmentOut(BaseModel):
    id: int
    proposal_id: int
    title: str
    student_name: str
    supervisor_id: int
    supervisor_name: str
    designation: str
    method: str  # "merit_allocation" or "manual_override"
    score: float | None  # percent
    reason: str
    assigned_at: datetime
    run_id: int | None


class WaitingOut(BaseModel):
    proposal_id: int
    title: str
    student_name: str
    cgpa_verified: bool
    note: str | None  # why the last run could not place this student


class AssignIn(BaseModel):
    supervisor_id: int
    reason: str = Field(default="", max_length=1000)


class MyAssignmentOut(BaseModel):
    supervisor_name: str
    designation: str
    email: str
    department: str
    assigned_at: datetime
