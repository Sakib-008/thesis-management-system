"""Figures for the four dashboards. Each query is scoped to what that role may see elsewhere in the system."""
from datetime import datetime, timedelta, timezone
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog
from app.models.meetings import Meeting, WeeklyReport
from app.models.profile import Student, Supervisor
from app.models.supervision import Feedback, Milestone, MilestoneStatus, MilestoneSubmission
from app.models.reference import Department, ResearchField
from app.models.evaluation import ThesisResult
from app.models.thesis import (
    AssignmentMethod,
    ProposalStatus,
    SupervisorAssignment,
    Thesis,
    ThesisProposal,
    proposal_fields,
)
from app.models.user import User, UserRole
from app.schemas.dashboard import (
    ActivityItem,
    AdminDashboard,
    CoordinatorDashboard,
    ReportStats,
    StudentDashboard,
    SupervisorDashboard,
)
from app.services import evaluation_service, meeting_service, proposal_service, report_service


def _now() -> datetime:
    return datetime.now(timezone.utc)


# --------------------------------------------------------------------- student
def student_dashboard(db: Session, user: User) -> StudentDashboard:
    proposal = proposal_service.get_own(db, user)
    if proposal is None:
        return StudentDashboard(
            has_thesis=False,
            thesis_title=None,
            supervisor_name=None,
            milestones_total=0,
            milestones_completed=0,
            progress_percent=0,
            next_deadline=None,
            next_deadline_label=None,
            upcoming_meeting=None,
            open_feedback=0,
            overdue_reports=0,
            result_published=False,
        )
    thesis_id = proposal.thesis_id
    supervisor = meeting_service.supervisor_of_thesis(db, thesis_id)
    milestones = list(db.scalars(select(Milestone).where(Milestone.thesis_id == thesis_id)))
    completed = sum(1 for m in milestones if m.status == MilestoneStatus.completed)
    unfinished = [m for m in milestones if m.status != MilestoneStatus.completed]
    next_milestone = min(unfinished, key=lambda m: m.deadline) if unfinished else None
    next_meeting = db.scalar(
        select(func.min(Meeting.meeting_date)).where(
            Meeting.thesis_id == thesis_id, Meeting.status == "scheduled", Meeting.meeting_date >= _now()
        )
    )
    open_feedback = (
        db.scalar(
            select(func.count(Feedback.id))
            .join(MilestoneSubmission, MilestoneSubmission.id == Feedback.submission_id)
            .join(Milestone, Milestone.id == MilestoneSubmission.milestone_id)
            .where(Milestone.thesis_id == thesis_id, Feedback.status == "open")
        )
        or 0
    )
    due_days = report_service.get_settings(db)["due_days"]
    overdue_reports = 0
    for meeting in db.scalars(select(Meeting).where(Meeting.thesis_id == thesis_id, Meeting.status == "completed")):
        report = db.scalar(select(WeeklyReport).where(WeeklyReport.meeting_id == meeting.id))
        if meeting.completed_at is None:
            continue
        due_at = meeting.completed_at + timedelta(days=due_days)
        if (report is None or report.status in ("draft", "returned")) and _now() > due_at:
            overdue_reports += 1
    result = evaluation_service.my_result(db, user)
    return StudentDashboard(
        has_thesis=True,
        thesis_title=proposal.title,
        supervisor_name=supervisor.user.full_name if supervisor else None,
        milestones_total=len(milestones),
        milestones_completed=completed,
        progress_percent=round(100 * completed / len(milestones)) if milestones else 0,
        next_deadline=(
            datetime.combine(next_milestone.deadline, datetime.min.time(), tzinfo=timezone.utc)
            if next_milestone
            else None
        ),
        next_deadline_label=next_milestone.title if next_milestone else None,
        upcoming_meeting=next_meeting,
        open_feedback=open_feedback,
        overdue_reports=overdue_reports,
        result_published=result.published,
    )


