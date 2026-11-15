"""Gives Rahim Hasan's thesis two evaluations, so the whole evaluation flow can be tried.

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
SUPERVISOR_MARKS = [80, 70, 60, 90, 100]  # one mark for each of the five default criteria


def main() -> None:
    with SessionLocal() as db:
        rahim = user_service.get_by_email(db, RAHIM)
        proposal = proposal_service.get_own(db, rahim) if rahim else None
        supervisor = meeting_service.supervisor_of_thesis(db, proposal.thesis_id) if proposal else None
        if supervisor is None:
            print("Rahim has no supervisor yet. Run seed_allocation_demo first, then run this script again.")
            return
        thesis_id = proposal.thesis_id
        if db.scalar(select(Evaluation.id).where(Evaluation.thesis_id == thesis_id)) is not None:
            print("Rahim's thesis already has evaluations. Nothing to do.")
            return
        criteria = evaluation_service.criteria_out(db).criteria
        if not criteria or not evaluation_service.criteria_out(db).valid:
            print("The evaluation criteria are not ready. Check Settings as the admin, then run this again.")
            return

        def marks(values):
            return [ScoreIn(criterion_id=c.id, score=v) for c, v in zip(criteria, values)]

        teacher = supervisor.user
        evaluation_service.save_mine(
            db,
            thesis_id,
            teacher,
            EvaluationIn(scores=marks(SUPERVISOR_MARKS), comment="A solid thesis with a strong write-up."),
        )
        evaluation_service.submit_mine(db, thesis_id, teacher)
        coordinator = user_service.get_by_email(db, COORDINATOR)
        evaluation_service.save_mine(
            db,
            thesis_id,
            coordinator,
            EvaluationIn(scores=marks([60, 60]), comment="Acceptable defense. Still reading the report."),
        )
        db.commit()
        print("Rahim Hasan's thesis now has:")
        print(" - Dr. Rahman's evaluation: submitted, total 76 (grade A)")
        print(" - the coordinator's evaluation: a draft with two of five criteria marked")
        print("As the coordinator, open Evaluations, finish yours, and publish the result.")


if __name__ == "__main__":
    main()
