"""settings and embeddings tables for the AI recommendation engine

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-01
"""
import json

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

DEFAULT_RECOMMENDATION_SETTINGS = {
    "weight_field": 40,
    "weight_semantic": 40,
    "weight_availability": 20,
    "top_n": 5,
    "min_score": 30,
    "cos_lo": 0.10,
    "cos_hi": 0.70,
}


def upgrade() -> None:
    # Small key-value store for settings an admin can change from the website.
    op.create_table(
        "system_settings",
        sa.Column("key", sa.String(60), primary_key=True),
        sa.Column("value", postgresql.JSONB(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
    )

    # One stored vector per proposal and per supervisor profile. text_hash tells us when the text has changed
    # (or the model has changed) and the vector must be computed again.
    op.create_table(
        "text_embeddings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("model", sa.String(120), nullable=False),
        sa.Column("text_hash", sa.String(64), nullable=False),
        sa.Column("vector", postgresql.ARRAY(sa.Float()), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("kind", "owner_id", name="uq_text_embeddings_owner"),
        sa.CheckConstraint("kind IN ('proposal', 'supervisor')", name="ck_text_embeddings_kind"),
    )

    op.execute(
        sa.text("INSERT INTO system_settings (key, value) VALUES (:key, CAST(:value AS jsonb))").bindparams(
            key="recommendation", value=json.dumps(DEFAULT_RECOMMENDATION_SETTINGS)
        )
    )


def downgrade() -> None:
    op.drop_table("text_embeddings")
    op.drop_table("system_settings")