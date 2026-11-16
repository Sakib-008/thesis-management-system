import json
import unittest
import urllib.error
import urllib.request

from app.db.session import SessionLocal
from app.models.evaluation import Evaluation, ThesisResult
from app.models.user import UserRole
from app.scripts import seed_evaluation_demo
from sqlalchemy import select


class TestThesisEvaluation(unittest.TestCase):
    BASE_URL = "http://localhost:8000"

    def setUp(self):
        # Reset back to standard demo state: Dr. Rahman final (76), coordinator draft
        with SessionLocal() as db:
            res = db.scalar(select(ThesisResult).where(ThesisResult.thesis_id == 1))
            if res:
                db.delete(res)
            for ev in db.scalars(select(Evaluation).where(Evaluation.thesis_id == 1)):
                db.delete(ev)
            db.commit()
        seed_evaluation_demo.main()

    def _login(self, email: str, password: str = "Demo@12345") -> str:
        body_bytes = json.dumps({"email": email, "password": password}).encode("utf-8")
        req = urllib.request.Request(f"{self.BASE_URL}/api/v1/auth/login", data=body_bytes, method="POST")
        req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            return body["access_token"]

    def _request(self, method: str, path: str, token: str | None = None, data: dict | list | None = None) -> tuple[int, dict]:
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

    def test_security_rules(self):
        student_token = self._login("rahim.hasan@university.edu")
        non_supervisor_token = self._login("s.chowdhury@university.edu")
        coord_token = self._login("coordinator@university.edu")
        supervisor_token = self._login("a.rahman@university.edu")

        # 1. Student GET /api/v1/evaluation/theses -> 403 Forbidden
        code, _ = self._request("GET", "/api/v1/evaluation/theses", token=student_token)
        self.assertEqual(code, 403)

        # 2. Supervisor who is not Rahim's -> 404 Not Found
        code, _ = self._request("GET", "/api/v1/evaluation/theses/1", token=non_supervisor_token)
        self.assertEqual(code, 404)

        # 3. Coordinator PUT /api/v1/evaluation/criteria -> 403 Forbidden (only admin)
        code, _ = self._request("PUT", "/api/v1/evaluation/criteria", token=coord_token, data={"criteria": []})
        self.assertEqual(code, 403)

        # 4. Supervisor POST /evaluation/theses/1/publish -> 403 Forbidden (only coordinator)
        code, _ = self._request("POST", "/api/v1/evaluation/theses/1/publish", token=supervisor_token)
        self.assertEqual(code, 403)

        # 5. Student GET /api/v1/evaluation/my-result -> 200, published: false initially (or matching current state)
        code, res = self._request("GET", "/api/v1/evaluation/my-result", token=student_token)
        self.assertEqual(code, 200)
        self.assertIn("published", res)

    def test_criteria_and_grading_validation(self):
        admin_token = self._login("admin.demo@university.edu")

        # Get existing criteria
        code, crit_data = self._request("GET", "/api/v1/evaluation/criteria", token=admin_token)
        self.assertEqual(code, 200)
        self.assertTrue(crit_data["valid"])

        # Change weight so total != 100 -> 400
        invalid_criteria = [dict(c) for c in crit_data["criteria"]]
        invalid_criteria[0]["weight"] = 50.0  # changes sum
        code, body = self._request("PUT", "/api/v1/evaluation/criteria", token=admin_token, data={"criteria": invalid_criteria})
        self.assertEqual(code, 400)
        self.assertIn("must add up to 100", body.get("detail", ""))

        # Grading scale validation: remove 0 band
        code, grading_data = self._request("GET", "/api/v1/evaluation/grading", token=admin_token)
        self.assertEqual(code, 200)
        no_zero_bands = [b for b in grading_data["bands"] if b["min"] != 0]
        code, body = self._request("PUT", "/api/v1/evaluation/grading", token=admin_token, data={"bands": no_zero_bands})
        self.assertEqual(code, 422)  # Pydantic validation error

    def test_evaluation_workflow_submit_publish_reopen(self):
        coord_token = self._login("coordinator@university.edu")
        rahim_token = self._login("rahim.hasan@university.edu")
        supervisor_token = self._login("a.rahman@university.edu")

        # Detail view for coordinator
        code, detail = self._request("GET", "/api/v1/evaluation/theses/1", token=coord_token)
        self.assertEqual(code, 200)
        self.assertEqual(detail["mine"]["status"], "draft")

        # Incomplete submit should return 400
        code, err = self._request("POST", "/api/v1/evaluation/theses/1/mine/submit", token=coord_token)
        self.assertEqual(code, 400)
        self.assertIn("Give a score for every criterion", err.get("detail", ""))

        # Coordinator completes all scores and saves
        criteria = detail["criteria"]
        full_scores = [{"criterion_id": c["id"], "score": 85.0} for c in criteria]
        code, saved = self._request("PUT", "/api/v1/evaluation/theses/1/mine", token=coord_token, data={"scores": full_scores, "comment": "Great defense."})
        self.assertEqual(code, 200)

        # Coordinator submits evaluation
        code, submitted = self._request("POST", "/api/v1/evaluation/theses/1/mine/submit", token=coord_token)
        self.assertEqual(code, 200)
        self.assertEqual(submitted["mine"]["status"], "final")
        self.assertTrue(submitted["can_publish"])

        # Coordinator publishes
        code, published_detail = self._request("POST", "/api/v1/evaluation/theses/1/publish", token=coord_token)
        self.assertEqual(code, 200)
        self.assertTrue(published_detail["result"]["published"])
        self.assertEqual(published_detail["result"]["evaluators_count"], 2)

        # Student now sees the published result
        code, student_result = self._request("GET", "/api/v1/evaluation/my-result", token=rahim_token)
        self.assertEqual(code, 200)
        self.assertTrue(student_result["published"])
        self.assertIsNotNone(student_result["total"])
        self.assertIsNotNone(student_result["grade"])

        # Editing after publish should return 409
        code, err409 = self._request("PUT", "/api/v1/evaluation/theses/1/mine", token=supervisor_token, data={"scores": full_scores, "comment": "Edit after publish"})
        self.assertEqual(code, 409)

        # Coordinator unpublishes result
        code, unpublished = self._request("POST", "/api/v1/evaluation/theses/1/unpublish", token=coord_token)
        self.assertEqual(code, 200)
        self.assertFalse(unpublished["result"]["published"])

        # Coordinator reopens coordinator's evaluation
        coord_eval_id = unpublished["mine"]["id"]
        code, reopened = self._request("POST", f"/api/v1/evaluation/theses/1/evaluations/{coord_eval_id}/reopen", token=coord_token)
        self.assertEqual(code, 200)
        self.assertEqual(reopened["mine"]["status"], "draft")

    @classmethod
    def tearDownClass(cls):
        # Reset back to standard demo state: Dr. Rahman final (76), coordinator draft
        with SessionLocal() as db:
            db.execute(select(ThesisResult).where(ThesisResult.thesis_id == 1))
            res = db.scalar(select(ThesisResult).where(ThesisResult.thesis_id == 1))
            if res:
                db.delete(res)
            # Delete any existing evaluations for thesis 1 so seed can cleanly re-create
            for ev in db.scalars(select(Evaluation).where(Evaluation.thesis_id == 1)):
                db.delete(ev)
            db.commit()
        seed_evaluation_demo.main()
