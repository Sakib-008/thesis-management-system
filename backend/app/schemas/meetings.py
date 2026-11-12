from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field
class MeetingIn(BaseModel):
    meeting_date: datetime
    agenda: str = Field(min_length=3, max_length=1000)
    mode: Literal["in_person", "online"] = "in_person"
    location: str = Field(default="", max_length=200)
class AcceptIn(BaseModel):
    meeting_date: datetime | None = None  # change the time the student asked for
    location: str | None = Field(default=None, max_length=200)
class DeclineIn(BaseModel):
    reason: str = Field(default="", max_length=500)
class CompleteIn(BaseModel):
    discussion: str = Field(default="", max_length=3000)
    decisions: str = Field(default="", max_length=2000)
    next_meeting_date: datetime | None = None
class MeetingOut(BaseModel):
    id: int
    thesis_id: int
    proposal_id: int | None
    proposal_title: str
    student_names: list[str]
    supervisor_name: str | None
    meeting_date: datetime
    agenda: str
    mode: str
    location: str
    status: str  # requested, scheduled, completed, declined or cancelled
    decline_reason: str
    discussion: str
    decisions: str
    next_meeting_date: datetime | None
    completed_at: datetime | None
    created_at: datetime
    report_id: int | None
    report_status: str | None