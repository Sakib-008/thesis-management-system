"""Adds one extra student whose proposal is very close to Zarin Tasnim's, to demonstrate the duplicate check.

Run it after seed_demo:
    docker compose exec backend python -m app.scripts.seed_duplicate_demo
"""
from sqlalchemy import select

from app.core.errors import ServiceUnavailableError
from app.db.session import SessionLocal
from app.models.reference import Department, Program, ResearchField
from app.models.user import UserRole
from app.schemas.proposal import ProposalIn
from app.scripts.seed_demo import DEPARTMENT, PASSWORD, PROGRAMS
from app.services import duplicate_service, profile_service, proposal_service, user_service

EMAIL = "imran.chowdhury@university.edu"
NAME = "Imran Chowdhury"
FIELDS = ["Computer Vision", "Deep Learning"]

# A lightly reworded version of Zarin Tasnim's "Plant Disease Detection From Leaf Images".
PROPOSAL = dict(
    title="Leaf Image Based Plant Disease Recognition",
    abstract="A smartphone-friendly model that recognises common crop diseases from photographs of plant leaves.",
    problem_statement="Farmers often notice plant diseases too late because agricultural experts are rarely "
                      "available in villages.",
    objectives="Collect and label a dataset of leaf images\nTrain a lightweight image classification model",
    methodology="Fine-tune a pre-trained image model on labelled photographs of leaves and test it on unseen images.",
    keywords=["plant disease", "leaf images", "classification"],
)


def main() -> None:
    with SessionLocal() as db:
        department = db.scalar(select(Department).where(Department.name == DEPARTMENT))
        program = None
        if department is not None:
            program = db.scalar(
                select(Program).where(Program.department_id == department.id, Program.name == PROGRAMS[0])
            )
        if department is None or program is None:
            print("Run seed_demo first.")
            return

        user = user_service.get_by_email(db, EMAIL)
        if user is None:
            user = user_service.create_user(
                db, email=EMAIL, full_name=NAME, password=PASSWORD, role=UserRole.student
            )
        if profile_service.get_student_by_user(db, user.id) is None:
            profile_service.upsert_student(
                db, user, department_id=department.id, program_id=program.id, batch="2022", cgpa=3.55,
            )

        proposal = proposal_service.get_own(db, user)
        if proposal is None:
            field_ids = list(db.scalars(select(ResearchField.id).where(ResearchField.name.in_(FIELDS))))
            proposal = proposal_service.save_draft(db, user, ProposalIn(**PROPOSAL, field_ids=field_ids))
            proposal_service.submit(db, user)
        db.commit()

        print(f"Student {NAME} ({EMAIL}) has a submitted proposal: {PROPOSAL['title']}")
        try:
            duplicate_service.run_check(db, proposal.id, user.id)
            db.commit()
        except ServiceUnavailableError as exc:
            db.rollback()
            print(f"The duplicate check could not run yet: {exc}")
            return

        matches = duplicate_service.list_matches(db, proposal.id)
        if not matches:
            print("No similar proposal was found. If this looks wrong, lower the thresholds on the Settings page.")
        for match in matches:
            print(f"Similar to: {match.matched.title} by {match.matched.student.full_name} "
                  f"({match.similarity:.1f}%, {match.level})")


if __name__ == "__main__":
    main()