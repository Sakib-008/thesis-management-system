from datetime import datetime

from pydantic import BaseModel, Field


class RecommendationOut(BaseModel):
    """One supervisor's result for one proposal. All scores are percentages from 0 to 100."""
    supervisor_id: int
    supervisor_name: str
    designation: str
    department: str
    rank: int
    score: float
    field: float
    semantic: float
    availability: float
    cosine: float | None
    matched_fields: list[str]
    capacity: int
    current: int
    flags: list[str]
    summary: str
    generated_at: datetime


class RecommendationSettings(BaseModel):
    weight_field: int = Field(ge=0, le=100)
    weight_semantic: int = Field(ge=0, le=100)
    weight_availability: int = Field(ge=0, le=100)
    top_n: int
    min_score: int = Field(ge=0, le=100)
    cos_lo: float = Field(ge=0, le=1)
    cos_hi: float = Field(ge=0, le=1)