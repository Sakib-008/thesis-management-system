"""proposal keywords, references and reviews; one thesis per student

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-31
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "thesis_proposals",
        sa.Column("keywords", postgresql.ARRAY(sa.String(60)), nullable=False, server_default=sa.text("'{}'")),
    )
    op.add_column(
        "thesis_proposals",
        sa.Column("references_text", sa.Text(), nullable=False, server_default=""),
    )

    # one record per coordinator decision; the full history of every proposal
    op.create_table(
        "proposal_reviews",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("proposal_id", sa.Integer(), sa.ForeignKey("thesis_proposals.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("version_no", sa.Integer(), nullable=False),
        sa.Column("reviewer_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("decision", sa.String(20), nullable=False),
        sa.Column("reason", sa.String(30), nullable=False, server_default="general"),
        sa.Column("comment", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("decision IN ('approved', 'revision_required')", name="ck_proposal_reviews_decision"),
    )
    op.create_index("idx_proposal_reviews_proposal", "proposal_reviews", ["proposal_id"])

    # a student can belong to only one thesis
    op.create_unique_constraint("uq_thesis_members_student", "thesis_members", ["student_id"])


def downgrade() -> None:
    op.drop_constraint("uq_thesis_members_student", "thesis_members", type_="unique")
    op.drop_index("idx_proposal_reviews_proposal", table_name="proposal_reviews")
    op.drop_table("proposal_reviews")
    op.drop_column("thesis_proposals", "references_text")
    op.drop_column("thesis_proposals", "keywords")
