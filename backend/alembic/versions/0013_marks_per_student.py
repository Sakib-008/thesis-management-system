"""evaluation marks and published results belong to each student, not to the whole thesis team

Revision ID: 0013
Revises: 0012
Create Date: 2026-11-21

Every existing evaluation and result is copied to each member of its thesis, so nothing is lost and a team
that was marked together keeps the same marks until an evaluator changes them for one student.
"""
import sqlalchemy as sa
from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None

EVAL_COLUMNS = "thesis_id, evaluator_id, scores_json, total, created_at, comment, status, submitted_at, updated_at"
RESULT_COLUMNS = "thesis_id, final_total, grade, evaluators_count, breakdown, comments, published_by, published_at"


def _prefixed(columns: str, prefix: str) -> str:
    return ", ".join(f"{prefix}.{c.strip()}" for c in columns.split(","))


def upgrade() -> None:
    op.add_column("evaluations", sa.Column("student_id", sa.Integer(), nullable=True))
    op.add_column("thesis_results", sa.Column("student_id", sa.Integer(), nullable=True))
    op.drop_constraint("uq_evaluations_evaluator", "evaluations", type_="unique")
    op.drop_constraint("thesis_results_thesis_id_key", "thesis_results", type_="unique")
    # one copy of each row for every member of the thesis, then the old team-wide rows go
    op.execute(
        f"INSERT INTO evaluations ({EVAL_COLUMNS}, student_id) "
        f"SELECT {_prefixed(EVAL_COLUMNS, 'e')}, m.student_id FROM evaluations e "
        "JOIN thesis_members m ON m.thesis_id = e.thesis_id WHERE e.student_id IS NULL"
    )
    op.execute("DELETE FROM evaluations WHERE student_id IS NULL")
    op.execute(
        f"INSERT INTO thesis_results ({RESULT_COLUMNS}, student_id) "
        f"SELECT {_prefixed(RESULT_COLUMNS, 'r')}, m.student_id FROM thesis_results r "
        "JOIN thesis_members m ON m.thesis_id = r.thesis_id WHERE r.student_id IS NULL"
    )
    op.execute("DELETE FROM thesis_results WHERE student_id IS NULL")

    op.alter_column("evaluations", "student_id", nullable=False)
    op.alter_column("thesis_results", "student_id", nullable=False)
    op.create_foreign_key("fk_evaluations_student", "evaluations", "students", ["student_id"], ["id"],
                          ondelete="CASCADE")
    op.create_foreign_key("fk_thesis_results_student", "thesis_results", "students", ["student_id"], ["id"],
                          ondelete="CASCADE")
    op.create_unique_constraint("uq_evaluations_student", "evaluations", ["thesis_id", "student_id", "evaluator_id"])
    op.create_unique_constraint("thesis_results_student_id_key", "thesis_results", ["student_id"])


def downgrade() -> None:
    # back to one row per thesis: keep the first student's row
    op.execute(
        "DELETE FROM evaluations e USING evaluations f WHERE e.thesis_id = f.thesis_id "
        "AND e.evaluator_id = f.evaluator_id AND e.student_id > f.student_id"
    )
    op.execute(
        "DELETE FROM thesis_results r USING thesis_results s WHERE r.thesis_id = s.thesis_id "
        "AND r.student_id > s.student_id"
    )
    op.drop_constraint("thesis_results_student_id_key", "thesis_results", type_="unique")
    op.create_unique_constraint("thesis_results_thesis_id_key", "thesis_results", ["thesis_id"])
    op.drop_constraint("uq_evaluations_student", "evaluations", type_="unique")
    op.create_unique_constraint("uq_evaluations_evaluator", "evaluations", ["thesis_id", "evaluator_id"])
    op.drop_constraint("fk_thesis_results_student", "thesis_results", type_="foreignkey")
    op.drop_constraint("fk_evaluations_student", "evaluations", type_="foreignkey")
    op.drop_column("thesis_results", "student_id")
    op.drop_column("evaluations", "student_id")
