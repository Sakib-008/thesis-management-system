"""Phase 16 security tests: no token, bad tokens, role violations, other people's data, bad files, bad input."""
import base64
import json
import unittest

from sqlalchemy import delete

from app.db.session import SessionLocal
from app.models.supervision import Document
from tests import helpers as h

TEST_TITLES = ("Security test", "<img src=x onerror=alert(1)>")


def remove_test_documents() -> None:
    """The uploads these tests make are removed again, so the demo data stays clean."""
    with SessionLocal() as db:
        db.execute(delete(Document).where(Document.title.in_(TEST_TITLES)))
        db.commit()

# (method, path, body, roles that ARE allowed). Everyone else must get 403. The ids need not exist,
# because the role check runs before any lookup.
ROLE_RULES = [
    ("GET", "/api/v1/users", None, {"admin"}),
    ("POST", "/api/v1/users", {}, {"admin"}),  # {} is invalid on purpose: allowed roles get 422, nothing is created
    ("GET", "/api/v1/audit-logs", None, {"admin"}),
    ("GET", "/api/v1/dashboard/admin", None, {"admin"}),
    ("GET", "/api/v1/dashboard/student", None, {"student"}),
    ("GET", "/api/v1/dashboard/supervisor", None, {"supervisor"}),
    ("GET", "/api/v1/dashboard/coordinator", None, {"coordinator"}),
    ("PUT", "/api/v1/evaluation/criteria", {}, {"admin"}),
    ("PUT", "/api/v1/evaluation/grading", {}, {"admin"}),
    ("GET", "/api/v1/evaluation/my-result", None, {"student"}),
    ("POST", "/api/v1/evaluation/theses/1/publish", None, {"coordinator"}),
    ("PUT", "/api/v1/evaluation/theses/1/mine", {}, {"supervisor", "coordinator"}),
    ("POST", "/api/v1/allocation/runs", {}, {"admin", "coordinator"}),
    ("PUT", "/api/v1/settings/recommendation", {}, {"admin"}),
    ("PUT", "/api/v1/settings/duplicate", {}, {"admin"}),
    ("POST", "/api/v1/meetings/schedule", {}, {"supervisor"}),
    ("POST", "/api/v1/meetings", {}, {"student"}),
    ("POST", "/api/v1/proposals/1/review", {}, {"coordinator", "admin"}),
    ("POST", "/api/v1/proposals/me/submit", None, {"student"}),
    ("POST", "/api/v1/departments", {}, {"admin"}),
    ("POST", "/api/v1/research-fields", {}, {"admin", "coordinator"}),
]
# These really do something when an allowed role sends them, so only the roles that must be refused are tried.
REFUSAL_ONLY = {"/api/v1/allocation/runs", "/api/v1/evaluation/theses/1/publish"}
# For an allowed role the same request may fail for another reason (404, 409, 422), but never with these:
DENIED = {401, 403}
ROLES = {"admin": h.ADMIN, "coordinator": h.COORDINATOR, "supervisor": h.SUPERVISOR, "student": h.STUDENT}


class TestAuthentication(unittest.TestCase):
    def test_every_rule_rejects_a_visitor_without_a_token(self):
        for method, path, body, _ in ROLE_RULES:
            code, _ = h.request(method, path, data=body)
            self.assertEqual(code, 401, f"{method} {path}")

    def test_bad_tokens_are_rejected(self):
        good = h.login(h.STUDENT)
        header, payload, signature = good.split(".")
        forged = json.loads(base64.urlsafe_b64decode(payload + "=="))
        forged["sub"] = "1"
        fake_payload = base64.urlsafe_b64encode(json.dumps(forged).encode()).decode().rstrip("=")
        none_alg = base64.urlsafe_b64encode(b'{"alg":"none","typ":"JWT"}').decode().rstrip("=")
        for label, token in {
            "garbage": "not-a-token",
            "empty": "",
            "tampered payload": f"{header}.{fake_payload}.{signature}",
            "alg none": f"{none_alg}.{fake_payload}.",
            "truncated": good[:-6],
        }.items():
            code, _ = h.request("GET", "/api/v1/auth/me", token=token or None)
            self.assertEqual(code, 401, label)

    def test_wrong_password_and_unknown_user_look_the_same(self):
        a = h.request("POST", "/api/v1/auth/login", data={"email": h.STUDENT, "password": "wrong-password"})
        b = h.request("POST", "/api/v1/auth/login", data={"email": "nobody@university.edu", "password": "wrong"})
        self.assertEqual(a[0], 401)
        self.assertEqual(a, b)  # same status and same message: the API does not reveal which emails exist

    def test_injection_text_is_just_text(self):
        for email in ("' OR '1'='1", "admin@x.com'; DROP TABLE users;--", "<script>alert(1)</script>"):
            code, _ = h.request("POST", "/api/v1/auth/login", data={"email": email, "password": "' OR '1'='1"})
            self.assertIn(code, (401, 422), email)
        self.assertEqual(h.request("GET", "/api/v1/auth/me", token=h.login(h.STUDENT))[0], 200)  # tables still there

    def test_register_cannot_create_staff(self):
        code, _ = h.request("POST", "/api/v1/auth/register", data={
            "email": "sneaky.admin@university.edu", "full_name": "Sneaky Admin", "password": "Abcdef12!",
            "role": "admin"})
        self.assertIn(code, (403, 422))
        self.assertEqual(h.request("POST", "/api/v1/auth/login",
                                   data={"email": "sneaky.admin@university.edu", "password": "Abcdef12!"})[0], 401)

    def test_responses_never_contain_password_hashes(self):
        for role, email in ROLES.items():
            _, me = h.request("GET", "/api/v1/auth/me", token=h.login(email))
            self.assertFalse({"password", "hashed_password", "password_hash"} & set(me), role)
        _, users = h.request("GET", "/api/v1/users", token=h.login(h.ADMIN))
        self.assertNotIn("hashed_password", json.dumps(users))


