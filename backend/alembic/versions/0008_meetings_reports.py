"""meetings workflow, weekly progress reports and the student ID number
Revision ID: 0008
Revises: 0007
Create Date: 2026-11-04
"""
import json
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql
revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None
DEFAULT_REPORT_SETTINGS = {
    "university_name": "Khulna University of Engineering & Technology",
    "course_code": "CSE 3200",
    "sheet_title": "Weekly Progress Report (Summary)",
    "due_days": 7,
}
def upgrade() -> None:
    # The university ID number printed on the weekly report. Unique when it is filled in.
    op.add_column("students", sa.Column("student_number", sa.String(30), nullable=True))
    op.create_index(
        "uq_students_student_number", "students", ["student_number"], unique=True,
        postgresql_where=sa.text("student_number IS NOT NULL"),
    )
    # Meetings now have a life cycle: requested, scheduled, completed (or declined or cancelled).
    op.add_column("meetings", sa.Column("status", sa.String(20), nullable=False, server_default="requested"))
    op.add_column("meetings", sa.Column("mode", sa.String(20), nullable=False, server_default="in_person"))
    op.add_column("meetings", sa.Column("location", sa.String(200), nullable=False, server_default=""))
    op.add_column("meetings", sa.Column("requested_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))
    op.add_column("meetings", sa.Column("decline_reason", sa.Text(), nullable=False, server_default=""))
    op.add_column("meetings", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "meetings",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_check_constraint(
        "ck_meetings_status", "meetings",
        "status IN ('requested', 'scheduled', 'completed', 'declined', 'cancelled')",
    )
    op.create_check_constraint("ck_meetings_mode", "meetings", "mode IN ('in_person', 'online')")
    op.create_index("idx_meetings_thesis", "meetings", ["thesis_id"])
    # One weekly progress report per completed meeting
    op.create_table(
        "weekly_reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("meeting_id", sa.Integer(), sa.ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False,
                  unique=True),
        sa.Column("thesis_id", sa.Integer(), sa.ForeignKey("theses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("section_a", sa.Text(), nullable=False, server_default=""),
        sa.Column("section_b", sa.Text(), nullable=False, server_default=""),
        sa.Column("next_works", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
                sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rating", sa.String(20), nullable=True),
        sa.Column("supervisor_comment", sa.Text(), nullable=False, server_default=""),
        sa.Column("signed_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("signed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("returned_reason", sa.Text(), nullable=False, server_default=""),
        sa.CheckConstraint("status IN ('draft', 'submitted', 'returned', 'signed')", name="ck_reports_status"),
        sa.CheckConstraint(
            "rating IS NULL OR rating IN ('poor', 'average', 'good', 'excellent')", name="ck_reports_rating"
        ),
    )
    op.create_index("idx_reports_thesis", "weekly_reports", ["thesis_id"])
    op.execute(
        sa.text(
            "INSERT INTO system_settings (key, value) VALUES (:key, CAST(:value AS jsonb)) ON CONFLICT DO NOTHING"
        ).bindparams(key="reports", value=json.dumps(DEFAULT_REPORT_SETTINGS))
    )
def downgrade() -> None:
    op.execute(sa.text("DELETE FROM system_settings WHERE key = 'reports'"))
    op.drop_index("idx_reports_thesis", table_name="weekly_reports")
    op.drop_table("weekly_reports")
    op.drop_index("idx_meetings_thesis", table_name="meetings")
    op.drop_constraint("ck_meetings_mode", "meetings", type_="check")
    op.drop_constraint("ck_meetings_status", "meetings", type_="check")
    for column in ("updated_at", "completed_at", "decline_reason", "requested_by", "location", "mode", "status"):
        op.drop_column("meetings", column)
    op.drop_index("uq_students_student_number", table_name="students")
    op.drop_column("students", "student_number")