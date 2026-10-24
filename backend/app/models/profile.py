from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Table, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.reference import Department, Program, ResearchField, SupervisorDesignation
from app.models.user import User

# Many-to-many link table (already created by migration 0001)
supervisor_fields = Table(
    "supervisor_fields",
    Base.metadata,
    Column("supervisor_id", ForeignKey("supervisors.id", ondelete="CASCADE"), primary_key=True),
    Column("field_id", ForeignKey("research_fields.id", ondelete="CASCADE"), primary_key=True),
)


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), nullable=False)
    program_id: Mapped[int] = mapped_column(ForeignKey("programs.id"), nullable=False)
    batch: Mapped[str] = mapped_column(String(20), nullable=False)
    cgpa: Mapped[Decimal] = mapped_column(Numeric(3, 2), nullable=False)
    cgpa_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Internal to the allocation service. No schema exposes this column.
    merit_rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship()
    department: Mapped[Department] = relationship()
    program: Mapped[Program] = relationship()


class Supervisor(Base):
    __tablename__ = "supervisors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), nullable=False)
    designation_id: Mapped[int] = mapped_column(ForeignKey("supervisor_designations.id"), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    current_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    expertise: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship()
    department: Mapped[Department] = relationship()
    designation: Mapped[SupervisorDesignation] = relationship()
    fields: Mapped[list[ResearchField]] = relationship(secondary=supervisor_fields, order_by=ResearchField.name)