# ------------------------------------------------------------------- supervisor
def supervisor_dashboard(db: Session, user: User) -> SupervisorDashboard:
    supervisor = db.scalar(select(Supervisor).where(Supervisor.user_id == user.id))
    if supervisor is None:
        return SupervisorDashboard(
            students_count=0,
            capacity=0,
            pending_reviews=0,
            upcoming_meetings=0,
            overdue_milestones=0,
            waiting_reports=0,
        )
    theses = db.scalars(
        select(ThesisProposal.thesis_id)
        .join(SupervisorAssignment, SupervisorAssignment.proposal_id == ThesisProposal.id)
        .where(SupervisorAssignment.supervisor_id == supervisor.id)
    ).all()
    pending = (
        db.scalar(
            select(func.count(MilestoneSubmission.id))
            .join(Milestone)
            .where(Milestone.thesis_id.in_(theses), MilestoneSubmission.status == MilestoneStatus.submitted)
        )
        or 0
    )
    upcoming = (
        db.scalar(
            select(func.count(Meeting.id)).where(
                Meeting.thesis_id.in_(theses), Meeting.status == "scheduled", Meeting.meeting_date >= _now()
            )
        )
        or 0
    )
    overdue_milestones = (
        db.scalar(
            select(func.count(Milestone.id)).where(
                Milestone.thesis_id.in_(theses),
                Milestone.status != MilestoneStatus.completed,
                Milestone.deadline < _now().date(),
            )
        )
        or 0
    )
    waiting_reports = (
        db.scalar(
            select(func.count(WeeklyReport.id)).where(
                WeeklyReport.thesis_id.in_(theses), WeeklyReport.status == "submitted"
            )
        )
        or 0
    )
    return SupervisorDashboard(
        students_count=len(theses),
        capacity=supervisor.capacity,
        pending_reviews=pending,
        upcoming_meetings=upcoming,
        overdue_milestones=overdue_milestones,
        waiting_reports=waiting_reports,
    )


# ------------------------------------------------------------------- coordinator
def coordinator_dashboard(db: Session) -> CoordinatorDashboard:
    students_total = db.scalar(select(func.count(Student.id))) or 0
    cgpa_pending = db.scalar(select(func.count(Student.id)).where(Student.cgpa_verified.is_(False))) or 0
    supervisors_total = db.scalar(select(func.count(Supervisor.id))) or 0
    open_slots = db.scalar(select(func.sum(Supervisor.capacity - Supervisor.current_count))) or 0
    proposals_pending = (
        db.scalar(select(func.count(ThesisProposal.id)).where(ThesisProposal.status == ProposalStatus.submitted)) or 0
    )
    awaiting = (
        db.scalar(
            select(func.count(ThesisProposal.id)).where(
                ThesisProposal.status == ProposalStatus.approved,
                ~ThesisProposal.id.in_(select(SupervisorAssignment.proposal_id)),
            )
        )
        or 0
    )
    assigned_ids = db.scalars(select(SupervisorAssignment.proposal_id)).all()
    active_theses = len(assigned_ids)
    overdue_theses = (
        db.scalar(
            select(func.count(func.distinct(Milestone.thesis_id)))
            .join(ThesisProposal, ThesisProposal.thesis_id == Milestone.thesis_id)
            .where(
                ThesisProposal.id.in_(assigned_ids),
                Milestone.status != MilestoneStatus.completed,
                Milestone.deadline < _now().date(),
            )
        )
        or 0
    )
    by_field = db.execute(
        select(ResearchField.name, func.count(func.distinct(ThesisProposal.id)))
        .select_from(ThesisProposal)
        .join(proposal_fields, proposal_fields.c.proposal_id == ThesisProposal.id)
        .join(ResearchField, ResearchField.id == proposal_fields.c.field_id)
        .where(ThesisProposal.id.in_(assigned_ids) if assigned_ids else ThesisProposal.id.in_([]))
        .group_by(ResearchField.name)
        .order_by(func.count(func.distinct(ThesisProposal.id)).desc())
    ).all()
    completions = db.execute(
        select(func.to_char(Milestone.deadline, "YYYY-MM"), func.count())
        .where(Milestone.thesis_id.in_(assigned_ids), Milestone.status == MilestoneStatus.completed)
        .group_by(func.to_char(Milestone.deadline, "YYYY-MM"))
        .order_by(func.to_char(Milestone.deadline, "YYYY-MM"))
    ).all()
    workload = [
        (s.user.full_name, s.current_count, s.capacity)
        for s in db.scalars(select(Supervisor).order_by(Supervisor.current_count.desc())).all()
    ]
    return CoordinatorDashboard(
        students_total=students_total,
        cgpa_pending=cgpa_pending,
        supervisors_total=supervisors_total,
        open_slots=int(open_slots),
        proposals_pending=proposals_pending,
        awaiting_assignment=awaiting,
        active_theses=active_theses,
        overdue_theses=overdue_theses,
        proposals_by_field=list(by_field),
        completions_by_month=list(completions),
        workload_by_supervisor=workload,
    )


