"""profile columns, unique program names, seed research fields

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-24
"""
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

RESEARCH_FIELDS = [
    "Artificial Intelligence", "Machine Learning", "Deep Learning", "Computer Vision",
    "Natural Language Processing", "Data Science", "Software Engineering", "Database Systems",
    "Computer Networks", "Cyber Security", "IoT", "Robotics", "Distributed Systems",
    "Human-Computer Interaction",
]


def upgrade() -> None:
    # Free-text expertise/interests/keywords; Phase 5 turns this into an embedding.
    op.add_column("supervisors", sa.Column("expertise", sa.Text(), nullable=False, server_default=""))
    # Students type in their own CGPA, so a coordinator must verify it before it is trusted.
    op.add_column("students", sa.Column("cgpa_verified", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_unique_constraint("uq_programs_department_name", "programs", ["department_id", "name"])

    values = ", ".join(f"('{name}')" for name in RESEARCH_FIELDS)
    op.execute(f"INSERT INTO research_fields (name) VALUES {values} ON CONFLICT (name) DO NOTHING")


def downgrade() -> None:
    names = ", ".join(f"'{name}'" for name in RESEARCH_FIELDS)
    op.execute(f"DELETE FROM research_fields WHERE name IN ({names})")
    op.drop_constraint("uq_programs_department_name", "programs", type_="unique")
    op.drop_column("students", "cgpa_verified")
    op.drop_column("supervisors", "expertise")