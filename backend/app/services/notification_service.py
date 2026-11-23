"""Notifications.
Every important action is already written to the audit log by log_audit(). dispatch() is called from there and
turns such an action into notifications for the people it concerns, so the services that did the work needed no
change. Reminders (deadlines coming up, work waiting too long) are created when a person's notifications are read."""
from datetime import datetime, timedelta, timezone
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session
from app.core.errors import NotFoundError
from app.models.meetings import Meeting, WeeklyReport
from app.models.notification import Notification
from app.models.supervision import Document, Milestone, MilestoneStatus, MilestoneSubmission
from app.models.thesis import ThesisProposal
from app.models.profile import Student
from app.models.user import User, UserRole
from app.schemas.notifications import NotificationOut
from app.services import meeting_service as meetings

Note = tuple[list[int], str, str]  # who, the text, where it leads


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _day(value: datetime) -> str:
    return value.strftime("%d %b")


# ------------------------------------------------------------------ creating
def notify(
    db: Session,
    user_ids: list[int],
    type_: str,
    text: str,
    href: str | None,
    actor_id: int | None = None,
    entity: str | None = None,
    entity_id: int | None = None,
    key: str | None = None,
) -> int:
    """One notification per person. The person who did the action is skipped, and so is a repeat of a keyed one."""
    actor = db.get(User, actor_id) if actor_id else None
    made = 0
    for user_id in dict.fromkeys(user_ids):  # no duplicates, same order
        if user_id == actor_id:
            continue
        if key is not None:
            exists = db.scalar(
                select(Notification.id).where(
                    Notification.user_id == user_id,
                    Notification.type == type_,
                    Notification.payload["key"].astext == key,
                )
            )
            if exists is not None:
                continue
        payload = {
            "text": text,
            "href": href,
            "actor": actor.full_name if actor else None,
            "entity": entity,
            "entity_id": entity_id,
        }
        if key is not None:
            payload["key"] = key
        db.add(Notification(user_id=user_id, type=type_, payload=payload))
        made += 1
    return made


# --------------------------------------------------------- who is involved
def _coordinators(db: Session) -> list[int]:
    return list(db.scalars(select(User.id).where(User.role == UserRole.coordinator, User.is_active.is_(True))))


def _people(db: Session, thesis_id: int):
    students = meetings.students_of_thesis(db, thesis_id)
    supervisor = meetings.supervisor_of_thesis(db, thesis_id)
    names = ", ".join(s.user.full_name for s in students)
    return [s.user_id for s in students], (supervisor.user_id if supervisor else None), names, supervisor


def _to_supervisor(supervisor_id: int | None) -> list[int]:
    return [supervisor_id] if supervisor_id else []


# ------------------------------------------------------ the rules, by action
def _proposal(db: Session, action: str, entity_id: int, actor_id: int | None, meta: dict) -> list[Note]:
    proposal = db.get(ThesisProposal, entity_id)
    if proposal is None:
        return []
    students, supervisor_id, names, supervisor = _people(db, proposal.thesis_id)
    if action == "proposal.submit":
        return [(_coordinators(db), f"{names} submitted a proposal for review", "/coordinator/proposals")]
    if action == "proposal.approved":
        return [(students, "Your proposal was approved", "/student/proposal")]
    if action == "proposal.revision_required":
        return [(students, "Your proposal needs changes. Read the coordinator's comment", "/student/proposal")]
    # assignment.assign and assignment.change
    out: list[Note] = []
    if supervisor is not None:
        out.append((students, f"{supervisor.user.full_name} is now your supervisor", "/student/thesis"))
        out.append((_to_supervisor(supervisor_id), f"{names} was assigned to you", "/supervisor/students"))
    return out


