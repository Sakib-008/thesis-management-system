"""Gives Rahim Hasan a supervision history: milestones in every state, feedback, and versioned documents.

Run it after seed_demo and seed_allocation_demo (Rahim must have a supervisor):
    docker compose exec backend python -m app.scripts.seed_supervision_demo
"""
from datetime import date, timedelta
from io import BytesIO

from reportlab.pdfgen import canvas
from sqlalchemy import select
from starlette.datastructures import UploadFile

from app.db.session import SessionLocal
from app.models.supervision import Milestone
from app.schemas.supervision import MilestoneIn
from app.services import document_service, meeting_service, milestone_service, proposal_service, user_service

RAHIM = "rahim.hasan@university.edu"


def pdf(title: str, lines: list[str]) -> UploadFile:
    """A small real PDF, so the download in the demo opens in any viewer."""
    buffer = BytesIO()
    page = canvas.Canvas(buffer, pagesize=(420, 260))
    page.setFont("Helvetica-Bold", 14)
    page.drawString(30, 220, title)
    page.setFont("Helvetica", 10)
    for i, line in enumerate(lines):
        page.drawString(30, 190 - i * 16, line)
    page.save()
    buffer.seek(0)
    return UploadFile(file=buffer, filename=title.lower().replace(" ", "-") + ".pdf")


def main() -> None:
    with SessionLocal() as db:
        rahim = user_service.get_by_email(db, RAHIM)
        proposal = proposal_service.get_own(db, rahim) if rahim else None
        supervisor = meeting_service.supervisor_of_thesis(db, proposal.thesis_id) if proposal else None
        if supervisor is None:
            print("Rahim has no supervisor yet. Run seed_allocation_demo first, then run this script again.")
            return
        thesis_id, teacher = proposal.thesis_id, supervisor.user
        if db.scalar(select(Milestone.id).where(Milestone.thesis_id == thesis_id)) is not None:
            print("Rahim already has milestones. Nothing to do.")
            return

        today = date.today()
        plan = [  # title, description, start, deadline
            ("Literature review", "Read and summarise the key papers on traffic sign recognition.", -45, -22),
            ("Problem definition and dataset", "Define the problem and choose the dataset.", -28, -6),
            ("First experiments", "Train a first model and report accuracy against a baseline.", -10, 4),
            ("Draft of the methodology chapter", "Write the methodology chapter for review.", -2, 18),
            ("Ethics and data checklist", "Complete the department's data checklist.", -20, -3),
            ("Full thesis draft", "A complete draft of the thesis.", 20, 45),
        ]
        milestones = []
        for title, description, start, deadline in plan:
            milestones.append(milestone_service.create_milestone(db, teacher, MilestoneIn(
                thesis_id=thesis_id, title=title, description=description,
                start_date=today + timedelta(days=start), deadline=today + timedelta(days=deadline),
            )))
        literature, problem, experiments, methodology, _, _ = milestones

        def hand_in(milestone, note, upload=None):
            return milestone_service.submit(db, rahim, milestone.id, note, upload)

        # 1. approved, with a file
        sub = hand_in(
            literature, "Summary of twelve papers is attached.", pdf("Literature review", ["12 papers", "3 datasets"])
        )
        milestone_service.review(db, sub.id, teacher, "approved", "A thorough review. Good choice of papers.")
        # 2. approved, note only
        sub = hand_in(problem, "I will use the GTSRB dataset. The problem is robustness in low light.")
        milestone_service.review(db, sub.id, teacher, "approved", "")
        # 3. sent back once: the feedback is still open
        sub = hand_in(
            experiments, "First results: 91 percent accuracy.", pdf("First experiments", ["91 percent accuracy"])
        )
        milestone_service.review(db, sub.id, teacher, "revision_required",
                                 "Please compare with a simple baseline and report the size of each dataset split.")
        # 4. waiting for the supervisor's review
        hand_in(methodology, "First draft of the methodology chapter.", pdf("Methodology draft", ["Chapter 3 draft"]))

        # documents with versions
        doc = document_service.create_document(
            db, rahim, None, "Literature review notes", "report", "First version",
            pdf("Literature notes v1", ["Notes on twelve papers"]),
        )
        document_service.add_version(
            db, doc.id, rahim, "Added a table of datasets", pdf("Literature notes v2", ["Notes", "Dataset table"])
        )
        document_service.create_document(
            db, rahim, None, "Progress presentation", "slides", "Slides for the progress defense",
            pdf("Progress presentation", ["Slide 1: the problem"]),
        )
        db.commit()
    print("Rahim Hasan now has:")
    print("  - 6 milestones: 2 completed, 1 sent back with open feedback, 1 waiting for review,")
    print("    1 overdue and not started, 1 planned for later")
    print("  - 2 documents, one with two versions")
    print("Dr. Rahman has one submission to review.")


if __name__ == "__main__":
    main()