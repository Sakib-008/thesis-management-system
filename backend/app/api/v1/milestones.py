from typing import Any

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from starlette.datastructures import UploadFile as FormFile

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.supervision import (
    FeedbackIn, FeedbackOut, MilestoneIn, MilestoneOut, MilestoneUpdate, ProgressOut, ReviewIn, SubmissionOut,
)
from app.services import milestone_service as svc

router = APIRouter(tags=["milestones"])

student_only = require_roles(UserRole.student)
supervisor_only = require_roles(UserRole.supervisor)

# Uploaded files are sent as downloads, never as pages, and the browser must not guess their type.
DOWNLOAD_HEADERS = {"X-Content-Type-Options": "nosniff"}


def uploaded(file: Any) -> UploadFile | None:
    """A form with no file chosen sends an empty text part instead of a file. That means "no file"."""
    return file if isinstance(file, FormFile) else None  # FormFile is what the form parser really produces


# ------------------------------------------------------------------ milestones
@router.get("/milestones/progress", response_model=list[ProgressOut])
def progress(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """One row per thesis the person may see. A student gets their own."""
    return svc.progress(db, user)


@router.get("/milestones", response_model=list[MilestoneOut])
def list_milestones(
    thesis_id: int | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return svc.list_milestones(db, user, thesis_id)


@router.post("/milestones", response_model=MilestoneOut)
def create_milestone(body: MilestoneIn, user: User = Depends(supervisor_only), db: Session = Depends(get_db)):
    milestone = svc.create_milestone(db, user, body)
    db.commit()
    return svc.get_milestone(db, milestone.id, user)


@router.get("/milestones/{milestone_id}", response_model=MilestoneOut)
def get_milestone(milestone_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.get_milestone(db, milestone_id, user)


@router.put("/milestones/{milestone_id}", response_model=MilestoneOut)
def update_milestone(
    milestone_id: int, body: MilestoneUpdate, user: User = Depends(supervisor_only), db: Session = Depends(get_db)
):
    svc.update_milestone(db, milestone_id, user, body)
    db.commit()
    return svc.get_milestone(db, milestone_id, user)


@router.delete("/milestones/{milestone_id}", status_code=204)
def delete_milestone(milestone_id: int, user: User = Depends(supervisor_only), db: Session = Depends(get_db)):
    svc.delete_milestone(db, milestone_id, user)
    db.commit()


# ----------------------------------------------------------------- submissions
@router.get("/milestones/{milestone_id}/submissions", response_model=list[SubmissionOut])
def milestone_submissions(milestone_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    svc.get_milestone(db, milestone_id, user)  # the same visibility rules as the milestone
    return svc.list_submissions(db, user, milestone_id=milestone_id)


@router.post("/milestones/{milestone_id}/submissions", response_model=SubmissionOut)
def submit_work(
    milestone_id: int,
    note: str = Form(default=""),
    file: Any = File(default=None),
    user: User = Depends(student_only),
    db: Session = Depends(get_db),
):
    """Hand in work for a milestone: a note, a file, or both."""
    submission = svc.submit(db, user, milestone_id, note, uploaded(file))
    db.commit()
    return svc.get_submission(db, submission.id, user)


@router.get("/submissions", response_model=list[SubmissionOut])
def list_submissions(
    status: str | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return svc.list_submissions(db, user, status)


@router.get("/submissions/{submission_id}", response_model=SubmissionOut)
def get_submission(submission_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.get_submission(db, submission_id, user)


@router.get("/submissions/{submission_id}/download")
def download_submission(submission_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    path, name, content_type = svc.download_submission(db, submission_id, user)
    return FileResponse(path, media_type=content_type, filename=name, headers=DOWNLOAD_HEADERS)


@router.post("/submissions/{submission_id}/review", response_model=SubmissionOut)
def review_submission(
    submission_id: int, body: ReviewIn, user: User = Depends(supervisor_only), db: Session = Depends(get_db)
):
    svc.review(db, submission_id, user, body.decision, body.feedback)
    db.commit()
    return svc.get_submission(db, submission_id, user)


@router.post("/submissions/{submission_id}/feedback", response_model=SubmissionOut)
def add_feedback(
    submission_id: int, body: FeedbackIn, user: User = Depends(supervisor_only), db: Session = Depends(get_db)
):
    svc.add_feedback(db, submission_id, user, body.content)
    db.commit()
    return svc.get_submission(db, submission_id, user)


# -------------------------------------------------------------------- feedback
@router.get("/feedback", response_model=list[FeedbackOut])
def list_feedback(status: str | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.list_feedback(db, user, status)


@router.post("/feedback/{feedback_id}/resolve", response_model=FeedbackOut)
def resolve_feedback(feedback_id: int, user: User = Depends(student_only), db: Session = Depends(get_db)):
    svc.resolve_feedback(db, feedback_id, user)
    db.commit()
    return svc.get_feedback(db, feedback_id, user)