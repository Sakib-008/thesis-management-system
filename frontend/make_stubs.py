# make_stubs.py — run from the frontend/ folder
import os, json

# (route, page title, role label, phase it will be built in)
routes = [
    ("login", "Login", "Public", 2),
    ("register", "Register", "Public", 2),
    # student
    ("student/dashboard", "Student Dashboard", "Student", 9),
    ("student/profile", "My Profile", "Student", 3),
    ("student/proposal/new", "New Thesis Proposal", "Student", 4),
    ("student/proposal/[id]", "Proposal Details", "Student", 4),
    ("student/proposal/[id]/recommendations", "AI Supervisor Recommendations (read-only)", "Student", 5),
    ("student/thesis", "My Thesis & Supervisor", "Student", 6),
    ("student/milestones", "Milestones", "Student", 7),
    ("student/milestones/[id]/submit", "Submit Milestone Work", "Student", 7),
    ("student/documents", "Documents", "Student", 7),
    ("student/meetings", "Meetings", "Student", 7),
    ("student/feedback", "Feedback", "Student", 7),
    ("student/evaluation", "Evaluation Result", "Student", 8),
    # supervisor
    ("supervisor/dashboard", "Supervisor Dashboard", "Supervisor", 9),
    ("supervisor/profile", "Research Profile", "Supervisor", 3),
    ("supervisor/proposals", "Proposals", "Supervisor", 4),
    ("supervisor/students", "My Students", "Supervisor", 7),
    ("supervisor/milestones", "Manage Milestones", "Supervisor", 7),
    ("supervisor/submissions/[id]/review", "Review Submission", "Supervisor", 7),
    ("supervisor/meetings", "Meetings", "Supervisor", 7),
    ("supervisor/evaluations", "Evaluations", "Supervisor", 8),
    # coordinator
    ("coordinator/dashboard", "Coordinator Dashboard", "Coordinator", 9),
    ("coordinator/proposals", "Proposal Review Queue", "Coordinator", 4),
    ("coordinator/assignment-runs", "Assignment Runs", "Coordinator", 6),
    ("coordinator/assignments", "Assignments & Overrides", "Coordinator", 6),
    ("coordinator/research-fields", "Research Fields", "Coordinator", 3),
    ("coordinator/workload", "Supervisor Workload", "Coordinator", 9),
    ("coordinator/reports", "Reports", "Coordinator", 9),
    # admin
    ("admin/users", "Users & Roles", "Admin", 2),
    ("admin/departments", "Departments", "Admin", 3),
    ("admin/programs", "Programs", "Admin", 3),
    ("admin/supervisor-designations", "Supervisor Designations", "Admin", 3),
    ("admin/settings", "System Settings", "Admin", 5),
    ("admin/audit-logs", "Audit Logs", "Admin", 9),
]

for route, title, role, phase in routes:
    folder = os.path.join("app", route)
    os.makedirs(folder, exist_ok=True)
    with open(os.path.join(folder, "page.tsx"), "w") as f:
        f.write(
            'import StubPage from "@/components/ui/StubPage";\n\n'
            "export default function Page() {\n"
            f"  return <StubPage title={json.dumps(title)} role={json.dumps(role)} phase={{{phase}}} />;\n"
            "}\n"
        )

print(len(routes), "stubs created")