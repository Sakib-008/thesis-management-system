from datetime import datetime
from pydantic import BaseModel, Field, model_validator


# ------------------------------------------------------------ criteria and grading
class CriterionIn(BaseModel):
    """One course outcome. weight is the most marks it can earn (the active ones must add up to 100)."""

    id: int | None = None
    code: str = Field(min_length=1, max_length=20)
    category: str = Field(min_length=2, max_length=60)
    name: str = Field(min_length=3, max_length=150)
    description: str = Field(default="", max_length=500)
    weight: float = Field(gt=0, le=100)
    is_active: bool = True


class CriteriaIn(BaseModel):
    criteria: list[CriterionIn] = Field(min_length=1, max_length=20)


class CriterionOut(BaseModel):
    id: int
    code: str
    category: str
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
    code: str = ""  # evaluations made before outcomes existed have no code or group
    category: str = ""
    name: str
    weight: float  # the most marks this outcome can earn
    score: float | None  # the marks given


class GroupTotal(BaseModel):
    """The marks earned in one group of outcomes, such as Presentation, out of the group's maximum."""

    category: str
    marks: float
    max: float


class EvaluationOut(BaseModel):
    id: int | None
    evaluator_name: str
    evaluator_role: str
    status: str  # none (not started), draft or final
    scores: list[ScoreOut]
    comment: str
    total: float
    groups: list[GroupTotal] = []
    grade: str
    submitted_at: datetime | None
    updated_at: datetime | None


class ResultCriterion(BaseModel):
    code: str = ""
    category: str = ""
    name: str
    weight: float  # the most marks
    average: float  # the average marks given by the evaluators


class ResultComment(BaseModel):
    evaluator_name: str
    comment: str


class ResultOut(BaseModel):
    published: bool
    total: float | None = None
    grade: str | None = None
    evaluators_count: int = 0
    criteria: list[ResultCriterion] = []
    groups: list[GroupTotal] = []
    comments: list[ResultComment] = []
    published_at: datetime | None = None


class EvaluationRow(BaseModel):
    """One student of one thesis: marks are given and published for each student separately."""

    thesis_id: int
    proposal_id: int
    student_id: int
    student_name: str
    student_number: str | None
    title: str
    supervisor_name: str | None
    my_status: str  # none, draft or final
    finals: int
    drafts: int
    average: float | None  # the average of the final evaluations
    grade: str | None
    published: bool


class TeamMember(BaseModel):
    """A student of the thesis and how far the signed-in person is with marking them."""

    student_id: int
    name: str
    student_number: str | None
    my_status: str  # none, draft or final
    published: bool


class EvaluationDetail(BaseModel):
    thesis_id: int
    proposal_id: int
    title: str
    student_id: int  # the student these marks are for
    student_name: str
    student_number: str | None
    team: list[TeamMember]
    supervisor_name: str | None
    criteria: list[CriterionOut]  # the active ones
    criteria_valid: bool
    bands: list[GradeBand]
    mine: EvaluationOut
    others: list[EvaluationOut]  # coordinators see every evaluation; a supervisor sees only their own
    result: ResultOut
    can_publish: bool
    blocked_reason: str | None