def _meeting(db: Session, action: str, entity_id: int, actor_id: int | None, meta: dict) -> list[Note]:
    meeting = db.get(Meeting, entity_id)
    if meeting is None:
        return []
    students, supervisor_id, names, _ = _people(db, meeting.thesis_id)
    when = _day(meeting.meeting_date)
    if action == "meeting.request":
        return [(_to_supervisor(supervisor_id), f"{names} asked for a meeting on {when}", "/supervisor/meetings")]
    if action == "meeting.accept":
        return [(students, f"Your meeting on {when} was accepted", "/student/meetings")]
    if action == "meeting.schedule":
        return [(students, f"Your supervisor scheduled a meeting on {when}", "/student/meetings")]
    if action == "meeting.reschedule":
        return [(students, f"Your meeting was moved to {when}", "/student/meetings")]
    if action == "meeting.decline":
        return [(students, f"Your meeting request for {when} was declined", "/student/meetings")]
    if action == "meeting.complete":
        return [
            (
                students,
                f"Your meeting of {when} was recorded. Write your weekly report",
                f"/student/reports/{meeting.id}",
            )
        ]
    if action == "meeting.cancel":
        if actor_id in students:
            return [
                (_to_supervisor(supervisor_id), f"{names} cancelled the meeting on {when}", "/supervisor/meetings")
            ]
        return [(students, f"Your meeting on {when} was cancelled", "/student/meetings")]
    return []


def _report(db: Session, action: str, entity_id: int, actor_id: int | None, meta: dict) -> list[Note]:
    report = db.get(WeeklyReport, entity_id)
    if report is None:
        return []
    students, supervisor_id, names, _ = _people(db, report.thesis_id)
    link = f"/student/reports/{report.meeting_id}"
    if action == "report.submit":
        return [
            (_to_supervisor(supervisor_id), f"{names} submitted a weekly report", f"/supervisor/reports/{report.id}")
        ]
    if action == "report.sign":
        rating = str(meta.get("rating", "")).capitalize()
        return [(students, f"Your weekly report was signed{f' ({rating})' if rating else ''}", link)]
    if action == "report.return":
        return [(students, "Your weekly report was returned. Read why and send it again", link)]
    return []


def _milestone(db: Session, action: str, entity_id: int, actor_id: int | None, meta: dict) -> list[Note]:
    milestone = db.get(Milestone, entity_id)
    if milestone is None:
        return []
    students, supervisor_id, names, _ = _people(db, milestone.thesis_id)
    title, link = milestone.title, f"/student/milestones/{milestone.id}/submit"
    if action == "milestone.create":
        return [(students, f"New milestone: {title}", "/student/milestones")]
    if action == "milestone.submit":
        return [
            (_to_supervisor(supervisor_id), f"{names} handed in work for “{title}”", "/supervisor/milestones"),
        ]
    if action == "milestone.approve":
        return [(students, f"“{title}” was approved", link)]
    if action == "milestone.request_revision":
        return [(students, f"Changes were requested on “{title}”", link)]
    if action == "feedback.add":
        return [(students, f"New comment on “{title}”", link)]
    return []


def _document(db: Session, action: str, entity_id: int, actor_id: int | None, meta: dict) -> list[Note]:
    document = db.get(Document, entity_id)
    if document is None:
        return []
    students, supervisor_id, names, _ = _people(db, document.thesis_id)
    what = "A new version of" if action == "document.version" else "A new document:"
    if action == "document.version":
        text = f"{what} “{document.title}” was uploaded"
    else:
        text = f"{what} “{document.title}”"
    if actor_id in students:
        return [(_to_supervisor(supervisor_id), f"{names}: {text}", "/supervisor/documents")]
    return [(students, text, "/student/documents")]


