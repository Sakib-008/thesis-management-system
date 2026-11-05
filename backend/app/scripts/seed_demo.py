"""Fill the database with realistic demo data for presenting the project.

Safe to run more than once: anything that already exists is skipped.
Run inside the backend container:
    docker compose exec backend python -m app.scripts.seed_demo
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.reference import Department, Program, ResearchField, SupervisorDesignation
from app.models.user import User, UserRole
from app.schemas.proposal import ProposalIn
from app.services import profile_service, proposal_service, user_service

PASSWORD = "Demo@12345"
DEPARTMENT = "Computer Science and Engineering"
PROGRAMS = ["BSc in CSE", "MSc in CSE"]
COORDINATOR = ("coordinator@university.edu", "Dr. Nasreen Akter")

# email, name, designation, research fields, students already supervised, expertise
SUPERVISORS = [
    (
        "a.rahman@university.edu", "Dr. A. Rahman", "Professor", 4,
        ["Deep Learning", "Computer Vision", "Machine Learning"],
        "Convolutional neural networks, object detection and image classification for autonomous driving.",
    ),
    (
        "s.chowdhury@university.edu", "Dr. S. Chowdhury", "Associate Professor", 3,
        ["Machine Learning", "Natural Language Processing", "Computer Vision"],
        "Image classification, transfer learning and text classification for low-resource languages.",
    ),
    (
        "m.karim@university.edu", "Dr. M. Karim", "Assistant Professor", 2,
        ["Machine Learning", "Data Science", "IoT"],
        "Pattern recognition, predictive modelling, time series analysis and sensor data.",
    ),
    (
        "k.islam@university.edu", "Dr. K. Islam", "Professor", 4,
        ["Cyber Security", "Distributed Systems"],
        "Applied cryptography, secure messaging, blockchain systems and intrusion detection.",
    ),
]

# email, name, CGPA, batch, CGPA verified by the coordinator?
STUDENTS = [
    ("rahim.hasan@university.edu", "Rahim Hasan", 3.88, "2022", True),
    ("zarin.tasnim@university.edu", "Zarin Tasnim", 3.92, "2022", True),
    ("tahmid.alam@university.edu", "Tahmid Alam", 3.85, "2022", True),
    ("nabila.karim@university.edu", "Nabila Karim", 3.74, "2022", True),
    ("sadman.hossain@university.edu", "Sadman Hossain", 3.61, "2022", True),
    ("fahim.reza@university.edu", "Fahim Reza", 3.40, "2022", False), # left unverified on purpose
]


# email, title, fields, keywords, abstract, problem, objectives, methodology, final state, reviewer comment
PROPOSALS = [
    (
        "rahim.hasan@university.edu", "Deep Learning Based Traffic Sign Recognition",
        ["Deep Learning", "Computer Vision"], ["CNN", "traffic signs", "image classification"],
        "A study of convolutional neural networks for traffic sign recognition under poor light and occlusion.",
        "Existing systems lose accuracy in low light and when signs are partly hidden by other objects.",
        "Build a CNN classifier for traffic signs\nTest its robustness to light, blur and occlusion",
        "Train and compare several CNN architectures on a public traffic sign dataset using data augmentation.",
        "approved", "Strong problem statement. Keep the dataset scope realistic for one semester.",
    ),
    (
        "zarin.tasnim@university.edu", "Plant Disease Detection From Leaf Images",
        ["Computer Vision", "Deep Learning"], ["plant disease", "leaf images", "classification"],
        "A mobile-friendly model that recognises common crop diseases from photographs of leaves.",
        "Farmers often identify plant diseases too late because experts are not available in rural areas.",
        "Collect and label a leaf image dataset\nTrain a lightweight classification model",
        "Fine-tune a pre-trained image model on labelled leaf photographs and evaluate it on unseen images.",
        "approved", "Clear and well scoped.",
    ),
    (
        "tahmid.alam@university.edu", "Secure Messaging With Post-Quantum Cryptography",
        ["Cyber Security"], ["cryptography", "secure messaging", "post-quantum"],
        "Designs and evaluates a messaging protocol that resists attacks by future quantum computers.",
        "Widely used public-key schemes can be broken by quantum computers, putting stored messages at risk.",
        "Review post-quantum key exchange schemes\nImplement a prototype messenger and measure its cost",
        "Implement a messaging prototype with a post-quantum key exchange and measure latency and message size.",
        "approved", "Good topic. Make the threat model explicit in the report.",
    ),
    (



         "nabila.karim@university.edu", "Explainable AI for Loan Approval Decisions",
         ["Machine Learning", "Data Science"], ["explainable AI", "credit scoring", "fairness"],
         "Compares explanation methods for machine learning models that decide whether a loan is approved.",
         "Loan applicants rarely receive an understandable reason when a model rejects their application.",
         "Train credit scoring models on a public dataset\nCompare explanation methods for clarity",
         "Train several models and compare explanation techniques using fidelity and user-readable summaries.",
         "approved", "Approved.",
    ),
    (
         "sadman.hossain@university.edu", "Predictive Maintenance Using Vibration Sensors",
         ["IoT", "Machine Learning"], ["predictive maintenance", "vibration", "sensors"],
         "Predicts machine failures early from vibration sensor readings using machine learning methods.",
         "Unplanned machine breakdowns in small factories cause long and costly production stops.",
         "Collect vibration data from a test rig\nTrain a model that predicts failure ahead of time",
         "Collect vibration signals, extract features and train classifiers that predict the remaining useful life.",
         "submitted", "",
    ),
    (
         "fahim.reza@university.edu", "Voice Assistant for Visually Impaired Users",
         ["Natural Language Processing", "Human-Computer Interaction"], ["voice assistant", "accessibility"],
         "A voice assistant that helps visually impaired users with everyday tasks on their phone.",
         "Many assistants are designed for sighted users and are hard to use without looking at the screen.",
         "Study the needs of visually impaired users\nBuild and test a voice interface prototype",
         "Interview users, build a voice interface prototype and evaluate it with a small usability study.",
         "revision_required", "Please narrow the scope to one language and describe how you will evaluate it.",
    ),
]

def user_for(db: Session, email: str, name: str, role: UserRole) -> User:
    existing = user_service.get_by_email(db, email)
    if existing:
        return existing
    print(f" created {role.value}: {email}")
    return user_service.create_user(db, email=email, full_name=name, password=PASSWORD, role=role)


def main() -> None:
    with SessionLocal() as db:
        print("Departments and programs")
        department = db.scalar(select(Department).where(Department.name == DEPARTMENT))
        if department is None:
            department = Department(name=DEPARTMENT)
            db.add(department)
            db.flush()
        programs = {}
        for name in PROGRAMS:
            program = db.scalar(
                select(Program).where(Program.name == name, Program.department_id == department.id)
            )
            if program is None:
                program = Program(name=name, department_id=department.id)
                db.add(program)
                db.flush()
            programs[name] = program

        print("Coordinator")
        coordinator = user_for(db, COORDINATOR[0], COORDINATOR[1], UserRole.coordinator)

        print("Supervisors")
        for email, name, designation_name, taken, fields, expertise in SUPERVISORS:
            user = user_for(db, email, name, UserRole.supervisor)
            if profile_service.get_supervisor_by_user(db, user.id):
                continue
            designation = db.scalar(
                select(SupervisorDesignation).where(SupervisorDesignation.name == designation_name)
            )
            field_ids = list(db.scalars(select(ResearchField.id).where(ResearchField.name.in_(fields))))
            supervisor = profile_service.create_supervisor(
                db, user, department_id=department.id, designation_id=designation.id,
                expertise=expertise, field_ids=field_ids,
            )
            supervisor.current_count = taken # students they already supervise, so the workload looks real

        print("Students")
        for email, name, cgpa, batch, verified in STUDENTS:
            user = user_for(db, email, name, UserRole.student)
            if profile_service.get_student_by_user(db, user.id):
                continue
            student = profile_service.upsert_student(
                db, user, department_id=department.id, program_id=programs[PROGRAMS[0]].id,
                batch=batch, cgpa=cgpa,
            )
            if verified:
                profile_service.verify_cgpa(db, student.id, coordinator)




        print("Proposals")
        for email, title, fields, keywords, abstract, problem, objectives, method, final, comment in PROPOSALS:
            user = user_service.get_by_email(db, email)
            if proposal_service.get_own(db, user):
                continue
            field_ids = list(db.scalars(select(ResearchField.id).where(ResearchField.name.in_(fields))))
            proposal = proposal_service.save_draft(db, user, ProposalIn(
                title=title, abstract=abstract, problem_statement=problem, objectives=objectives,
                methodology=method, keywords=keywords, field_ids=field_ids,
            ))
            proposal_service.submit(db, user)
            if final in ("approved", "revision_required"):
                proposal_service.review(db, proposal.id, coordinator, final, comment)

        db.commit()
    print(f"\nDone. Every demo account uses the password {PASSWORD}")


if __name__ == "__main__":
    main()
