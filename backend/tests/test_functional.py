"""Phase 16 functional tests: every module answers for the roles that use it, and the pieces connect.
The deep workflow tests live in test_allocation, test_evaluation, test_notifications_dashboards and
test_meeting_schedule. This file checks that nothing is broken across the whole system."""
import unittest

from tests import helpers as h

# role -> [(path, what the JSON must be)] for the screens each role opens
SCREENS = {
    h.STUDENT: [
        ("/api/v1/auth/me", dict), ("/api/v1/dashboard/student", dict), ("/api/v1/proposals/me", dict),
        ("/api/v1/students/me", dict), ("/api/v1/meetings", list),
        ("/api/v1/milestones", list), ("/api/v1/documents", list), ("/api/v1/notifications", list),
        ("/api/v1/notifications/unread-count", dict), ("/api/v1/evaluation/my-result", dict),
        ("/api/v1/research-fields", list), ("/api/v1/departments", list), ("/api/v1/programs", list),
    ],
    h.SUPERVISOR: [
        ("/api/v1/dashboard/supervisor", dict), ("/api/v1/supervisors/me", dict), ("/api/v1/meetings", list),
        ("/api/v1/milestones/progress", list), ("/api/v1/reports", list), ("/api/v1/documents", list),
        ("/api/v1/evaluation/theses", list), ("/api/v1/notifications", list), ("/api/v1/submissions", list),
    ],
    h.COORDINATOR: [
        ("/api/v1/dashboard/coordinator", dict), ("/api/v1/dashboard/coordinator/reports", dict),
        ("/api/v1/proposals", list), ("/api/v1/students", list), ("/api/v1/supervisors", list),
        ("/api/v1/allocation/readiness", dict), ("/api/v1/allocation/runs", list), ("/api/v1/assignments", list),
        ("/api/v1/assignments/waiting", list), ("/api/v1/duplicates/pending", list),
        ("/api/v1/evaluation/theses", list), ("/api/v1/evaluation/criteria", dict),
        ("/api/v1/reports/overview", list), ("/api/v1/notifications", list),
    ],
    h.ADMIN: [
        ("/api/v1/dashboard/admin", dict), ("/api/v1/users", list), ("/api/v1/audit-logs", list),
        ("/api/v1/settings/recommendation", dict), ("/api/v1/settings/duplicate", dict),
        ("/api/v1/settings/reports", dict), ("/api/v1/evaluation/criteria", dict),
        ("/api/v1/evaluation/grading", dict),
        ("/api/v1/supervisor-designations", list), ("/api/v1/departments", list),
    ],
}


class TestEveryScreenLoads(unittest.TestCase):
    def test_screens_per_role(self):
        for email, screens in SCREENS.items():
            token = h.login(email)
            for path, kind in screens:
                code, body = h.request("GET", path, token=token)
                self.assertEqual(code, 200, f"{email} {path} -> {code} {body}")
                self.assertIsInstance(body, kind, f"{email} {path}")

    def test_health(self):
        code, body = h.request("GET", "/api/v1/health")
        self.assertEqual((code, body["status"], body["database"]), (200, "ok", "connected"))

    def test_login_returns_the_right_role(self):
        for email, role in ((h.STUDENT, "student"), (h.SUPERVISOR, "supervisor"), (h.COORDINATOR, "coordinator"),
                            (h.ADMIN, "admin")):
            _, me = h.request("GET", "/api/v1/auth/me", token=h.login(email))
            self.assertEqual((me["email"], me["role"]), (email, role))


class TestModulesConnect(unittest.TestCase):
    def test_supervisor_and_student_see_the_same_thesis(self):
        sup = h.login(h.SUPERVISOR)
        _, rows = h.request("GET", "/api/v1/milestones/progress", token=sup)
        self.assertTrue(rows, "the supervisor has no students; run the demo seed scripts")
        _, proposal = h.request("GET", "/api/v1/proposals/me", token=h.login(h.STUDENT))
        self.assertIn(proposal["thesis_id"], [r["thesis_id"] for r in rows])

    def test_a_published_result_matches_the_evaluations(self):
        coord = h.login(h.COORDINATOR)
        _, theses = h.request("GET", "/api/v1/evaluation/theses", token=coord)
        for row in theses:
            if not row["published"]:
                continue
            _, detail = h.request("GET", f"/api/v1/evaluation/theses/{row['thesis_id']}", token=coord)
            result = detail["result"]
            self.assertAlmostEqual(sum(c["average"] for c in result["criteria"]), result["total"], places=1)
            self.assertAlmostEqual(sum(g["marks"] for g in result["groups"]), result["total"], places=1)
            self.assertLessEqual(result["total"], 100)

    def test_marking_sheet_adds_up_to_100(self):
        _, sheet = h.request("GET", "/api/v1/evaluation/criteria", token=h.login(h.ADMIN))
        self.assertTrue(sheet["valid"])
        self.assertEqual(sheet["active_total"], 100)

    def test_notifications_can_be_read(self):
        token = h.login(h.STUDENT)
        _, before = h.request("GET", "/api/v1/notifications/unread-count", token=token)
        code, _ = h.request("POST", "/api/v1/notifications/read-all", token=token)
        self.assertEqual(code, 200)
        _, after = h.request("GET", "/api/v1/notifications/unread-count", token=token)
        self.assertEqual(after["unread"], 0)
        self.assertGreaterEqual(before["unread"], 0)

    def test_audit_log_records_actions(self):
        _, logs = h.request("GET", "/api/v1/audit-logs", token=h.login(h.ADMIN))
        self.assertTrue(logs)
        self.assertTrue({"action", "entity", "timestamp", "user"} <= set(logs[0]))

    def test_pdf_reports_download(self):
        sup = h.login(h.SUPERVISOR)
        _, reports = h.request("GET", "/api/v1/reports", token=sup)
        signed = [r for r in reports if r.get("status") == "signed"]
        if not signed:
            self.skipTest("no signed weekly report in the demo data")
        code, raw = h.request("GET", f"/api/v1/reports/{signed[0]['id']}/pdf", token=sup)
        self.assertEqual(code, 200)
        self.assertTrue(raw.startswith(b"%PDF-"))


if __name__ == "__main__":
    unittest.main()