def _evaluation(db: Session, action: str, entity_id: int, actor_id: int | None, meta: dict) -> list[Note]:
    """Marks and results are per student, so only that student is named and told."""
    students, supervisor_id, names, _ = _people(db, entity_id)
    member = next((s for s in meetings.students_of_thesis(db, entity_id) if s.id == meta.get("student_id")), None)
    if member is not None:
        students, names = [member.user_id], member.user.full_name
    if action == "evaluation.submit":
        return [
            (_coordinators(db), f"An evaluation was submitted for {names}", f"/coordinator/evaluations/{entity_id}")
        ]
    return [
        (students, "Your thesis result has been published", "/student/evaluation"),
        (_to_supervisor(supervisor_id), f"The result for {names} has been published", "/supervisor/evaluations"),
    ]


def _student(db: Session, action: str, entity_id: int, actor_id: int | None, meta: dict) -> list[Note]:
    student = db.get(Student, entity_id)
    return [([student.user_id], "Your CGPA was verified", "/student/profile")] if student else []


RULES = {
    **dict.fromkeys(
        (
            "proposal.submit",
            "proposal.approved",
            "proposal.revision_required",
            "assignment.assign",
            "assignment.change",
        ),
        _proposal,
    ),
    **dict.fromkeys(
        (
            "meeting.request",
            "meeting.accept",
            "meeting.schedule",
            "meeting.reschedule",
            "meeting.decline",
            "meeting.complete",
            "meeting.cancel",
        ),
        _meeting,
    ),
    **dict.fromkeys(("report.submit", "report.sign", "report.return"), _report),
    **dict.fromkeys(
        ("milestone.create", "milestone.submit", "milestone.approve", "milestone.request_revision", "feedback.add"),
        _milestone,
    ),
    **dict.fromkeys(("document.create", "document.version"), _document),
    **dict.fromkeys(("evaluation.submit", "evaluation.publish"), _evaluation),
    "student.verify_cgpa": _student,
}


def dispatch(
    db: Session, actor_id: int | None, action: str, entity: str, entity_id: int | None, meta: dict | None
) -> None:
    """Called by log_audit(). Never raises: a problem here must not undo the action that was just done."""
    rule = RULES.get(action)
    if rule is None or entity_id is None:
        return
    try:
        with db.begin_nested():  # a savepoint, so a failure here rolls back only the notifications
            for user_ids, text, href in rule(db, action, entity_id, actor_id, meta or {}):
                notify(db, user_ids, action, text, href, actor_id=actor_id, entity=entity, entity_id=entity_id)
    except Exception:  # noqa: BLE001
        pass


# ----------------------------------------------------------------- reading
def _out(n: Notification) -> NotificationOut:
    p = n.payload or {}
    return NotificationOut(
        id=n.id,
        type=n.type,
        text=p.get("text", ""),
        href=p.get("href"),
        actor_name=p.get("actor"),
        read=n.read_at is not None,
        created_at=n.created_at,
    )


def list_for(db: Session, user: User, unread_only: bool = False, limit: int = 30) -> list[NotificationOut]:
    stmt = select(Notification).where(Notification.user_id == user.id)
    if unread_only:
        stmt = stmt.where(Notification.read_at.is_(None))
    rows = db.scalars(stmt.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(min(limit, 100)))
    return [_out(n) for n in rows]


def unread_count(db: Session, user: User) -> int:
    return (
        db.scalar(
            select(func.count(Notification.id)).where(Notification.user_id == user.id, Notification.read_at.is_(None))
        )
        or 0
    )


def mark_read(db: Session, user: User, notification_id: int) -> None:
    row = db.get(Notification, notification_id)
    if row is None or row.user_id != user.id:
        raise NotFoundError("Notification not found")
    if row.read_at is None:
        row.read_at = _now()


def mark_all_read(db: Session, user: User) -> int:
    result = db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.read_at.is_(None))
        .values(read_at=_now())
    )
    return result.rowcount or 0


# ---------------------------------------------------------------- reminders
SOON_DAYS, REPORT_SOON_DAYS, WAITING_DAYS = 3, 2, 3
_last_check: dict[int, datetime] = {}  # when each person's reminders were last worked out


