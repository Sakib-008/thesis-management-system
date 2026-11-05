"""duplicate check on thesis proposals

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-02
"""
import json

import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

DEFAULT_DUPLICATE_SETTINGS = {"high_threshold": 85, "possible_threshold": 70}


def upgrade() -> None:
    # One row per (checked proposal, similar existing proposal) found by the duplicate check.
    op.create_table(
        "proposal_similarity_checks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("proposal_id", sa.Integer(), sa.ForeignKey("thesis_proposals.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("matched_proposal_id", sa.Integer(), sa.ForeignKey("thesis_proposals.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("similarity", sa.Numeric(5, 4), nullable=False),
        sa.Column("method", sa.String(20), nullable=False),
        sa.Column("level", sa.String(10), nullable=False),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("decision", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("decided_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decision_note", sa.Text(), nullable=False, server_default=""),
        sa.UniqueConstraint("proposal_id", "matched_proposal_id", name="uq_similarity_pair"),
        sa.CheckConstraint("proposal_id <> matched_proposal_id", name="ck_similarity_not_self"),
        sa.CheckConstraint("method IN ('embedding', 'title')", name="ck_similarity_method"),
        sa.CheckConstraint("level IN ('high', 'possible')", name="ck_similarity_level"),
        sa.CheckConstraint("decision IN ('pending', 'dismissed', 'confirmed')", name="ck_similarity_decision"),
    )
    op.create_index("idx_similarity_proposal", "proposal_similarity_checks", ["proposal_id"])

    op.execute(
        sa.text(
            "INSERT INTO system_settings (key, value) VALUES (:key, CAST(:value AS jsonb)) ON CONFLICT DO NOTHING"
        ).bindparams(key="duplicate", value=json.dumps(DEFAULT_DUPLICATE_SETTINGS))
    )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM system_settings WHERE key = 'duplicate'"))
    op.drop_index("idx_similarity_proposal", table_name="proposal_similarity_checks")
    op.drop_table("proposal_similarity_checks")