import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.user import User


class AssignmentRunStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    completed_with_exceptions = "completed_with_exceptions"  # finished, but some students need a manual decision
    failed = "failed"


class AssignmentRun(Base):
    """One press of "Run allocation" (table created by migration 0001, extended by 0007)."""

    __tablename__ = "assignment_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    triggered_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[AssignmentRunStatus] = mapped_column(
        Enum(AssignmentRunStatus, name="assignment_run_status", create_type=False),
        nullable=False, default=AssignmentRunStatus.pending,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    processed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    matched_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unmatched_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    result_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    triggered_by_user: Mapped[User] = relationship(foreign_keys=[triggered_by])
