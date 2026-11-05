from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Float, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.profile import Supervisor


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    value: Mapped[dict] = mapped_column(JSONB, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)


class TextEmbedding(Base):
    __tablename__ = "text_embeddings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)  # "proposal" or "supervisor"
    owner_id: Mapped[int] = mapped_column(Integer, nullable=False)
    model: Mapped[str] = mapped_column(String(120), nullable=False)
    text_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    vector: Mapped[list[float]] = mapped_column(ARRAY(Float), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SupervisorRecommendation(Base):
    """One row per proposal and supervisor (table created by migration 0001)."""

    __tablename__ = "supervisor_recommendations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    proposal_id: Mapped[int] = mapped_column(ForeignKey("thesis_proposals.id", ondelete="CASCADE"))
    supervisor_id: Mapped[int] = mapped_column(ForeignKey("supervisors.id", ondelete="CASCADE"))
    field_score: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    semantic_score: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    workload_score: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)  # holds the availability score
    final_score: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    reasons_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    supervisor: Mapped[Supervisor] = relationship()