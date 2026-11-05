import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Table, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.profile import Student
from app.models.reference import ResearchField
from app.models.user import User


class ProposalStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"
    under_review = "under_review"
    approved = "approved"
    revision_required = "revision_required"
    resubmitted = "resubmitted"




# Link tables (created by migration 0001)
proposal_fields = Table(
    "proposal_fields",
    Base.metadata,
    Column("proposal_id", ForeignKey("thesis_proposals.id", ondelete="CASCADE"), primary_key=True),
    Column("field_id", ForeignKey("research_fields.id", ondelete="CASCADE"), primary_key=True),
)

thesis_members = Table(
    "thesis_members",
    Base.metadata,
    Column("thesis_id", ForeignKey("theses.id", ondelete="CASCADE"), primary_key=True),
    Column("student_id", ForeignKey("students.id", ondelete="CASCADE"), primary_key=True),
)


class Thesis(Base):
    __tablename__ = "theses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    members: Mapped[list[Student]] = relationship(secondary=thesis_members)


class ThesisProposal(Base):
    __tablename__ = "thesis_proposals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    thesis_id: Mapped[int] = mapped_column(ForeignKey("theses.id", ondelete="CASCADE"), unique=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    abstract: Mapped[str] = mapped_column(Text, nullable=False, default="")
    problem_statement: Mapped[str] = mapped_column(Text, nullable=False, default="")
    objectives: Mapped[str] = mapped_column(Text, nullable=False, default="")
    methodology: Mapped[str] = mapped_column(Text, nullable=False, default="")
    expected_outcome: Mapped[str | None] = mapped_column(Text, nullable=True)
    references_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    keywords: Mapped[list[str]] = mapped_column(ARRAY(String(60)), nullable=False, default=list)
    status: Mapped[ProposalStatus] = mapped_column(
        Enum(ProposalStatus, name="proposal_status", create_type=False), nullable=False,
        default=ProposalStatus.draft,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    thesis: Mapped[Thesis] = relationship()
    fields: Mapped[list[ResearchField]] = relationship(secondary=proposal_fields, order_by=ResearchField.name)


class ProposalVersion(Base):
    __tablename__ = "proposal_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    proposal_id: Mapped[int] = mapped_column(ForeignKey("thesis_proposals.id", ondelete="CASCADE"))
    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    content_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProposalReview(Base):
    __tablename__ = "proposal_reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    proposal_id: Mapped[int] = mapped_column(ForeignKey("thesis_proposals.id", ondelete="CASCADE"))
    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    reviewer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    decision: Mapped[str] = mapped_column(String(20), nullable=False)
    reason: Mapped[str] = mapped_column(String(30), nullable=False, default="general")
    comment: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    reviewer: Mapped[User | None] = relationship()


class SupervisorAssignment(Base):
    """Only the columns Phase 8 needs (who supervises which proposal). Phase 11 completes it."""

    __tablename__ = "supervisor_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    proposal_id: Mapped[int] = mapped_column(ForeignKey("thesis_proposals.id", ondelete="CASCADE"), unique=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    supervisor_id: Mapped[int] = mapped_column(ForeignKey("supervisors.id"), nullable=False)
