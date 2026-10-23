"""add users.full_name

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-23
"""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # server_default lets the ALTER succeed even if rows already exist; then we drop it
    # so every future insert must provide a real name.
    op.add_column("users", sa.Column("full_name", sa.String(150), nullable=False, server_default=""))
    op.alter_column("users", "full_name", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "full_name")