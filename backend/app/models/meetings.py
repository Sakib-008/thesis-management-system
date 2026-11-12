from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base
from app.models.thesis import Thesis
from app.models.user import User
class Meeting(Base):
    """A supervision meeting (table created by migration 0001, extended by 0008).
    meeting_date is the date the student asked for; the supervisor may change it when accepting.
    status: requested -> scheduled -> completed, or declined / cancelled."""
    __tablename__ = "meetings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    thesis_id: Mapped[int] = mapped_column(ForeignKey("theses.id", ondelete="CASCADE"), nullable=False)
    meeting_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    agenda: Mapped[str | None] = mapped_column(Text, nullable=True)
    discussion: Mapped[str | None] = mapped_column(Text, nullable=True)
    decisions: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_meeting_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="requested")
    mode: Mapped[str] = mapped_column(String(20), nullable=False, default="in_person")
    location: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    requested_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    decline_reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    thesis: Mapped[Thesis] = relationship()
class WeeklyReport(Base):
    """The student's summary report after a meeting, in the format of the CSE 3200 progress sheet.
    status: draft -> submitted -> signed, or submitted -> returned -> submitted."""
    __tablename__ = "weekly_reports"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), unique=True)
    thesis_id: Mapped[int] = mapped_column(ForeignKey("theses.id", ondelete="CASCADE"), nullable=False)
    section_a: Mapped[str] = mapped_column(Text, nullable=False, default="")  # works of the previous week
    section_b: Mapped[str] = mapped_column(Text, nullable=False, default="")  # this week's activity
    next_works: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)  # up to three planned works
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rating: Mapped[str | None] = mapped_column(String(20), nullable=True)  # poor, average, good or excellent
    supervisor_comment: Mapped[str] = mapped_column(Text, nullable=False, default="")
    signed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    returned_reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    meeting: Mapped[Meeting] = relationship()
    signer: Mapped[User | None] = relationship(foreign_keys=[signed_by])