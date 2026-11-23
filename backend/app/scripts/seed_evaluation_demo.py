"""Gives Rahim Hasan two evaluations (marks per course outcome), so the whole evaluation flow can be tried.
Marks belong to each student of a thesis; Rahim is the only member of his team in the demo data.

Dr. Rahman has finished and submitted his evaluation. The coordinator has started one and not finished it.
Run it after seed_demo and seed_allocation_demo (Rahim must have a supervisor):
 docker compose exec backend python -m app.scripts.seed_evaluation_demo
Then, as the coordinator, finish the evaluation and publish the result."""
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.evaluation import Evaluation
from app.schemas.evaluation import EvaluationIn, ScoreIn
from app.services import evaluation_service, meeting_service, proposal_service, user_service

RAHIM = "rahim.hasan@university.edu"
COORDINATOR = "coordinator@university.edu"
# What share of each outcome's maximum marks the evaluator gives, in the order of the criteria. With the default
# outcomes the supervisor's total is 76.5 and the coordinator has marked only the first two.
SUPERVISOR_SHARE = [0.8, 0.75, 0.75, 0.75, 0.75, 0.8]
COORDINATOR_SHARE = [0.6, 0.6]


def main() -> None:
    with SessionLocal() as db:
        rahim = user_service.get_by_email(db, RAHIM)
        proposal = proposal_service.get_own(db, rahim) if rahim else None
        supervisor = meeting_service.supervisor_of_thesis(db, proposal.thesis_id) if proposal else None
        if supervisor is None:
            print("Rahim has no supervisor yet. Run seed_allocation_demo first, then run this script again.")
            return
        thesis_id = proposal.thesis_id
        student = meeting_service.students_of_thesis(db, thesis_id)[0]
        if db.scalar(select(Evaluation.id).where(Evaluation.student_id == student.id)) is not None:
            print("Rahim already has evaluations. Nothing to do.")
            return
        criteria = evaluation_service.criteria_out(db).criteria
        if not criteria or not evaluation_service.criteria_out(db).valid:
            print("The evaluation criteria are not ready. Check Settings as the admin, then run this again.")
            return

        def marks(shares):
            return [ScoreIn(criterion_id=c.id, score=round(c.weight * v, 2)) for c, v in zip(criteria, shares)]

        teacher = supervisor.user
        evaluation_service.save_mine(
            db,
            thesis_id,
            teacher,
            EvaluationIn(scores=marks(SUPERVISOR_SHARE), comment="A solid thesis with a strong write-up."),
            student.id,
        )
        evaluation_service.submit_mine(db, thesis_id, teacher, student.id)
        coordinator = user_service.get_by_email(db, COORDINATOR)
        evaluation_service.save_mine(
            db,
            thesis_id,
            coordinator,
            EvaluationIn(scores=marks(COORDINATOR_SHARE), comment="Acceptable defense. Still reading the report."),
            student.id,
        )
        db.commit()
        print("Rahim Hasan now has:")
        print(" - Dr. Rahman's evaluation: submitted, total 76.5 with the default outcomes (grade A)")
        print(" - the coordinator's evaluation: a draft with only the first two outcomes marked")
        print("As the coordinator, open Evaluations, finish yours, and publish the result.")


if __name__ == "__main__":
    main()
