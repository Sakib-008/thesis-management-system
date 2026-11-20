import json
import unittest
import urllib.error
import urllib.request
from datetime import datetime, timezone
from sqlalchemy import func, select

from app.db.session import SessionLocal
from app.models.notification import Notification
from app.models.user import User, UserRole
from app.services import audit, notification_service


class TestNotificationsAndDashboards(unittest.TestCase):
    BASE_URL = "http://localhost:8000"

    def _login(self, email: str, password: str = "Demo@12345") -> str:
        body_bytes = json.dumps({"email": email, "password": password}).encode("utf-8")
        req = urllib.request.Request(f"{self.BASE_URL}/api/v1/auth/login", data=body_bytes, method="POST")
        req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            return body["access_token"]

    def _request(
        self, method: str, path: str, token: str | None = None, data: dict | list | None = None
    ) -> tuple[int, dict | list]:
        body_bytes = json.dumps(data).encode("utf-8") if data is not None else None
        req = urllib.request.Request(f"{self.BASE_URL}{path}", data=body_bytes, method=method)
        if token:
            req.add_header("Authorization", f"Bearer {token}")
        if data is not None:
            req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req) as resp:
                raw = resp.read().decode("utf-8")
                return resp.status, json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8")
            return e.code, json.loads(raw) if raw else {}

    # -------------------------------------------------------------------------
    # Authentication & Access Control
    # -------------------------------------------------------------------------
    def test_unauthenticated_notifications(self):
        """Endpoints under /notifications require a valid Bearer token."""
        code, _ = self._request("GET", "/api/v1/notifications")
        self.assertEqual(code, 401)

        code, _ = self._request("GET", "/api/v1/notifications/unread-count")
        self.assertEqual(code, 401)

        code, _ = self._request("POST", "/api/v1/notifications/read-all")
        self.assertEqual(code, 401)

        code, _ = self._request("POST", "/api/v1/notifications/1/read")
        self.assertEqual(code, 401)

    def test_role_dashboard_access_control(self):
        """Each dashboard endpoint is restricted to its corresponding role."""
        student_token = self._login("rahim.hasan@university.edu")
        supervisor_token = self._login("a.rahman@university.edu")
        coordinator_token = self._login("coordinator@university.edu")
        admin_token = self._login("admin.demo@university.edu")

        # Student endpoint
        code, _ = self._request("GET", "/api/v1/dashboard/student", token=student_token)
        self.assertEqual(code, 200)
        code, _ = self._request("GET", "/api/v1/dashboard/student", token=supervisor_token)
        self.assertEqual(code, 403)
        code, _ = self._request("GET", "/api/v1/dashboard/student", token=coordinator_token)
        self.assertEqual(code, 403)

        # Supervisor endpoint
        code, _ = self._request("GET", "/api/v1/dashboard/supervisor", token=supervisor_token)
        self.assertEqual(code, 200)
        code, _ = self._request("GET", "/api/v1/dashboard/supervisor", token=student_token)
        self.assertEqual(code, 403)

        # Coordinator endpoint
        code, _ = self._request("GET", "/api/v1/dashboard/coordinator", token=coordinator_token)
        self.assertEqual(code, 200)
        code, _ = self._request("GET", "/api/v1/dashboard/coordinator", token=student_token)
        self.assertEqual(code, 403)

        # Coordinator reports endpoint
        code, _ = self._request("GET", "/api/v1/dashboard/coordinator/reports", token=coordinator_token)
        self.assertEqual(code, 200)
        code, _ = self._request("GET", "/api/v1/dashboard/coordinator/reports", token=student_token)
        self.assertEqual(code, 403)

        # Admin endpoint
        code, _ = self._request("GET", "/api/v1/dashboard/admin", token=admin_token)
        self.assertEqual(code, 200)
        code, _ = self._request("GET", "/api/v1/dashboard/admin", token=student_token)
        self.assertEqual(code, 403)

    # -------------------------------------------------------------------------
    # Notification Listing, Read, and Read-All
    # -------------------------------------------------------------------------
    def test_notification_flow(self):
        """Test creating a test notification, fetching, marking read, and marking all read."""
        with SessionLocal() as db:
            student = db.scalar(select(User).where(User.email == "rahim.hasan@university.edu"))
            self.assertIsNotNone(student)
            notification_service.notify(
                db,
                [student.id],
                "test.event",
                "Automated test notification",
                "/student/dashboard",
                actor_id=None,
            )
            db.commit()
            test_notif = db.scalars(
                select(Notification)
                .where(Notification.user_id == student.id, Notification.type == "test.event")
                .order_by(Notification.id.desc())
            ).first()
            self.assertIsNotNone(test_notif)
            notif_id = test_notif.id

        student_token = self._login("rahim.hasan@university.edu")

        # 1. Check unread count is at least 1
        code, unread_resp = self._request("GET", "/api/v1/notifications/unread-count", token=student_token)
        self.assertEqual(code, 200)
        self.assertGreaterEqual(unread_resp["unread"], 1)

        # 2. Check listing notifications returns the item
        code, notifs = self._request("GET", "/api/v1/notifications", token=student_token)
        self.assertEqual(code, 200)
        self.assertIsInstance(notifs, list)
        matching = [n for n in notifs if n["id"] == notif_id]
        self.assertEqual(len(matching), 1)
        self.assertFalse(matching[0]["read"])

        # 3. Mark single notification as read
        code, read_resp = self._request("POST", f"/api/v1/notifications/{notif_id}/read", token=student_token)
        self.assertEqual(code, 200)
        self.assertTrue(read_resp.get("ok"))

        # Verify it is now read
        code, notifs_after = self._request("GET", "/api/v1/notifications", token=student_token)
        matching_after = [n for n in notifs_after if n["id"] == notif_id]
        self.assertTrue(matching_after[0]["read"])

        # 4. Mark all as read
        code, read_all_resp = self._request("POST", "/api/v1/notifications/read-all", token=student_token)
        self.assertEqual(code, 200)
        self.assertIn("marked", read_all_resp)

        # After mark-all, unread count must be 0
        code, final_unread = self._request("GET", "/api/v1/notifications/unread-count", token=student_token)
        self.assertEqual(code, 200)
        self.assertEqual(final_unread["unread"], 0)

    def test_cannot_mark_other_user_notification(self):
        """A user cannot mark another user's notification as read."""
        with SessionLocal() as db:
            supervisor = db.scalar(select(User).where(User.email == "a.rahman@university.edu"))
            notification_service.notify(
                db,
                [supervisor.id],
                "test.isolated",
                "Supervisor private notification",
                "/supervisor/dashboard",
            )
            db.commit()
            notif = db.scalars(
                select(Notification)
                .where(Notification.user_id == supervisor.id, Notification.type == "test.isolated")
                .order_by(Notification.id.desc())
            ).first()
            self.assertIsNotNone(notif)
            supervisor_notif_id = notif.id

        student_token = self._login("rahim.hasan@university.edu")
        # Student tries to mark supervisor's notification
        code, res = self._request("POST", f"/api/v1/notifications/{supervisor_notif_id}/read", token=student_token)
        self.assertEqual(code, 404)

    # -------------------------------------------------------------------------
    # Audit Event Dispatching
    # -------------------------------------------------------------------------
    def test_audit_event_dispatching(self):
        """log_audit dispatches notifications according to the event matrix."""
        with SessionLocal() as db:
            student = db.scalar(select(User).where(User.email == "rahim.hasan@university.edu"))
            coordinator = db.scalar(select(User).where(User.email == "coordinator@university.edu"))

            # Dispatch an event where student submits a proposal (concerns coordinator)
            audit.log_audit(
                db,
                user_id=student.id,
                action="proposal.submit",
                entity="proposal",
                entity_id=1,
                meta={"title": "Test Dispatch Title"},
            )
            db.commit()

            # Verify coordinator received a notification
            notif = db.scalars(
                select(Notification)
                .where(
                    Notification.user_id == coordinator.id,
                    Notification.type == "proposal.submit",
                )
                .order_by(Notification.id.desc())
            ).first()
            self.assertIsNotNone(notif)
            payload = notif.payload or {}
            self.assertIn("submitted a proposal for review", payload.get("text", ""))

    # -------------------------------------------------------------------------
    # Reminder Deduplication
    # -------------------------------------------------------------------------
    def test_reminder_deduplication(self):
        """Reminders using key must not produce duplicate notifications."""
        with SessionLocal() as db:
            student = db.scalar(select(User).where(User.email == "rahim.hasan@university.edu"))
            # Call refresh_reminders twice
            notification_service.refresh_reminders(db, student, force=True)
            db.commit()

            count_first = db.scalar(
                select(func.count(Notification.id)).where(Notification.user_id == student.id)
            )

            # Second run with force=True must not duplicate existing keyed reminders
            notification_service.refresh_reminders(db, student, force=True)
            db.commit()

            count_second = db.scalar(
                select(func.count(Notification.id)).where(Notification.user_id == student.id)
            )
            self.assertEqual(count_first, count_second)

    # -------------------------------------------------------------------------
    # Dashboard Data Content Tests
    # -------------------------------------------------------------------------
    def test_student_dashboard_schema(self):
        token = self._login("rahim.hasan@university.edu")
        code, data = self._request("GET", "/api/v1/dashboard/student", token=token)
        self.assertEqual(code, 200)
        expected_keys = {
            "has_thesis",
            "thesis_title",
            "supervisor_name",
            "milestones_total",
            "milestones_completed",
            "progress_percent",
            "next_deadline",
            "next_deadline_label",
            "upcoming_meeting",
            "open_feedback",
            "overdue_reports",
            "result_published",
        }
        self.assertTrue(expected_keys.issubset(set(data.keys())))
        self.assertIsInstance(data["has_thesis"], bool)
        self.assertIsInstance(data["progress_percent"], int)

    def test_supervisor_dashboard_schema(self):
        token = self._login("a.rahman@university.edu")
        code, data = self._request("GET", "/api/v1/dashboard/supervisor", token=token)
        self.assertEqual(code, 200)
        expected_keys = {
            "students_count",
            "capacity",
            "pending_reviews",
            "upcoming_meetings",
            "overdue_milestones",
            "waiting_reports",
        }
        self.assertTrue(expected_keys.issubset(set(data.keys())))
        self.assertIsInstance(data["students_count"], int)
        self.assertIsInstance(data["capacity"], int)

    def test_coordinator_dashboard_schema(self):
        token = self._login("coordinator@university.edu")
        code, data = self._request("GET", "/api/v1/dashboard/coordinator", token=token)
        self.assertEqual(code, 200)
        expected_keys = {
            "students_total",
            "cgpa_pending",
            "supervisors_total",
            "open_slots",
            "proposals_pending",
            "awaiting_assignment",
            "active_theses",
            "overdue_theses",
            "proposals_by_field",
            "completions_by_month",
            "workload_by_supervisor",
        }
        self.assertTrue(expected_keys.issubset(set(data.keys())))
        self.assertIsInstance(data["students_total"], int)
        self.assertIsInstance(data["proposals_by_field"], list)
        self.assertIsInstance(data["workload_by_supervisor"], list)

    def test_coordinator_reports_schema(self):
        token = self._login("coordinator@university.edu")
        code, data = self._request("GET", "/api/v1/dashboard/coordinator/reports", token=token)
        self.assertEqual(code, 200)
        expected_keys = {
            "avg_completion_days",
            "completion_rate",
            "active_theses",
            "overdue_theses",
            "completions_by_month",
            "assignment_method",
            "theses_by_department",
            "theses_by_field",
            "theses_by_status",
        }
        self.assertTrue(expected_keys.issubset(set(data.keys())))
        self.assertIsInstance(data["completion_rate"], int)
        self.assertIsInstance(data["theses_by_status"], list)

    def test_admin_dashboard_schema(self):
        token = self._login("admin.demo@university.edu")
        code, data = self._request("GET", "/api/v1/dashboard/admin", token=token)
        self.assertEqual(code, 200)
        expected_keys = {
            "students_total",
            "supervisors_total",
            "cgpa_verified",
            "users_by_role",
            "capacity_by_department",
            "recent_activity",
        }
        self.assertTrue(expected_keys.issubset(set(data.keys())))
        self.assertIsInstance(data["students_total"], int)
        self.assertIsInstance(data["recent_activity"], list)
