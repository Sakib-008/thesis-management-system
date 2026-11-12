from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

DocumentType = Literal["report", "slides", "literature", "data", "code", "other"]


# --------------------------------------------------------------- milestones
class MilestoneIn(BaseModel):
    thesis_id: int
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(default="", max_length=2000)
    start_date: date | None = None
    deadline: date

    @model_validator(mode="after")
    def deadline_after_start(self):
        if self.start_date is not None and self.deadline < self.start_date:
            raise ValueError("The deadline cannot be before the start date")
        return self


class MilestoneUpdate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(default="", max_length=2000)
    start_date: date | None = None
    deadline: date

    @model_validator(mode="after")
    def deadline_after_start(self):
        if self.start_date is not None and self.deadline < self.start_date:
            raise ValueError("The deadline cannot be before the start date")
        return self


class MilestoneOut(BaseModel):
    id: int
    thesis_id: int
    student_names: list[str]
    title: str
    description: str
    start_date: date | None
    deadline: date
    status: str  # not_started, submitted, revision_required or completed
    overdue: bool  # the deadline has passed and the milestone is not completed
    days_left: int | None  # negative when late; None once completed
    submissions_count: int
    open_feedback_count: int
    latest_submission_id: int | None
    created_at: datetime


# -------------------------------------------------------- submissions, feedback
class FileInfo(BaseModel):
    original_name: str
    size_bytes: int
    content_type: str


class FeedbackOut(BaseModel):
    id: int
    submission_id: int
    milestone_id: int
    milestone_title: str
    student_names: list[str]
    given_by_name: str
    content: str
    status: str  # open or resolved
    created_at: datetime
    resolved_at: datetime | None


class SubmissionOut(BaseModel):
    id: int
    milestone_id: int
    milestone_title: str
    student_names: list[str]
    submitted_by_name: str
    note: str
    file: FileInfo | None
    status: str  # submitted, revision_required or completed
    submitted_at: datetime
    reviewed_by_name: str | None
    reviewed_at: datetime | None
    feedback: list[FeedbackOut]


class ReviewIn(BaseModel):
    decision: Literal["approved", "revision_required"]
    feedback: str = Field(default="", max_length=3000)


class FeedbackIn(BaseModel):
    content: str = Field(min_length=1, max_length=3000)


class ProgressOut(BaseModel):
    """How far one thesis has come. The percentage is the share of milestones that are completed."""
    thesis_id: int
    proposal_id: int | None
    title: str
    student_names: list[str]
    supervisor_name: str | None
    total: int
    completed: int
    in_review: int
    revision_required: int
    overdue: int
    percent: int
    next_deadline: date | None


# ---------------------------------------------------------------- documents
class DocumentVersionOut(BaseModel):
    id: int
    version_no: int
    original_name: str
    size_bytes: int
    content_type: str
    uploaded_by_name: str | None
    uploaded_at: datetime
    note: str


class DocumentOut(BaseModel):
    id: int
    thesis_id: int
    student_names: list[str]
    title: str
    type: str
    uploaded_by_name: str
    created_at: datetime
    version_count: int
    latest: DocumentVersionOut | None