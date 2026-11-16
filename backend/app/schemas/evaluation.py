from datetime import datetime
from pydantic import BaseModel, Field, model_validator


# ------------------------------------------------------------ criteria and grading
class CriterionIn(BaseModel):
    id: int | None = None
    name: str = Field(min_length=3, max_length=150)
    description: str = Field(default="", max_length=500)
    weight: float = Field(gt=0, le=100)
    is_active: bool = True


class CriteriaIn(BaseModel):
    criteria: list[CriterionIn] = Field(min_length=1, max_length=20)


class CriterionOut(BaseModel):
    id: int
    name: str
    description: str
    weight: float
    is_active: bool


class CriteriaOut(BaseModel):
    criteria: list[CriterionOut]
    active_total: float  # the weights of the active criteria; it must be 100
    valid: bool


class GradeBand(BaseModel):
    min: float = Field(ge=0, le=100)  # a score of at least this earns the grade
    grade: str = Field(min_length=1, max_length=5)


class GradingIn(BaseModel):
    bands: list[GradeBand] = Field(min_length=2, max_length=20)

    @model_validator(mode="after")
    def check_bands(self):
        mins = [b.min for b in self.bands]
        if len(set(mins)) != len(mins):
            raise ValueError("Two grades start at the same score")
        if 0 not in mins:
            raise ValueError("One grade must start at 0, so that every score earns a grade")
        grades = [b.grade.strip().casefold() for b in self.bands]
        if len(set(grades)) != len(grades):
            raise ValueError("Each grade can appear only once")
        return self


class GradingOut(BaseModel):
    bands: list[GradeBand]


# ------------------------------------------------------------------ evaluations
class ScoreIn(BaseModel):
    criterion_id: int
    score: float = Field(ge=0, le=100)


class EvaluationIn(BaseModel):
    scores: list[ScoreIn] = Field(default_factory=list, max_length=20)
    comment: str = Field(default="", max_length=2000)


class ScoreOut(BaseModel):
    criterion_id: int
    name: str
    weight: float
    score: float | None


class EvaluationOut(BaseModel):
    id: int | None
    evaluator_name: str
    evaluator_role: str
    status: str  # none (not started), draft or final
    scores: list[ScoreOut]
    comment: str
    total: float
    grade: str
    submitted_at: datetime | None
    updated_at: datetime | None


class ResultCriterion(BaseModel):
    name: str
    weight: float
    average: float


class ResultComment(BaseModel):
    evaluator_name: str
    comment: str


class ResultOut(BaseModel):
    published: bool
    total: float | None = None
    grade: str | None = None
    evaluators_count: int = 0
    criteria: list[ResultCriterion] = []
    comments: list[ResultComment] = []
    published_at: datetime | None = None


class EvaluationRow(BaseModel):
    thesis_id: int
    proposal_id: int
    title: str
    student_names: list[str]
    supervisor_name: str | None
    my_status: str  # none, draft or final
    finals: int
    drafts: int
    average: float | None  # the average of the final evaluations
    grade: str | None
    published: bool


class EvaluationDetail(BaseModel):
    thesis_id: int
    proposal_id: int
    title: str
    student_names: list[str]
    supervisor_name: str | None
    criteria: list[CriterionOut]  # the active ones
    criteria_valid: bool
    bands: list[GradeBand]
    mine: EvaluationOut
    others: list[EvaluationOut]  # coordinators see every evaluation; a supervisor sees only their own
    result: ResultOut
    can_publish: bool
    blocked_reason: str | None
