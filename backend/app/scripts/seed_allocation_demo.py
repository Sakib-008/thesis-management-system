"""Prepares the five-student scenario of the specification, so the allocation can be demonstrated.

After seed_demo, three students are still waiting for something. This script
 - approves Sadman Hossain's proposal,
 - lets Fahim Reza resubmit his proposal with a narrower scope, approves it and verifies his CGPA,
 - records that Rahim Hasan was assigned to Dr. A. Rahman earlier in the semester.
Then five students with verified CGPAs wait for a supervisor and exactly four places are free.

 docker compose exec backend python -m app.scripts.seed_allocation_demo
"""
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.profile import Supervisor
from app.models.thesis import ProposalStatus, SupervisorAssignment
from app.models.user import User
from app.schemas.proposal import ProposalIn
from app.services import allocation_service, profile_service, proposal_service, user_service

COORDINATOR = "coordinator@university.edu"
SADMAN = "sadman.hossain@university.edu"
FAHIM = "fahim.reza@university.edu"
RAHIM = "rahim.hasan@university.edu"
RAHMAN = "a.rahman@university.edu"


def approve(db, coordinator: User, email: str) -> None:
    """Bring a student's proposal to Approved, whatever state it is in."""
    user = user_service.get_by_email(db, email)
    proposal = proposal_service.get_own(db, user)
    if proposal is None or proposal.status == ProposalStatus.approved:
        return
    if proposal.status == ProposalStatus.revision_required:
        # The student narrows the scope and resubmits.
        proposal_service.save_draft(db, user, ProposalIn(
            title=proposal.title, abstract=proposal.abstract, problem_statement=proposal.problem_statement,
            objectives=proposal.objectives,
            methodology="Focus on English voice commands only. Interview users, build a prototype and evaluate it "
            "with a usability study of ten participants.",
            expected_outcome=proposal.expected_outcome or "", references_text=proposal.references_text,
            keywords=list(proposal.keywords), field_ids=[f.id for f in proposal.fields],
        ))
        proposal_service.submit(db, user)
    proposal_service.review(db, proposal.id, coordinator, "approved", "Approved.")


def main() -> None:
    with SessionLocal() as db:
        coordinator = user_service.get_by_email(db, COORDINATOR)
        if coordinator is None or user_service.get_by_email(db, FAHIM) is None:
            print("Run seed_demo first.")
            return

        approve(db, coordinator, SADMAN)
        approve(db, coordinator, FAHIM)

        fahim = profile_service.get_student_by_user(db, user_service.get_by_email(db, FAHIM).id)
        if not fahim.cgpa_verified:
            profile_service.verify_cgpa(db, fahim.id, coordinator)

        # Rahim was assigned earlier. His place is counted by the assignment, so Dr. Rahman's stored
        # count goes down by one first and the assignment brings it back up.
        rahim_proposal = proposal_service.get_own(db, user_service.get_by_email(db, RAHIM))
        already = db.scalar(
            select(SupervisorAssignment.id).where(SupervisorAssignment.proposal_id == rahim_proposal.id)
        )
        if already is None:
            rahman = db.scalar(
                select(Supervisor).join(User, User.id == Supervisor.user_id).where(User.email == RAHMAN)
            )
            rahman.current_count = max(0, rahman.current_count - 1)
            allocation_service.assign_manually(
                db, rahim_proposal.id, rahman.id, coordinator, "Assigned earlier in the semester"
            )
        db.commit()

        readiness = allocation_service.readiness(db)
        print(f"Students waiting with a verified CGPA: {readiness.waiting_verified}")
        print(f"Free supervision places: {readiness.open_slots} with {readiness.supervisors_with_slots} supervisors")
        print("Ready. Open Assignment runs as the coordinator and press Run allocation.")


if __name__ == "__main__":
    main()
