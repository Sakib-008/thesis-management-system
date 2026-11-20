from datetime import datetime
from pydantic import BaseModel


class ActivityItem(BaseModel):
    action: str
    label: str
    actor_name: str | None
    when: datetime


class StudentDashboard(BaseModel):
    has_thesis: bool
    thesis_title: str | None
    supervisor_name: str | None
    milestones_total: int
    milestones_completed: int
    progress_percent: int
    next_deadline: datetime | None
    next_deadline_label: str | None
    upcoming_meeting: datetime | None
    open_feedback: int
    overdue_reports: int
    result_published: bool


class SupervisorDashboard(BaseModel):
    students_count: int
    capacity: int
    pending_reviews: int
    upcoming_meetings: int
    overdue_milestones: int
    waiting_reports: int


class CoordinatorDashboard(BaseModel):
    students_total: int
    cgpa_pending: int
    supervisors_total: int
    open_slots: int
    proposals_pending: int
    awaiting_assignment: int
    active_theses: int
    overdue_theses: int
    proposals_by_field: list[tuple[str, int]]
    completions_by_month: list[tuple[str, int]]
    workload_by_supervisor: list[tuple[str, int, int]]  # name, current, capacity


class ReportStats(BaseModel):
    avg_completion_days: int | None  # average days from assignment to a published result
    completion_rate: int  # percent of assigned theses with a published result
    active_theses: int
    overdue_theses: int
    completions_by_month: list[tuple[str, int]]  # published results, by month
    assignment_method: list[tuple[str, int]]  # "Allocation run" / "Manual", and the count
    theses_by_department: list[tuple[str, int]]
    theses_by_field: list[tuple[str, int]]
    theses_by_status: list[tuple[str, int]]


class AdminDashboard(BaseModel):
    students_total: int
    supervisors_total: int
    cgpa_verified: int
    users_by_role: list[tuple[str, int]]
    capacity_by_department: list[tuple[str, int, int]]
    recent_activity: list[ActivityItem]
