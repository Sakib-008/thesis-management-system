"""evaluation by course outcome: a code and a group for each criterion, marks instead of percentages

Revision ID: 0012
Revises: 0011
Create Date: 2026-11-21

Before this migration an evaluator gave each criterion a score from 0 to 100 and the total was a weighted
average. Now each criterion is a course outcome (CO1, CO2, ...) in a group (Presentation, Project Evaluation)
with a maximum number of marks, the evaluator gives marks up to that maximum and the total is their sum.
The maximum marks of the active outcomes still add up to 100, so every total keeps its meaning.
"""
import json

import sqlalchemy as sa
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None

PRESENTATION = "Presentation"
PROJECT = "Project Evaluation"

# The outcomes of the CSE 3200 defense sheet. The admin can change all of this from the settings page.
OUTCOMES = [
    ("CO5", PRESENTATION, "Teamwork and project management",
     "Plans, manages and carries out the project following software engineering principles.", 15),
    ("CO6", PRESENTATION, "Communication and documentation",
     "Technical documentation, and presenting the project outcomes clearly.", 15),
    ("CO1", PROJECT, "Problem analysis",
     "Problem identification, literature review and feasibility; clear system requirements.", 15),
    ("CO2", PROJECT, "System design and development",
     "A complete software solution built with suitable methodologies and modern technologies.", 20),
    ("CO3", PROJECT, "Application of modern tools",
     "Suitable tools, languages, frameworks and environments chosen and used well.", 20),
    ("CO4", PROJECT, "Investigation and testing",
     "Testing, validation and performance evaluation: correctness, reliability and efficiency.", 15),
]

# The five criteria that migration 0010 created. They are replaced only if nobody has changed them.
OLD_DEFAULTS = {
    "Problem understanding and literature review": 15,
    "Methodology and technical work": 30,
    "Results and analysis": 25,
    "Thesis writing and presentation": 20,
    "Progress and professionalism": 10,
}


def upgrade() -> None:
    op.add_column("evaluation_criteria", sa.Column("code", sa.String(20), nullable=False, server_default=""))
    op.add_column(
        "evaluation_criteria",
        sa.Column("category", sa.String(60), nullable=False, server_default=PROJECT),
    )
    bind = op.get_bind()

    rows = bind.execute(sa.text("SELECT id, name, weight FROM evaluation_criteria ORDER BY sort_order, id")).all()
    untouched = len(rows) == len(OLD_DEFAULTS) and all(
        r.name in OLD_DEFAULTS and float(r.weight) == OLD_DEFAULTS[r.name] for r in rows
    )
    if untouched or not rows:
        bind.execute(sa.text("DELETE FROM evaluation_criteria"))
        for order, (code, category, name, description, marks) in enumerate(OUTCOMES, start=1):
            bind.execute(
                sa.text(
                    "INSERT INTO evaluation_criteria (code, category, name, description, weight, sort_order) "
                    "VALUES (:c, :g, :n, :d, :w, :o)"
                ),
                {"c": code, "g": category, "n": name, "d": description, "w": marks, "o": order},
            )
    else:  # the admin has made their own criteria: keep them, give each a code
        for order, r in enumerate(rows, start=1):
            bind.execute(
                sa.text("UPDATE evaluation_criteria SET code = :c WHERE id = :i"), {"c": f"C{order}", "i": r.id}
            )

    # Evaluations already made: percentages become marks. The total stays the same, because the
    # weights added up to 100.
    for ev in bind.execute(sa.text("SELECT id, scores_json FROM evaluations")).all():
        scores = ev.scores_json if isinstance(ev.scores_json, list) else json.loads(ev.scores_json)
        for s in scores:
            if s.get("score") is not None:
                s["score"] = round(s["score"] * s["weight"] / 100, 2)
            s.setdefault("code", "")
            s.setdefault("category", PROJECT)
        bind.execute(
            sa.text("UPDATE evaluations SET scores_json = CAST(:j AS jsonb) WHERE id = :i"),
            {"j": json.dumps(scores), "i": ev.id},
        )
    for res in bind.execute(sa.text("SELECT id, breakdown FROM thesis_results")).all():
        items = res.breakdown if isinstance(res.breakdown, list) else json.loads(res.breakdown)
        for c in items:
            c["average"] = round(c["average"] * c["weight"] / 100, 2)
            c.setdefault("code", "")
            c.setdefault("category", PROJECT)
        bind.execute(
            sa.text("UPDATE thesis_results SET breakdown = CAST(:j AS jsonb) WHERE id = :i"),
            {"j": json.dumps(items), "i": res.id},
        )


def downgrade() -> None:
    bind = op.get_bind()
    for ev in bind.execute(sa.text("SELECT id, scores_json FROM evaluations")).all():
        scores = ev.scores_json if isinstance(ev.scores_json, list) else json.loads(ev.scores_json)
        for s in scores:
            if s.get("score") is not None and s["weight"]:
                s["score"] = round(s["score"] * 100 / s["weight"], 2)
            s.pop("code", None)
            s.pop("category", None)
        bind.execute(
            sa.text("UPDATE evaluations SET scores_json = CAST(:j AS jsonb) WHERE id = :i"),
            {"j": json.dumps(scores), "i": ev.id},
        )
    for res in bind.execute(sa.text("SELECT id, breakdown FROM thesis_results")).all():
        items = res.breakdown if isinstance(res.breakdown, list) else json.loads(res.breakdown)
        for c in items:
            if c["weight"]:
                c["average"] = round(c["average"] * 100 / c["weight"], 2)
            c.pop("code", None)
            c.pop("category", None)
        bind.execute(
            sa.text("UPDATE thesis_results SET breakdown = CAST(:j AS jsonb) WHERE id = :i"),
            {"j": json.dumps(items), "i": res.id},
        )
    op.drop_column("evaluation_criteria", "category")
    op.drop_column("evaluation_criteria", "code")
