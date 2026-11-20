"""an index so that a person's newest notifications are found quickly

Revision ID: 0011
Revises: 0010
Create Date: 2026-11-15
"""
import sqlalchemy as sa
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("idx_notifications_user_created", "notifications", ["user_id", sa.text("created_at DESC")])


def downgrade() -> None:
    op.drop_index("idx_notifications_user_created", table_name="notifications")
