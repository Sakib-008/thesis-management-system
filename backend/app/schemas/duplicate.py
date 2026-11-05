from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.proposal import ProposalOut


class DuplicateOut(BaseModel):
    """One existing proposal that looks similar. Only coordinators and admins can ever see this."""
    id: int
    similarity: float  # percent, 0 to 100
    level: str  # "high" or "possible"
    method: str  # "title" or "embedding"
    decision: str  # "pending", "dismissed" or "confirmed"
    decision_note: str
    decided_at: datetime | None
    checked_at: datetime
    matched: ProposalOut


class DuplicateDecisionIn(BaseModel):
    decision: Literal["dismissed", "confirmed"]
    comment: str = Field(default="", max_length=2000)


class DuplicateFlagOut(BaseModel):
    """A proposal waiting for review that has at least one undecided similar proposal."""
    proposal_id: int
    level: str
    similarity: float


class DuplicateSettings(BaseModel):
    high_threshold: int = Field(ge=1, le=100)
    possible_threshold: int = Field(ge=1, le=100)