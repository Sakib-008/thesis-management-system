from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.thesis import ThesisProposal


class ProposalSimilarity(Base):
    """A proposal that looks too similar to an existing one, waiting for (or holding) a coordinator's decision."""

    __tablename__ = "proposal_similarity_checks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    proposal_id: Mapped[int] = mapped_column(ForeignKey("thesis_proposals.id", ondelete="CASCADE"))
    matched_proposal_id: Mapped[int] = mapped_column(ForeignKey("thesis_proposals.id", ondelete="CASCADE"))
    similarity: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)  # 0 to 1
    method: Mapped[str] = mapped_column(String(20), nullable=False)  # "embedding" or "title"
    level: Mapped[str] = mapped_column(String(10), nullable=False)  # "high" or "possible"
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    decision: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    decided_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decision_note: Mapped[str] = mapped_column(Text, nullable=False, default="")

    matched: Mapped[ThesisProposal] = relationship(foreign_keys=[matched_proposal_id])