class TestRoleViolations(unittest.TestCase):
    def test_role_matrix(self):
        checked = 0
        for method, path, body, allowed in ROLE_RULES:
            for role, email in ROLES.items():
                code, _ = h.request(method, path, token=h.login(email), data=body)
                if role in allowed:
                    if path in REFUSAL_ONLY:
                        continue
                    self.assertNotIn(code, DENIED, f"{role} should reach {method} {path}, got {code}")
                else:
                    self.assertEqual(code, 403, f"{role} must be refused on {method} {path}, got {code}")
                checked += 1
        self.assertGreater(checked, 60)

    def test_student_cannot_change_own_role_or_status(self):
        token = h.login(h.STUDENT)
        _, me = h.request("GET", "/api/v1/auth/me", token=token)
        code, _ = h.request("PATCH", f"/api/v1/users/{me['id']}", token=token, data={"role": "admin"})
        self.assertEqual(code, 403)
        self.assertEqual(h.request("GET", "/api/v1/auth/me", token=token)[1]["role"], "student")


class TestOtherPeoplesData(unittest.TestCase):
    """A student sees only their own thesis, a supervisor only their own students."""

    def test_student_cannot_read_a_classmates_thesis_data(self):
        zarin = h.login(h.OTHER_STUDENT)
        _, mine = h.request("GET", "/api/v1/proposals/me", token=h.login(h.STUDENT))
        code, _ = h.request("GET", f"/api/v1/proposals/{mine['id']}", token=zarin)
        self.assertIn(code, (403, 404))
        code, _ = h.request("GET", f"/api/v1/proposals/{mine['id']}/recommendations", token=zarin)
        self.assertIn(code, (403, 404))
        code, rows = h.request("GET", "/api/v1/documents", token=zarin)
        self.assertEqual(code, 200)
        _, theirs = h.request("GET", "/api/v1/documents", token=h.login(h.STUDENT))
        self.assertFalse({d["id"] for d in rows} & {d["id"] for d in theirs})
        code, rows = h.request("GET", "/api/v1/meetings", token=zarin)
        _, theirs = h.request("GET", "/api/v1/meetings", token=h.login(h.STUDENT))
        self.assertFalse({m["id"] for m in rows} & {m["id"] for m in theirs})

    def test_student_cannot_open_the_evaluation_of_a_thesis(self):
        for path in ("/api/v1/evaluation/theses", "/api/v1/evaluation/theses/1"):
            self.assertEqual(h.request("GET", path, token=h.login(h.STUDENT))[0], 403)

    def test_unrelated_supervisor_cannot_see_the_students_meetings(self):
        _, rows = h.request("GET", "/api/v1/meetings", token=h.login(h.SUPERVISOR))
        _, other = h.request("GET", "/api/v1/meetings", token=h.login(h.OTHER_SUPERVISOR))
        self.assertFalse({m["id"] for m in rows} & {m["id"] for m in other})
        if rows:
            code, _ = h.request("GET", f"/api/v1/meetings/{rows[0]['id']}", token=h.login(h.OTHER_SUPERVISOR))
            self.assertIn(code, (403, 404))

    def test_unpublished_marks_are_hidden_from_the_student(self):
        code, result = h.request("GET", "/api/v1/evaluation/my-result", token=h.login(h.OTHER_STUDENT))
        self.assertEqual(code, 200)
        if not result["published"]:
            self.assertIsNone(result["total"])
            self.assertEqual(result["criteria"], [])


