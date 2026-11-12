"""milestone submissions with notes and files, versioned documents, feedback that can be resolved

Revision ID: 0009
Revises: 0008
Create Date: 2026-11-06
"""
import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # What a student hands in for a milestone: a note, and optionally one file
    op.add_column("milestone_submissions", sa.Column("note", sa.Text(), nullable=False, server_default=""))
    op.add_column("milestone_submissions", sa.Column("original_name", sa.String(255), nullable=True))
    op.add_column("milestone_submissions", sa.Column("size_bytes", sa.BigInteger(), nullable=True))
    op.add_column("milestone_submissions", sa.Column("content_type", sa.String(100), nullable=True))
    op.add_column("milestone_submissions", sa.Column("sha256", sa.String(64), nullable=True))
    op.add_column(
        "milestone_submissions",
        sa.Column("reviewed_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
    )
    op.add_column("milestone_submissions", sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("idx_submissions_milestone", "milestone_submissions", ["milestone_id"])

    # A document gets a title; every version remembers its file name, size, type, checksum and author
    op.add_column("documents", sa.Column("title", sa.String(200), nullable=False, server_default=""))
    op.add_column("document_versions", sa.Column("original_name", sa.String(255), nullable=False, server_default=""))
    op.add_column("document_versions", sa.Column("size_bytes", sa.BigInteger(), nullable=False, server_default="0"))
    op.add_column(
        "document_versions",
        sa.Column("content_type", sa.String(100), nullable=False, server_default="application/octet-stream"),
    )
    op.add_column("document_versions", sa.Column("sha256", sa.String(64), nullable=False, server_default=""))
    op.add_column(
        "document_versions", sa.Column("uploaded_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True)
    )
    op.add_column("document_versions", sa.Column("note", sa.Text(), nullable=False, server_default=""))
    op.create_index("idx_documents_thesis", "documents", ["thesis_id"])

    # Feedback is either open (the student should act on it) or resolved
    op.add_column("feedback", sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True))
    op.create_check_constraint("ck_feedback_status", "feedback", "status IN ('open', 'resolved')")
    op.create_index("idx_feedback_submission", "feedback", ["submission_id"])

    op.create_check_constraint(
        "ck_milestones_dates", "milestones", "start_date IS NULL OR deadline >= start_date"
    )


def downgrade() -> None:
    op.drop_constraint("ck_milestones_dates", "milestones", type_="check")
    op.drop_index("idx_feedback_submission", table_name="feedback")
    op.drop_constraint("ck_feedback_status", "feedback", type_="check")
    op.drop_column("feedback", "resolved_at")
    op.drop_index("idx_documents_thesis", table_name="documents")
    for column in ("note", "uploaded_by", "sha256", "content_type", "size_bytes", "original_name"):
        op.drop_column("document_versions", column)
    op.drop_column("documents", "title")
    op.drop_index("idx_submissions_milestone", table_name="milestone_submissions")
    for column in ("reviewed_at", "reviewed_by", "sha256", "content_type", "size_bytes", "original_name", "note"):
        op.drop_column("milestone_submissions", column)