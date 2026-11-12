"""Gives the demo students Student IDs and Rahim Hasan a history of meetings and weekly reports.
Run it after seed_demo and seed_allocation_demo (Rahim must have a supervisor):
    docker compose exec backend python -m app.scripts.seed_meetings_demo
"""
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.meetings import Meeting, WeeklyReport
from app.models.profile import Student
from app.models.user import User
from app.services import meeting_service, proposal_service, user_service
STUDENT_NUMBERS = {
    "rahim.hasan@university.edu": "2207001",
    "zarin.tasnim@university.edu": "2207002",
    "tahmid.alam@university.edu": "2207003",
    "nabila.karim@university.edu": "2207004",
    "sadman.hossain@university.edu": "2207005",
    "fahim.reza@university.edu": "2207006",
    "imran.chowdhury@university.edu": "2207007",
}
RAHIM = "rahim.hasan@university.edu"
# days ago the meeting was held, what was discussed, and what the report says (None: no report written yet)
HELD = [
    (24, "Reviewed the literature on traffic sign datasets and agreed to use the GTSRB dataset.",
     "Choose a dataset and set up the project",
     dict(a="Read twelve papers on traffic sign recognition and compared the public datasets.",
          b="Chose the GTSRB dataset, downloaded it and wrote the code that loads and resizes the images.",
          c=["Clean the dataset and remove blurred images", "Train a first convolutional network",
             "Write the evaluation script"], state="signed")),
    (17, "Looked at the first results. Accuracy is 91 percent. Discussed how to deal with low light images.",
     "Train and evaluate a first model",
     dict(a="Cleaned the dataset and removed 214 blurred images. Split the data into training and validation sets.",
          b="Trained a first convolutional network and reached 91 percent accuracy on the validation set. "
            "Wrote the evaluation script and plotted the confusion matrix.",
          c=["Train a deeper network and compare the results", "Test both networks on low light images",
             "Start writing the methodology chapter"], state="submitted")),
    (9, "Compared the two networks. The deeper one is better but slower. Agreed to test low light images next.",
     None, None),
]
def main() -> None:
    with SessionLocal() as db:
        for email, number in STUDENT_NUMBERS.items():
            user = user_service.get_by_email(db, email)
            student = db.scalar(select(Student).where(Student.user_id == user.id)) if user else None
            if student is not None and not student.student_number:
                student.student_number = number
        rahim = user_service.get_by_email(db, RAHIM)
        proposal = proposal_service.get_own(db, rahim) if rahim else None
        supervisor = meeting_service.supervisor_of_thesis(db, proposal.thesis_id) if proposal else None
        if supervisor is None:
            db.commit()
            print("Student IDs saved. Rahim has no supervisor yet, so no meetings were created.")
            print("Run seed_allocation_demo first, then run this script again.")
            return
        thesis_id = proposal.thesis_id
        if db.scalar(select(Meeting.id).where(Meeting.thesis_id == thesis_id)) is None:
            now = datetime.now(timezone.utc)
            supervisor_user: User = supervisor.user
            for days_ago, discussion, agenda, report in HELD:
                held_at = now - timedelta(days=days_ago)
                meeting = Meeting(
                    thesis_id=thesis_id, meeting_date=held_at, agenda=agenda or "Compare the two networks",
                    discussion=discussion, decisions="", status="completed", mode="in_person",
                    location="Room 301, CSE building", requested_by=rahim.id, completed_at=held_at,
                )
                db.add(meeting)
                db.flush()
                if report is None:
                    continue
                signed = report["state"] == "signed"
                db.add(WeeklyReport(
                    meeting_id=meeting.id, thesis_id=thesis_id, section_a=report["a"], section_b=report["b"],
                    next_works=report["c"], status=report["state"], created_by=rahim.id,
                    submitted_at=held_at + timedelta(days=2), rating="good" if signed else None,
                    supervisor_comment="Good progress. Keep the experiments reproducible." if signed else "",
                    signed_by=supervisor_user.id if signed else None,
                    signed_at=held_at + timedelta(days=3) if signed else None,
                ))
            db.add(Meeting(
                thesis_id=thesis_id, meeting_date=now + timedelta(days=3, hours=2),
                agenda="Discuss the low light results", status="scheduled", mode="in_person",
                location="Room 301, CSE building", requested_by=rahim.id,
            ))
            db.add(Meeting(
                thesis_id=thesis_id, meeting_date=now + timedelta(days=9),
                agenda="Review the methodology chapter draft", status="requested", mode="online",
                requested_by=rahim.id,
            ))
        db.commit()
        print("Student IDs saved. Rahim Hasan now has:")
        print("  - a held meeting with a signed report")
        print("  - a held meeting with a report waiting for Dr. Rahman's signature")
        print("  - a held meeting with no report yet (overdue)")
        print("  - one scheduled and one requested meeting")
if __name__ == "__main__":
    main()