def refresh_reminders(db: Session, user: User, force: bool = False) -> int:
    """Create reminders that are due. Each one is created once, because it carries a key."""
    last = _last_check.get(user.id)
    if not force and last is not None and _now() - last < timedelta(minutes=30):
        return 0
    _last_check[user.id] = _now()
    if user.role == UserRole.student:
        return _student_reminders(db, user)
    if user.role == UserRole.supervisor:
        return _supervisor_reminders(db, user)
    return 0


def _student_reminders(db: Session, user: User) -> int:
    from app.services import report_service  # imported here: report_service uses log_audit, which uses this module

    thesis_id = meetings.own_thesis_id(db, user)
    if thesis_id is None:
        return 0
    made, today = 0, _now().date()
    open_states = (MilestoneStatus.not_started, MilestoneStatus.in_progress, MilestoneStatus.revision_required)
    for m in db.scalars(select(Milestone).where(Milestone.thesis_id == thesis_id, Milestone.status.in_(open_states))):
        days = (m.deadline - today).days
        if days < 0:
            made += notify(
                db,
                [user.id],
                "reminder.milestone",
                f"“{m.title}” is {-days} day(s) overdue",
                f"/student/milestones/{m.id}/submit",
                key=f"milestone:{m.id}:overdue",
            )
        elif days <= SOON_DAYS:
            when = "today" if days == 0 else f"in {days} day(s)"
            made += notify(
                db,
                [user.id],
                "reminder.milestone",
                f"“{m.title}” is due {when}",
                f"/student/milestones/{m.id}/submit",
                key=f"milestone:{m.id}:soon",
            )
    due_days = report_service.get_settings(db)["due_days"]
    for meeting in db.scalars(select(Meeting).where(Meeting.thesis_id == thesis_id, Meeting.status == "completed")):
        report = db.scalar(select(WeeklyReport).where(WeeklyReport.meeting_id == meeting.id))
        if report is not None and report.status not in ("draft", "returned"):
            continue
        if meeting.completed_at is None:
            continue
        days = (meeting.completed_at + timedelta(days=due_days) - _now()).days
        link = f"/student/reports/{meeting.id}"
        if days < 0:
            made += notify(
                db,
                [user.id],
                "reminder.report",
                f"Your weekly report for {_day(meeting.meeting_date)} is overdue",
                link,
                key=f"report:{meeting.id}:overdue",
            )
        elif days <= REPORT_SOON_DAYS:
            made += notify(
                db,
                [user.id],
                "reminder.report",
                f"Your weekly report for {_day(meeting.meeting_date)} is due soon",
                link,
                key=f"report:{meeting.id}:soon",
            )
    return made


def _supervisor_reminders(db: Session, user: User) -> int:
    made, limit = 0, _now() - timedelta(days=WAITING_DAYS)
    from app.services import milestone_service  # the same visibility rules as the supervisor's own screens

    for sub in milestone_service.list_submissions(db, user, status="submitted"):
        if sub.submitted_at <= limit:
            made += notify(
                db,
                [user.id],
                "reminder.review",
                f"{', '.join(sub.student_names)}: “{sub.milestone_title}” has waited for your review "
                f"for {(_now() - sub.submitted_at).days} days",
                f"/supervisor/submissions/{sub.id}/review",
                key=f"review:{sub.id}",
            )
    for report in db.scalars(select(WeeklyReport).where(WeeklyReport.status == "submitted")):
        if not meetings.is_assigned_supervisor(db, report.thesis_id, user):
            continue
        if report.submitted_at is not None and report.submitted_at <= limit:
            names = ", ".join(s.user.full_name for s in meetings.students_of_thesis(db, report.thesis_id))
            made += notify(
                db,
                [user.id],
                "reminder.sign",
                f"{names}'s weekly report is waiting for your signature",
                f"/supervisor/reports/{report.id}",
                key=f"sign:{report.id}",
            )
    return made
