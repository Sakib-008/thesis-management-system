from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.reports import (
    OverviewRow, ReportIn, ReportOut, ReportSettings, ReturnIn, SignIn, TaskOut,
    )
from app.services import report_service as svc
router = APIRouter(tags=["reports"])
student_only = require_roles(UserRole.student)
supervisor_only = require_roles(UserRole.supervisor)
staff = require_roles(UserRole.coordinator, UserRole.admin)
admin_only = require_roles(UserRole.admin)
reviewers = require_roles(UserRole.supervisor, UserRole.coordinator, UserRole.admin)
def _pdf(content: bytes, filename: str) -> Response:
    return Response(
        content=content, media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
# ---------------------------------------------------------------- the student's report
@router.get("/meetings/{meeting_id}/report", response_model=ReportOut)
def get_meeting_report(meeting_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.get_by_meeting(db, meeting_id, user)
@router.put("/meetings/{meeting_id}/report", response_model=ReportOut)
def save_report(
    meeting_id: int, body: ReportIn, user: User = Depends(student_only), db: Session = Depends(get_db)
):
    report = svc.save_draft(db, user, meeting_id, body)
    db.commit()
    return svc.get_by_meeting(db, meeting_id, user)
@router.post("/meetings/{meeting_id}/report/submit", response_model=ReportOut)
def submit_report(meeting_id: int, user: User = Depends(student_only), db: Session = Depends(get_db)):
    svc.submit(db, user, meeting_id)
    db.commit()
    return svc.get_by_meeting(db, meeting_id, user)
# The fixed paths come first so that "tasks" and "overview" are never read as a report id.
@router.get("/reports/tasks", response_model=list[TaskOut])
def my_tasks(user: User = Depends(student_only), db: Session = Depends(get_db)):
    return svc.tasks(db, user)
@router.get("/reports/overview", response_model=list[OverviewRow])
def overview(_: User = Depends(staff), db: Session = Depends(get_db)):
    return svc.overview(db)
@router.get("/reports", response_model=list[ReportOut])
def list_reports(status: str | None = None, user: User = Depends(reviewers), db: Session = Depends(get_db)):
    """Submitted, returned and signed reports: a supervisor's students, or everyone's for staff."""
    return svc.list_reports(db, user, status)
@router.get("/reports/{report_id}", response_model=ReportOut)
def get_report(report_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.get(db, report_id, user)
@router.get("/reports/{report_id}/pdf")
def report_pdf(report_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    content, filename = svc.pdf_for_report(db, report_id, user)
    return _pdf(content, filename)
@router.get("/proposals/{proposal_id}/reports/pdf")
def thesis_reports_pdf(
    proposal_id: int, only_signed: bool = False, user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """All reports of a thesis in one PDF, oldest first: the pack to bring to a defense."""
    content, filename = svc.pdf_for_thesis(db, proposal_id, user, only_signed)
    return _pdf(content, filename)
# -------------------------------------------------------------- the supervisor signs
@router.post("/reports/{report_id}/sign", response_model=ReportOut)
def sign_report(
    report_id: int, body: SignIn, user: User = Depends(supervisor_only), db: Session = Depends(get_db)
):
    svc.sign(db, report_id, user, body.rating, body.comment)
    db.commit()
    return svc.get(db, report_id, user)
@router.post("/reports/{report_id}/return", response_model=ReportOut)
def return_report(
    report_id: int, body: ReturnIn, user: User = Depends(supervisor_only), db: Session = Depends(get_db)
):
    svc.return_report(db, report_id, user, body.reason)
    db.commit()
    return svc.get(db, report_id, user)
# --------------------------------------------------------------------- settings
@router.get("/settings/reports", response_model=ReportSettings)
def get_report_settings(_: User = Depends(staff), db: Session = Depends(get_db)):
    return svc.get_settings(db)
@router.put("/settings/reports", response_model=ReportSettings)
def update_report_settings(
    body: ReportSettings, actor: User = Depends(admin_only), db: Session = Depends(get_db)
):
    values = svc.update_settings(db, actor, body)
    db.commit()
    return values