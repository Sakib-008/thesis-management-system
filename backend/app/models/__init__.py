from app.models.user import User, UserRole  # noqa: F401
from app.models.audit_log import AuditLog  # noqa: F401
from app.models.reference import Department, Program, ResearchField, SupervisorDesignation  # noqa: F401
from app.models.profile import Student, Supervisor  # noqa: F401
from app.models.thesis import (  # noqa: F401
    AssignmentMethod, ProposalReview, ProposalStatus, ProposalVersion, SupervisorAssignment, Thesis,
    ThesisProposal,
)
from app.models.allocation import AssignmentRun, AssignmentRunStatus  # noqa: F401
from app.models.ai import SupervisorRecommendation, SystemSetting, TextEmbedding  # noqa: F401
from app.models.duplicates import ProposalSimilarity  # noqa: F401
from app.models.meetings import Meeting, WeeklyReport  # noqa: F401