class TestFileUploads(unittest.TestCase):
    PDF = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"

    @classmethod
    def tearDownClass(cls):
        remove_test_documents()

    def setUp(self):
        self.token = h.login(h.STUDENT)

    def _doc(self, name: str, content: bytes, ctype: str = "application/octet-stream", token=None):
        return h.upload("/api/v1/documents", token or self.token, {"title": "Security test", "type": "other"},
                        name, content, ctype)

    def test_a_real_pdf_is_accepted(self):
        code, doc = self._doc("report.pdf", self.PDF, "application/pdf")
        self.assertEqual(code, 200, doc)
        self.assertEqual(doc["latest"]["original_name"], "report.pdf")

    def test_dangerous_types_are_refused(self):
        for name, content in {
            "run.exe": b"MZ\x90\x00" + b"\x00" * 50,
            "shell.sh": b"#!/bin/sh\nrm -rf /\n",
            "page.html": b"<html><script>alert(1)</script></html>",
            "app.py": b"import os\n",
            "image.svg": b"<svg onload='alert(1)'></svg>",
            "noext": b"hello",
            "double.pdf.exe": b"MZ\x90\x00",
        }.items():
            code, body = self._doc(name, content)
            self.assertEqual(code, 400, f"{name}: {body}")

    def test_content_must_match_the_extension(self):
        self.assertEqual(self._doc("fake.pdf", b"this is not a pdf at all")[0], 400)
        self.assertEqual(self._doc("fake.png", self.PDF)[0], 400)
        self.assertEqual(self._doc("fake.docx", b"plain text pretending to be word")[0], 400)
        self.assertEqual(self._doc("binary.txt", b"abc\x00\x01\x02")[0], 400)

    def test_empty_and_oversized_files_are_refused(self):
        self.assertEqual(self._doc("empty.pdf", b"")[0], 400)
        big = b"%PDF-" + b"0" * (21 * 1024 * 1024)  # the limit is 20 MB
        code, body = self._doc("big.pdf", big, "application/pdf")
        self.assertIn(code, (400, 413), body)

    def test_a_hostile_file_name_cannot_escape_the_upload_folder(self):
        code, doc = self._doc("../../../../etc/passwd.pdf", self.PDF, "application/pdf")
        self.assertEqual(code, 200)
        stored = doc["latest"]["original_name"]
        self.assertNotIn("/", stored)
        self.assertNotIn("..", stored.replace("..pdf", ""))

    def test_downloads_are_attachments_not_web_pages(self):
        _, doc = self._doc("safe.pdf", self.PDF, "application/pdf")
        code, raw = h.request("GET", f"/api/v1/documents/{doc['id']}/versions/1/download", token=self.token)
        self.assertEqual(code, 200)
        self.assertEqual(raw, self.PDF)

    def test_only_the_owner_can_download(self):
        _, doc = self._doc("private.pdf", self.PDF, "application/pdf")
        url = f"/api/v1/documents/{doc['id']}/versions/1/download"
        self.assertEqual(h.request("GET", url)[0], 401)
        self.assertIn(h.request("GET", url, token=h.login(h.OTHER_STUDENT))[0], (403, 404))
        self.assertIn(h.request("GET", url, token=h.login(h.OTHER_SUPERVISOR))[0], (403, 404))

    def test_a_visitor_cannot_upload(self):
        self.assertEqual(self._doc("a.pdf", self.PDF, token="bad")[0], 401)
        code, _ = h.upload("/api/v1/documents", h.login(h.COORDINATOR), {"title": "x"}, "a.pdf", self.PDF,
                           "application/pdf")
        self.assertEqual(code, 403)


class TestInputValidation(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        remove_test_documents()

    def test_bad_json_and_types_give_422_not_500(self):
        token = h.login(h.SUPERVISOR)
        for body in ({}, {"thesis_id": "abc"}, {"thesis_id": 1, "meeting_date": "yesterday-ish", "agenda": "abc"},
                     {"thesis_id": 1, "meeting_date": "2031-01-01T10:00:00Z", "agenda": "a" * 5000}):
            code, _ = h.request("POST", "/api/v1/meetings/schedule", token=token, data=body)
            self.assertEqual(code, 422, body)

    def test_huge_numbers_and_ids_do_not_crash(self):
        token = h.login(h.COORDINATOR)
        for path in ("/api/v1/proposals/99999999999999999999", "/api/v1/meetings/-1", "/api/v1/evaluation/theses/0"):
            code, _ = h.request("GET", path, token=token)
            self.assertIn(code, (404, 422), path)

    def test_xss_text_is_stored_as_text(self):
        token = h.login(h.STUDENT)
        title = "<img src=x onerror=alert(1)>"
        code, doc = h.upload("/api/v1/documents", token, {"title": title, "type": "other"}, "n.txt", b"hello",
                             "text/plain")
        self.assertEqual(code, 200)
        self.assertEqual(doc["title"], title)  # kept as text, never executed: the Next.js app escapes it when shown


if __name__ == "__main__":
    unittest.main()
