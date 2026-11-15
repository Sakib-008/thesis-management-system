"""evaluation criteria, evaluator scoring, published thesis results and the grading scale

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-14
"""
import json
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None

# The weights add up to 100. An admin can change them from the settings page.
DEFAULT_CRITERIA = [
    ("Problem understanding and literature review", "Clear problem, good grasp of related work.", 15),
    ("Methodology and technical work", "A sound method, carried out well.", 30),
    ("Results and analysis", "Correct results, honest and clear analysis.", 25),
    ("Thesis writing and presentation", "A well written report and a clear defense.", 20),
    ("Progress and professionalism", "Regular meetings, reports and deadlines kept.", 10),
]

# The grading scale: a score of at least "min" earns the grade. The last band must start at 0.
DEFAULT_GRADING = {
    "bands": [
        {"min": 80, "grade": "A+"},
        {"min": 75, "grade": "A"},
        {"min": 70, "grade": "A-"},
        {"min": 65, "grade": "B+"},
        {"min": 60, "grade": "B"},
        {"min": 55, "grade": "B-"},
        {"min": 50, "grade": "C+"},
        {"min": 45, "grade": "C"},
        {"min": 40, "grade": "D"},
        {"min": 0, "grade": "F"},
    ]
}


def upgrade() -> None:
    op.add_column("evaluation_criteria", sa.Column("description", sa.Text(), nullable=False, server_default=""))
    op.add_column("evaluation_criteria", sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("evaluation_criteria", sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"))
    op.create_check_constraint("ck_criteria_weight", "evaluation_criteria", "weight > 0 AND weight <= 100")

    # One evaluation per evaluator and thesis: first a draft, then final
    op.add_column("evaluations", sa.Column("comment", sa.Text(), nullable=False, server_default=""))
    op.add_column("evaluations", sa.Column("status", sa.String(20), nullable=False, server_default="draft"))
    op.add_column("evaluations", sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "evaluations",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_check_constraint("ck_evaluations_status", "evaluations", "status IN ('draft', 'final')")
    op.create_unique_constraint("uq_evaluations_evaluator", "evaluations", ["thesis_id", "evaluator_id"])

    # The result the student sees, once the coordinator has published it
    op.create_table(
        "thesis_results",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "thesis_id", sa.Integer(), sa.ForeignKey("theses.id", ondelete="CASCADE"), nullable=False, unique=True
        ),
        sa.Column("final_total", sa.Numeric(5, 2), nullable=False),
        sa.Column("grade", sa.String(5), nullable=False),
        sa.Column("evaluators_count", sa.Integer(), nullable=False),
        sa.Column("breakdown", postgresql.JSONB(), nullable=False),
        sa.Column("comments", postgresql.JSONB(), nullable=False),
        sa.Column("published_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    bind = op.get_bind()
    if bind.execute(sa.text("SELECT count(*) FROM evaluation_criteria")).scalar() == 0:
        for order, (name, description, weight) in enumerate(DEFAULT_CRITERIA, start=1):
            bind.execute(
                sa.text(
                    "INSERT INTO evaluation_criteria (name, description, weight, sort_order) "
                    "VALUES (:n, :d, :w, :o)"
                ),
                {"n": name, "d": description, "w": weight, "o": order},
            )

    bind.execute(
        sa.text(
            "INSERT INTO system_settings (key, value) VALUES ('grading', CAST(:v AS jsonb)) ON CONFLICT DO NOTHING"
        ),
        {"v": json.dumps(DEFAULT_GRADING)},
    )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM system_settings WHERE key = 'grading'"))
    op.drop_table("thesis_results")
    op.drop_constraint("uq_evaluations_evaluator", "evaluations", type_="unique")
    op.drop_constraint("ck_evaluations_status", "evaluations", type_="check")
    for column in ("updated_at", "submitted_at", "status", "comment"):
        op.drop_column("evaluations", column)
    op.drop_constraint("ck_criteria_weight", "evaluation_criteria", type_="check")
    for column in ("sort_order", "is_active", "description"):
        op.drop_column("evaluation_criteria", column)
