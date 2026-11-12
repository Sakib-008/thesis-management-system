import enum
from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.thesis import Thesis
from app.models.user import User


class MilestoneStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    submitted = "submitted"
    under_review = "under_review"
    revision_required = "revision_required"
    completed = "completed"
    overdue = "overdue"  # never stored: "overdue" is worked out from the deadline when needed


milestone_status = Enum(MilestoneStatus, name="milestone_status", create_type=False)


class Milestone(Base):
    """A stage of the thesis that the supervisor plans (table created by migration 0001)."""

    __tablename__ = "milestones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    thesis_id: Mapped[int] = mapped_column(ForeignKey("theses.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    deadline: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[MilestoneStatus] = mapped_column(
        milestone_status, nullable=False, default=MilestoneStatus.not_started
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    thesis: Mapped[Thesis] = relationship()
    submissions: Mapped[list["MilestoneSubmission"]] = relationship(
        back_populates="milestone", order_by="MilestoneSubmission.submitted_at.desc()"
    )


class MilestoneSubmission(Base):
    """One hand-in of work for a milestone: a note and optionally a file (extended by migration 0009)."""

    __tablename__ = "milestone_submissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    milestone_id: Mapped[int] = mapped_column(ForeignKey("milestones.id", ondelete="CASCADE"), nullable=False)
    submitted_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)  # relative to the upload folder
    status: Mapped[MilestoneStatus] = mapped_column(
        milestone_status, nullable=False, default=MilestoneStatus.submitted
    )
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    original_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    milestone: Mapped[Milestone] = relationship(back_populates="submissions")
    submitter: Mapped[User] = relationship(foreign_keys=[submitted_by])
    reviewer: Mapped[User | None] = relationship(foreign_keys=[reviewed_by])
    feedback: Mapped[list["Feedback"]] = relationship(
        back_populates="submission", order_by="Feedback.created_at"
    )


class Feedback(Base):
    """A comment from the supervisor about one submission. 'open' until the student has dealt with it."""

    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    submission_id: Mapped[int] = mapped_column(
        ForeignKey("milestone_submissions.id", ondelete="CASCADE"), nullable=False
    )
    given_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="open")  # open or resolved
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    submission: Mapped[MilestoneSubmission] = relationship(back_populates="feedback")
    author: Mapped[User] = relationship(foreign_keys=[given_by])


class Document(Base):
    """A document of a thesis, such as a report draft. Its files are kept as numbered versions."""

    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    thesis_id: Mapped[int] = mapped_column(ForeignKey("theses.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    uploader: Mapped[User] = relationship(foreign_keys=[uploaded_by])
    versions: Mapped[list["DocumentVersion"]] = relationship(
        back_populates="document", order_by="DocumentVersion.version_no.desc()"
    )


class DocumentVersion(Base):
    __tablename__ = "document_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)  # relative to the upload folder
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    original_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False, default="application/octet-stream")
    sha256: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    uploaded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")

    document: Mapped[Document] = relationship(back_populates="versions")
    uploader: Mapped[User | None] = relationship(foreign_keys=[uploaded_by])