# ------------------------------------------------------------------------ reports
def report_stats(db: Session) -> ReportStats:
    assigned = db.execute(
        select(ThesisProposal.id, ThesisProposal.thesis_id, SupervisorAssignment.method).join(
            SupervisorAssignment, SupervisorAssignment.proposal_id == ThesisProposal.id
        )
    ).all()
    assigned_ids = [row[0] for row in assigned]
    thesis_ids = [row[1] for row in assigned]
    method_counts: dict[str, int] = {"Allocation run": 0, "Manual": 0}
    for _, _, method in assigned:
        key = "Allocation run" if method == AssignmentMethod.merit_allocation else "Manual"
        method_counts[key] += 1
    results = db.execute(
        select(ThesisResult.thesis_id, ThesisResult.published_at, Thesis.created_at)
        .join(Thesis, Thesis.id == ThesisResult.thesis_id)
        .where(ThesisResult.thesis_id.in_(thesis_ids) if thesis_ids else ThesisResult.thesis_id.in_([]))
    ).all()
    completion_days = [
        (published_at - created_at).days for _, published_at, created_at in results if published_at and created_at
    ]
    avg_days = round(sum(completion_days) / len(completion_days)) if completion_days else None
    rate = round(100 * len(results) / len(assigned_ids)) if assigned_ids else 0
    overdue_theses = (
        db.scalar(
            select(func.count(func.distinct(Milestone.thesis_id))).where(
                Milestone.thesis_id.in_(thesis_ids) if thesis_ids else Milestone.thesis_id.in_([]),
                Milestone.status != MilestoneStatus.completed,
                Milestone.deadline < _now().date(),
            )
        )
        or 0
    )
    by_month = db.execute(
        select(func.to_char(ThesisResult.published_at, "YYYY-MM"), func.count())
        .where(ThesisResult.thesis_id.in_(thesis_ids) if thesis_ids else ThesisResult.thesis_id.in_([]))
        .group_by(func.to_char(ThesisResult.published_at, "YYYY-MM"))
        .order_by(func.to_char(ThesisResult.published_at, "YYYY-MM"))
    ).all()
    by_dept = db.execute(
        select(Department.name, func.count(func.distinct(ThesisProposal.id)))
        .select_from(ThesisProposal)
        .join(SupervisorAssignment, SupervisorAssignment.proposal_id == ThesisProposal.id)
        .join(Student, Student.id == SupervisorAssignment.student_id)
        .join(Department, Department.id == Student.department_id)
        .where(ThesisProposal.id.in_(assigned_ids) if assigned_ids else ThesisProposal.id.in_([]))
        .group_by(Department.name)
        .order_by(Department.name)
    ).all()
    by_field = db.execute(
        select(ResearchField.name, func.count(func.distinct(ThesisProposal.id)))
        .select_from(ThesisProposal)
        .join(proposal_fields, proposal_fields.c.proposal_id == ThesisProposal.id)
        .join(ResearchField, ResearchField.id == proposal_fields.c.field_id)
        .where(ThesisProposal.id.in_(assigned_ids) if assigned_ids else ThesisProposal.id.in_([]))
        .group_by(ResearchField.name)
        .order_by(func.count(func.distinct(ThesisProposal.id)).desc())
    ).all()
    by_status = db.execute(select(ThesisProposal.status, func.count()).group_by(ThesisProposal.status)).all()
    return ReportStats(
        avg_completion_days=avg_days,
        completion_rate=rate,
        active_theses=len(assigned_ids),
        overdue_theses=overdue_theses,
        completions_by_month=list(by_month),
        assignment_method=[(k, v) for k, v in method_counts.items() if v > 0],
        theses_by_department=list(by_dept),
        theses_by_field=list(by_field),
        theses_by_status=[(s.value, n) for s, n in by_status],
    )


# ------------------------------------------------------------------------- admin
def admin_dashboard(db: Session) -> AdminDashboard:
    students_total = db.scalar(select(func.count(Student.id))) or 0
    supervisors_total = db.scalar(select(func.count(Supervisor.id))) or 0
    cgpa_verified = db.scalar(select(func.count(Student.id)).where(Student.cgpa_verified.is_(True))) or 0
    by_role = db.execute(select(User.role, func.count()).group_by(User.role)).all()
    by_dept = db.execute(
        select(Department.name, func.sum(Supervisor.current_count), func.sum(Supervisor.capacity))
        .join(Supervisor, Supervisor.department_id == Department.id)
        .group_by(Department.name)
        .order_by(Department.name)
    ).all()
    recent = db.scalars(select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(15)).all()
    actors = {u.id: u.full_name for u in db.scalars(select(User))}
    activity = [
        ActivityItem(
            action=a.action,
            label=a.action.replace(".", " ").replace("_", " "),
            actor_name=actors.get(a.user_id) if a.user_id else None,
            when=a.timestamp,
        )
        for a in recent
    ]
    return AdminDashboard(
        students_total=students_total,
        supervisors_total=supervisors_total,
        cgpa_verified=cgpa_verified,
        users_by_role=[(r.value, n) for r, n in by_role],
        capacity_by_department=[(name, int(used or 0), int(cap or 0)) for name, used, cap in by_dept],
        recent_activity=activity,
    )
