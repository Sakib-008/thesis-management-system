from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.dashboard import (
    AdminDashboard,
    CoordinatorDashboard,
    ReportStats,
    StudentDashboard,
    SupervisorDashboard,
)
from app.services import dashboard_service as svc

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/student", response_model=StudentDashboard)
def student(user: User = Depends(require_roles(UserRole.student)), db: Session = Depends(get_db)):
    return svc.student_dashboard(db, user)


@router.get("/supervisor", response_model=SupervisorDashboard)
def supervisor(user: User = Depends(require_roles(UserRole.supervisor)), db: Session = Depends(get_db)):
    return svc.supervisor_dashboard(db, user)


@router.get("/coordinator", response_model=CoordinatorDashboard)
def coordinator(_: User = Depends(require_roles(UserRole.coordinator)), db: Session = Depends(get_db)):
    return svc.coordinator_dashboard(db)


@router.get("/admin", response_model=AdminDashboard)
def admin(_: User = Depends(require_roles(UserRole.admin)), db: Session = Depends(get_db)):
    return svc.admin_dashboard(db)


@router.get("/coordinator/reports", response_model=ReportStats)
def coordinator_reports(_: User = Depends(require_roles(UserRole.coordinator)), db: Session = Depends(get_db)):
    """Figures for the coordinator's Reports page: completion time, charts by department, field and status."""
    return svc.report_stats(db)
