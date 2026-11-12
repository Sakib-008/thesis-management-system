import re
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, InvalidInputError, NotFoundError
from app.models.ai import SystemSetting
from app.models.meetings import Meeting, WeeklyReport
from app.models.profile import Supervisor
from app.models.thesis import SupervisorAssignment, ThesisProposal
from app.models.user import User, UserRole
from app.reports.sheet import SheetData, render
from app.schemas.reports import (
    OverviewRow, ReportIn, ReportOut, ReportSettings, SheetHeader, SheetStudent, TaskOut,
)
from app.services import meeting_service as meetings
from app.services import proposal_service
from app.services.audit import log_audit

SETTINGS_KEY = "reports"
DEFAULT_SETTINGS = {
    "university_name": "Khulna University of Engineering & Technology",
    "course_number": "3200",
    "sheet_title": "Weekly Progress Report (Summary)",
    "due_days": 7,
}
EDITABLE = ("draft", "returned")  # the student may still change the report
RATING_LABEL = {"poor": "Poor", "average": "Average", "good": "Good", "excellent": "Excellent"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


# Words that are not part of a department's short code: "Electrical and Electronic Engineering" is EEE.
CODE_SKIP = {"department", "of", "and", "the", "in", "for"}


def department_code(name: str) -> str:
    """The short code of a department, worked out from its name: Computer Science and Engineering -> CSE."""
    words = [w for w in re.findall(r"[A-Za-z]+", name or "") if w.lower() not in CODE_SKIP]
    if not words:
        return ""
    if len(words) == 1:
        return words[0][:3].upper()  # a one-word name such as Physics becomes PHY
    return "".join(w[0] for w in words).upper()


# ----------------------------------------------------------------- settings
def get_settings(db: Session) -> dict:
    row = db.get(SystemSetting, SETTINGS_KEY)
    stored = dict(row.value) if row else {}
    if "course_number" not in stored and stored.get("course_code"):
        # saved before the department code became automatic: "CSE 3200" now means the number 3200
        stored["course_number"] = str(stored["course_code"]).split()[-1]
    stored.pop("course_code", None)
    return {**DEFAULT_SETTINGS, **stored}


def update_settings(db: Session, actor: User, data: ReportSettings) -> dict:
    values = {k: (v.strip() if isinstance(v, str) else v) for k, v in data.model_dump().items()}
    row = db.get(SystemSetting, SETTINGS_KEY)
    if row is None:
        db.add(SystemSetting(key=SETTINGS_KEY, value=values, updated_by=actor.id))
    else:
        row.value = values
        row.updated_by = actor.id
    log_audit(db, actor.id, "settings.update_reports", "settings", None, values)
    db.flush()
    return values


# ----------------------------------------------------------------- building the output
def _due_at(meeting: Meeting, cfg: dict) -> datetime | None:
    if meeting.completed_at is None:
        return None
    return meeting.completed_at + timedelta(days=cfg["due_days"])


def _overdue(status: str | None, due_at: datetime | None) -> bool:
    """A report is overdue when it is still missing, a draft or returned after its due date."""
    return status in (None, "draft", "returned") and due_at is not None and _now() > due_at


def _header(db: Session, thesis_id: int, cfg: dict) -> SheetHeader:
    students = meetings.students_of_thesis(db, thesis_id)
    department = students[0].department.name if students else ""
    line = department if department.lower().startswith("department of") else f"Department of {department}"
    course = f"{department_code(department)} {cfg['course_number']}".strip()  # for example CSE 3200
    supervisor = meetings.supervisor_of_thesis(db, thesis_id)
    return SheetHeader(
        department_line=line, university_name=cfg["university_name"], course_code=course,
        sheet_title=cfg["sheet_title"],
        students=[SheetStudent(name=s.user.full_name, student_number=s.student_number) for s in students],
        supervisor_name=supervisor.user.full_name if supervisor else None,
    )


def _out(db: Session, report: WeeklyReport, cfg: dict | None = None) -> ReportOut:
    cfg = cfg or get_settings(db)
    due_at = _due_at(report.meeting, cfg)
    return ReportOut(
        id=report.id, meeting_id=report.meeting_id, meeting_date=report.meeting.meeting_date, status=report.status,
        section_a=report.section_a, section_b=report.section_b, next_works=list(report.next_works or []),
        rating=report.rating, supervisor_comment=report.supervisor_comment,
        signed_by_name=report.signer.full_name if report.signer else None, signed_at=report.signed_at,
        returned_reason=report.returned_reason, submitted_at=report.submitted_at, updated_at=report.updated_at,
        due_at=due_at, overdue=_overdue(report.status, due_at), header=_header(db, report.thesis_id, cfg),
    )


def _visible_report(db: Session, report: WeeklyReport | None, user: User) -> WeeklyReport:
    if report is None or not meetings.can_view_thesis(db, report.thesis_id, user):
        raise NotFoundError("Report not found")
    if report.status == "draft" and user.role != UserRole.student:
        raise NotFoundError("Report not found")  # a draft is private to the student
    return report


# ---------------------------------------------------------------- reading
def tasks(db: Session, user: User) -> list[TaskOut]:
    thesis_id = meetings.own_thesis_id(db, user)
    if thesis_id is None:
        return []
    cfg = get_settings(db)
    rows = db.scalars(
        select(Meeting).where(Meeting.thesis_id == thesis_id, Meeting.status == "completed")
        .order_by(Meeting.meeting_date.desc())
    )
    out = []
    for meeting in rows:
        report = db.scalar(select(WeeklyReport).where(WeeklyReport.meeting_id == meeting.id))
        due_at = _due_at(meeting, cfg)
        status = report.status if report else None
        out.append(TaskOut(
            meeting_id=meeting.id, meeting_date=meeting.meeting_date, completed_at=meeting.completed_at,
            due_at=due_at, overdue=_overdue(status, due_at), report_id=report.id if report else None,
            report_status=status,
        ))
    return out


def get_by_meeting(db: Session, meeting_id: int, user: User) -> ReportOut:
    meeting = db.get(Meeting, meeting_id)
    if meeting is None or not meetings.can_view_thesis(db, meeting.thesis_id, user):
        raise NotFoundError("Meeting not found")
    report = db.scalar(select(WeeklyReport).where(WeeklyReport.meeting_id == meeting_id))
    if report is None or (report.status == "draft" and user.role != UserRole.student):
        raise NotFoundError("No report has been written for this meeting yet")
    return _out(db, report)


def get(db: Session, report_id: int, user: User) -> ReportOut:
    return _out(db, _visible_report(db, db.get(WeeklyReport, report_id), user))


def list_reports(db: Session, user: User, status: str | None = None) -> list[ReportOut]:
    stmt = select(WeeklyReport).where(WeeklyReport.status != "draft")
    if user.role == UserRole.supervisor:
        stmt = (
            stmt.join(ThesisProposal, ThesisProposal.thesis_id == WeeklyReport.thesis_id)
            .join(SupervisorAssignment, SupervisorAssignment.proposal_id == ThesisProposal.id)
            .join(Supervisor, Supervisor.id == SupervisorAssignment.supervisor_id)
            .where(Supervisor.user_id == user.id)
        )
    if status:
        stmt = stmt.where(WeeklyReport.status == status)
    cfg = get_settings(db)
    return [_out(db, r, cfg) for r in db.scalars(stmt.order_by(WeeklyReport.submitted_at.desc()))]


# --------------------------------------------------------------- the student
def _own_meeting(db: Session, user: User, meeting_id: int) -> Meeting:
    meeting = db.get(Meeting, meeting_id)
    if meeting is None or meeting.thesis_id != meetings.own_thesis_id(db, user):
        raise NotFoundError("Meeting not found")
    return meeting


def save_draft(db: Session, user: User, meeting_id: int, data: ReportIn) -> WeeklyReport:
    meeting = _own_meeting(db, user, meeting_id)
    if meeting.status != "completed":
        raise ConflictError("You can write the report once your supervisor has recorded the meeting")
    report = db.scalar(select(WeeklyReport).where(WeeklyReport.meeting_id == meeting_id))
    if report is not None and report.status not in EDITABLE:
        raise ConflictError("This report has been submitted and can no longer be edited")
    if report is None:
        report = WeeklyReport(meeting_id=meeting_id, thesis_id=meeting.thesis_id, created_by=user.id)
        db.add(report)
    report.section_a = data.section_a.strip()
    report.section_b = data.section_b.strip()
    report.next_works = [item for item in data.next_works if item]
    report.updated_at = _now()
    db.flush()
    return report


def submit(db: Session, user: User, meeting_id: int) -> WeeklyReport:
    meeting = _own_meeting(db, user, meeting_id)
    report = db.scalar(select(WeeklyReport).where(WeeklyReport.meeting_id == meeting.id))
    if report is None:
        raise NotFoundError("Save the report before submitting it")
    if report.status not in EDITABLE:
        raise ConflictError("This report has already been submitted")

    missing = []
    if len(report.section_a.strip()) < 10:
        missing.append("A: summary of the previous week")
    if len(report.section_b.strip()) < 10:
        missing.append("B: this week's activity")
    if not report.next_works:
        missing.append("C: at least one work for next week")
    if missing:
        raise InvalidInputError("Complete these before submitting: " + ", ".join(missing))
    if any(not s.student_number for s in meetings.students_of_thesis(db, report.thesis_id)):
        raise InvalidInputError("Add your Student ID to your profile before submitting a report")

    report.status = "submitted"
    report.submitted_at = _now()
    report.updated_at = _now()
    report.returned_reason = ""
    log_audit(db, user.id, "report.submit", "weekly_report", report.id, {"meeting_id": meeting.id})
    db.flush()
    return report


# --------------------------------------------------------------- the supervisor
def _as_supervisor(db: Session, report_id: int, user: User) -> WeeklyReport:
    report = db.get(WeeklyReport, report_id)
    if report is None or not meetings.is_assigned_supervisor(db, report.thesis_id, user):
        raise NotFoundError("Report not found")
    return report


def sign(db: Session, report_id: int, user: User, rating: str, comment: str) -> WeeklyReport:
    report = _as_supervisor(db, report_id, user)
    if report.status != "submitted":
        raise ConflictError("Only a submitted report can be signed")
    report.rating = rating
    report.supervisor_comment = comment.strip()
    report.signed_by = user.id
    report.signed_at = _now()
    report.status = "signed"
    report.updated_at = _now()
    log_audit(db, user.id, "report.sign", "weekly_report", report.id, {"rating": rating})
    db.flush()
    return report


def return_report(db: Session, report_id: int, user: User, reason: str) -> WeeklyReport:
    report = _as_supervisor(db, report_id, user)
    if report.status != "submitted":
        raise ConflictError("Only a submitted report can be returned")
    if not reason.strip():
        raise InvalidInputError("Tell the student what to change")
    report.status = "returned"
    report.returned_reason = reason.strip()
    report.updated_at = _now()
    log_audit(db, user.id, "report.return", "weekly_report", report.id)
    db.flush()
    return report


# ------------------------------------------------------------- coordinator view
def overview(db: Session) -> list[OverviewRow]:
    cfg = get_settings(db)
    rows = db.execute(
        select(ThesisProposal)
        .join(SupervisorAssignment, SupervisorAssignment.proposal_id == ThesisProposal.id)
        .order_by(ThesisProposal.id)
    ).scalars()
    out = []
    for proposal in rows:
        completed = list(db.scalars(
            select(Meeting).where(Meeting.thesis_id == proposal.thesis_id, Meeting.status == "completed")
        ))
        by_meeting = {
            r.meeting_id: r.status
            for r in db.scalars(select(WeeklyReport).where(WeeklyReport.thesis_id == proposal.thesis_id))
        }
        supervisor = meetings.supervisor_of_thesis(db, proposal.thesis_id)
        out.append(OverviewRow(
            proposal_id=proposal.id, title=proposal.title,
            student_names=[s.user.full_name for s in meetings.students_of_thesis(db, proposal.thesis_id)],
            supervisor_name=supervisor.user.full_name if supervisor else None, meetings_completed=len(completed),
            reports_submitted=sum(1 for m in completed if by_meeting.get(m.id) in ("submitted", "signed")),
            reports_signed=sum(1 for m in completed if by_meeting.get(m.id) == "signed"),
            overdue=sum(1 for m in completed if _overdue(by_meeting.get(m.id), _due_at(m, cfg))),
        ))
    return sorted(out, key=lambda r: (-r.overdue, r.student_names[0].casefold() if r.student_names else ""))


# ------------------------------------------------------------------- the PDFs
def _sheet(db: Session, report: WeeklyReport, cfg: dict) -> SheetData:
    header = _header(db, report.thesis_id, cfg)
    signed = report.status == "signed"
    return SheetData(
        department_line=header.department_line, university=header.university_name,
        title_line=f"{header.course_code}: {header.sheet_title}",
        students=[(s.name, s.student_number or "") for s in header.students],
        section_a=report.section_a, section_b=report.section_b, next_works=list(report.next_works or []),
        supervisor_name=report.signer.full_name if signed and report.signer else None,
        signed_on=report.signed_at.date() if signed and report.signed_at else None,
        rating=RATING_LABEL.get(report.rating or "") if signed else None,
        comment=report.supervisor_comment if signed else "", draft=report.status in EDITABLE,
    )


def pdf_for_report(db: Session, report_id: int, user: User) -> tuple[bytes, str]:
    report = _visible_report(db, db.get(WeeklyReport, report_id), user)
    cfg = get_settings(db)
    name = f"weekly-report-{report.meeting.meeting_date:%Y-%m-%d}.pdf"
    return render([_sheet(db, report, cfg)], "Weekly Progress Report"), name


def pdf_for_thesis(db: Session, proposal_id: int, user: User, only_signed: bool) -> tuple[bytes, str]:
    """Every submitted (or only signed) report of one thesis, oldest first: the pack for a defense."""
    proposal = proposal_service.get_visible(db, proposal_id, user)
    wanted = ("signed",) if only_signed else ("submitted", "signed")
    reports = list(db.scalars(
        select(WeeklyReport).join(Meeting, Meeting.id == WeeklyReport.meeting_id)
        .where(WeeklyReport.thesis_id == proposal.thesis_id, WeeklyReport.status.in_(wanted))
        .order_by(Meeting.meeting_date)
    ))
    if not reports:
        raise NotFoundError("There are no reports to print yet")
    cfg = get_settings(db)
    return render([_sheet(db, r, cfg) for r in reports], "Weekly Progress Reports"), "weekly-reports.pdf"