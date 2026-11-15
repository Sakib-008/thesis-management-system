from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.user import User


class EvaluationCriterion(Base):
    """One thing a thesis is marked on, and how much it counts (the weights of the active ones add up to 100)."""

    __tablename__ = "evaluation_criteria"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    weight: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class Evaluation(Base):
    """One evaluator's marks for one thesis. scores_json keeps a copy of each criterion's name and weight."""

    __tablename__ = "evaluations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    thesis_id: Mapped[int] = mapped_column(ForeignKey("theses.id", ondelete="CASCADE"), nullable=False)
    evaluator_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    scores_json: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    total: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    comment: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")  # draft or final
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    evaluator: Mapped[User] = relationship()


class ThesisResult(Base):
    """The published result of a thesis: the average of the final evaluations. Students see only this."""

    __tablename__ = "thesis_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    thesis_id: Mapped[int] = mapped_column(ForeignKey("theses.id", ondelete="CASCADE"), unique=True)
    final_total: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    grade: Mapped[str] = mapped_column(String(5), nullable=False)
    evaluators_count: Mapped[int] = mapped_column(Integer, nullable=False)
    breakdown: Mapped[list] = mapped_column(JSONB, nullable=False)
    comments: Mapped[list] = mapped_column(JSONB, nullable=False)
    published_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
