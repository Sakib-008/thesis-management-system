"""allocation runs: stored results, assignment reasons and match scores

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-03
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # What a run did, so the coordinator can look at it again later
    op.add_column("assignment_runs", sa.Column("processed", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("assignment_runs", sa.Column("matched_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("assignment_runs", sa.Column("unmatched_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column(
        "assignment_runs",
        sa.Column("result_json", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    # Why a manual assignment was made, and how well the supervisor matched at the time
    op.add_column("supervisor_assignments", sa.Column("reason", sa.Text(), nullable=False, server_default=""))
    op.add_column("supervisor_assignments", sa.Column("match_score", sa.Numeric(5, 4), nullable=True))


def downgrade() -> None:
    op.drop_column("supervisor_assignments", "match_score")
    op.drop_column("supervisor_assignments", "reason")
    op.drop_column("assignment_runs", "result_json")
    op.drop_column("assignment_runs", "unmatched_count")
    op.drop_column("assignment_runs", "matched_count")
    op.drop_column("assignment_runs", "processed")
