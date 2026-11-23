import json
import unittest
import urllib.error
import urllib.request

from app.db.session import SessionLocal
from app.models.evaluation import Evaluation, EvaluationCriterion, ThesisResult
from app.models.user import UserRole
from app.scripts import seed_evaluation_demo
from sqlalchemy import select, text


DEFENSE_SHEET = [
    {"code": "CO5", "category": "Presentation", "name": "Teamwork and project management", "weight": 15.0},
    {"code": "CO6", "category": "Presentation", "name": "Communication and documentation", "weight": 15.0},
    {"code": "CO1", "category": "Project Evaluation", "name": "Problem analysis", "weight": 15.0},
    {"code": "CO2", "category": "Project Evaluation", "name": "System design and development", "weight": 20.0},
    {"code": "CO3", "category": "Project Evaluation", "name": "Application of modern tools", "weight": 20.0},
    {"code": "CO4", "category": "Project Evaluation", "name": "Investigation and testing", "weight": 15.0},
]


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
            # the marking sheet is the department defense sheet (admins can change it, other tests may have)
            db.query(EvaluationCriterion).delete()
            for order, c in enumerate(DEFENSE_SHEET, start=1):
                db.add(EvaluationCriterion(description="", sort_order=order, **c))
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

        # Change the maximum marks so the total != 100 -> 400
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

    def test_course_outcomes_marks_and_groups(self):
        admin_token = self._login("admin.demo@university.edu")
        coord_token = self._login("coordinator@university.edu")

        # The default set follows the department defense sheet: two groups, six outcomes, 100 marks
        code, crit = self._request("GET", "/api/v1/evaluation/criteria", token=admin_token)
        self.assertEqual(code, 200)
        by_code = {c["code"]: c for c in crit["criteria"]}
        self.assertEqual(set(by_code), {"CO1", "CO2", "CO3", "CO4", "CO5", "CO6"})
        self.assertEqual(by_code["CO5"]["category"], "Presentation")
        self.assertEqual(by_code["CO2"]["weight"], 20.0)
        self.assertEqual(crit["active_total"], 100.0)

        # A mark cannot be more than the outcome's maximum
        code, detail = self._request("GET", "/api/v1/evaluation/theses/1", token=coord_token)
        co1 = next(c for c in detail["criteria"] if c["code"] == "CO1")
        too_much = [{"criterion_id": co1["id"], "score": co1["weight"] + 1}]
        code, err = self._request("PUT", "/api/v1/evaluation/theses/1/mine", token=coord_token, data={"scores": too_much})
        self.assertEqual(code, 400)
        self.assertIn("cannot be more than", err.get("detail", ""))

        # The total is the sum of the marks, and each group has its own subtotal
        marks = {c["code"]: c["weight"] for c in detail["criteria"]}  # full marks everywhere
        scores = [{"criterion_id": c["id"], "score": marks[c["code"]]} for c in detail["criteria"]]
        code, saved = self._request("PUT", "/api/v1/evaluation/theses/1/mine", token=coord_token, data={"scores": scores})
        self.assertEqual(code, 200)
        self.assertEqual(saved["mine"]["total"], 100.0)
        groups = {g["category"]: g for g in saved["mine"]["groups"]}
        self.assertEqual(groups["Presentation"]["max"], 30.0)
        self.assertEqual(groups["Project Evaluation"]["max"], 70.0)
        self.assertEqual(groups["Presentation"]["marks"], 30.0)

        # Codes must be unique, and every outcome needs a group
        dup = [dict(c) for c in crit["criteria"]]
        dup[1]["code"] = dup[0]["code"]
        code, err = self._request("PUT", "/api/v1/evaluation/criteria", token=admin_token, data={"criteria": dup})
        self.assertEqual(code, 400)
        self.assertIn("own code", err.get("detail", ""))
        no_group = [dict(c) for c in crit["criteria"]]
        no_group[0]["category"] = ""
        code, _ = self._request("PUT", "/api/v1/evaluation/criteria", token=admin_token, data={"criteria": no_group})
        self.assertEqual(code, 422)

    def test_admin_can_redesign_the_marking_sheet(self):
        admin_token = self._login("admin.demo@university.edu")
        code, original = self._request("GET", "/api/v1/evaluation/criteria", token=admin_token)
        try:
            new_set = [
                {"code": "A1", "category": "Report", "name": "Written report", "description": "", "weight": 40.0},
                {"code": "A2", "category": "Viva", "name": "Oral defense", "description": "", "weight": 60.0},
            ]
            code, saved = self._request("PUT", "/api/v1/evaluation/criteria", token=admin_token, data={"criteria": new_set})
            self.assertEqual(code, 200)
            self.assertEqual([c["code"] for c in saved["criteria"]], ["A1", "A2"])
            self.assertTrue(saved["valid"])
        finally:
            restore = {"criteria": [dict(c) for c in original["criteria"]]}
            code, _ = self._request("PUT", "/api/v1/evaluation/criteria", token=admin_token, data=restore)
            self.assertEqual(code, 200)

    def test_marks_and_results_are_per_student(self):
        """Two students in one thesis get their own marks, their own result and their own notification."""
        sup, coord = self._login("a.rahman@university.edu"), self._login("coordinator@university.edu")
        rahim, zarin = self._login("rahim.hasan@university.edu"), self._login("zarin.tasnim@university.edu")
        with SessionLocal() as db:
            ids = dict(db.execute(text(
                "select u.email, s.id from students s join users u on u.id = s.user_id"
            )).all())
            zarin_team = db.scalar(text("select thesis_id from thesis_members where student_id = :s"), {"s": ids["zarin.tasnim@university.edu"]})
            db.execute(text("update thesis_members set thesis_id = 1 where student_id = :s"), {"s": ids["zarin.tasnim@university.edu"]})
            db.commit()
        r_id, z_id = ids["rahim.hasan@university.edu"], ids["zarin.tasnim@university.edu"]
        try:
            # one row for each student
            code, rows = self._request("GET", "/api/v1/evaluation/theses", token=coord)
            self.assertEqual({r["student_id"] for r in rows if r["thesis_id"] == 1}, {r_id, z_id})

            def mark(student_id, share):
                code, detail = self._request("GET", f"/api/v1/evaluation/theses/1?student_id={student_id}", token=sup)
                self.assertEqual(detail["student_id"], student_id)
                scores = [{"criterion_id": c["id"], "score": round(c["weight"] * share, 2)} for c in detail["criteria"]]
                code, saved = self._request("PUT", f"/api/v1/evaluation/theses/1/mine?student_id={student_id}", token=sup, data={"scores": scores})
                self.assertEqual(code, 200, saved)
                return saved

            zarin_detail = mark(z_id, 0.5)
            self.assertEqual(zarin_detail["mine"]["total"], 50.0)
            code, again = self._request("GET", f"/api/v1/evaluation/theses/1?student_id={r_id}", token=sup)
            self.assertEqual(again["mine"]["total"], 76.5)  # Rahim's marks (from the seed) did not change
            self.assertEqual({t["student_id"] for t in again["team"]}, {r_id, z_id})

            # a student who is not in this thesis cannot be marked in it
            tahmid = ids["tahmid.alam@university.edu"]
            code, _ = self._request("GET", f"/api/v1/evaluation/theses/1?student_id={tahmid}", token=sup)
            self.assertEqual(code, 404)

            def published_notes(token):
                return sum("result has been published" in n["text"] for n in self._request("GET", "/api/v1/notifications", token=token)[1])

            before = {"zarin": published_notes(zarin), "rahim": published_notes(rahim)}
            # submit and publish only Zarin
            self.assertEqual(self._request("POST", f"/api/v1/evaluation/theses/1/mine/submit?student_id={z_id}", token=sup)[0], 200)
            code, published = self._request("POST", f"/api/v1/evaluation/theses/1/publish?student_id={z_id}", token=coord)
            self.assertEqual(code, 200, published)
            self.assertEqual(published["result"]["total"], 50.0)

            code, mine_z = self._request("GET", "/api/v1/evaluation/my-result", token=zarin)
            self.assertTrue(mine_z["published"])
            self.assertEqual(mine_z["total"], 50.0)
            code, mine_r = self._request("GET", "/api/v1/evaluation/my-result", token=rahim)
            self.assertFalse(mine_r["published"])  # a teammate's result never shows up for Rahim
            self.assertIsNone(mine_r["total"])

            self.assertEqual(published_notes(zarin), before["zarin"] + 1)  # only the student who was published
            self.assertEqual(published_notes(rahim), before["rahim"])

            # Zarin's marks are locked once published, Rahim's draft (the coordinator's) is not
            code, _ = self._request("PUT", f"/api/v1/evaluation/theses/1/mine?student_id={z_id}", token=sup, data={"scores": []})
            self.assertEqual(code, 409)
            code, _ = self._request("PUT", f"/api/v1/evaluation/theses/1/mine?student_id={r_id}", token=coord, data={"scores": []})
            self.assertEqual(code, 200)

            self.assertEqual(self._request("POST", f"/api/v1/evaluation/theses/1/unpublish?student_id={z_id}", token=coord)[0], 200)
            self.assertFalse(self._request("GET", "/api/v1/evaluation/my-result", token=zarin)[1]["published"])
        finally:
            with SessionLocal() as db:
                db.execute(text("delete from thesis_results where student_id = :s"), {"s": z_id})
                db.execute(text("delete from evaluations where student_id = :s"), {"s": z_id})
                db.execute(text("update thesis_members set thesis_id = :t where student_id = :s"), {"t": zarin_team, "s": z_id})
                db.commit()

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

        # Coordinator completes all marks (85% of each outcome's maximum) and saves
        criteria = detail["criteria"]
        full_scores = [{"criterion_id": c["id"], "score": round(c["weight"] * 0.85, 2)} for c in criteria]
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
        # The student sees marks per outcome and per group, like the defense sheet
        self.assertEqual(len(student_result["criteria"]), 6)
        self.assertTrue(all(c["code"] for c in student_result["criteria"]))
        self.assertEqual({g["category"] for g in student_result["groups"]}, {"Presentation", "Project Evaluation"})
        self.assertAlmostEqual(sum(c["average"] for c in student_result["criteria"]), student_result["total"], places=1)

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
