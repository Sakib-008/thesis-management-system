from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.thesis import ProposalStatus
from app.schemas.profile import UserBrief
from app.schemas.reference import NamedRef


class ProposalIn(BaseModel):
    """Everything is optional while drafting. Completeness is checked when the student submits."""
    title: str = Field(default="", max_length=255)
    abstract: str = Field(default="", max_length=4000)
    problem_statement: str = Field(default="", max_length=4000)
    objectives: str = Field(default="", max_length=4000)
    methodology: str = Field(default="", max_length=4000)
    expected_outcome: str = Field(default="", max_length=2000)
    references_text: str = Field(default="", max_length=4000)
    keywords: list[str] = Field(default_factory=list, max_length=15)
    field_ids: list[int] = Field(default_factory=list, max_length=8)


class ReviewIn(BaseModel):
    decision: Literal["approved", "revision_required"]
    comment: str = Field(default="", max_length=2000)


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    decision: str
    reason: str
    comment: str
    reviewer: UserBrief | None
    version_no: int
    created_at: datetime


class VersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    version_no: int
    created_at: datetime
    content_snapshot: dict


class ProposalOut(BaseModel):
    id: int
    thesis_id: int
    title: str
    abstract: str
    problem_statement: str
    objectives: str
    methodology: str
    expected_outcome: str
    references_text: str
    keywords: list[str]
    status: ProposalStatus
    fields: list[NamedRef]
    student: UserBrief | None
    version_count: int
    submitted_at: datetime | None




    latest_review: ReviewOut | None
    created_at: datetime
    updated_at: datetime
