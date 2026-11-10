from datetime import datetime, timezone
import json
import unittest
import urllib.request
import urllib.error
import urllib.parse
from decimal import Decimal

from sqlalchemy import select

from app.ai.allocation import Candidate, Placement, allocate
from app.core.errors import ConflictError, InvalidInputError, NotFoundError
from app.db.session import SessionLocal
from app.models.profile import Student, Supervisor
from app.models.thesis import AssignmentMethod, ProposalStatus, SupervisorAssignment, ThesisProposal
from app.models.allocation import AssignmentRun
from app.models.user import User, UserRole
from app.services import allocation_service, profile_service, proposal_service, user_service


class TestAllocationAlgorithm(unittest.TestCase):
    def setUp(self):
        self.t1 = datetime(2026, 11, 1, 10, 0, 0, tzinfo=timezone.utc)
        self.t2 = datetime(2026, 11, 1, 11, 0, 0, tzinfo=timezone.utc)

    def test_cgpa_priority(self):
        # Student 1 has higher CGPA (3.90) than Student 2 (3.50).
        # Supervisor 101 has 1 seat. Both want Supervisor 101 as best match.
        c1 = Candidate(key=1, student_id=10, cgpa=3.90, approved_at=self.t2, ranking=[(101, 0.90)])
        c2 = Candidate(key=2, student_id=20, cgpa=3.50, approved_at=self.t1, ranking=[(101, 0.95)])
        free = {101: 1}

        placements = allocate([c2, c1], free, min_score=0.30)
        p_by_key = {p.key: p for p in placements}

        self.assertEqual(p_by_key[1].supervisor_id, 101)
        self.assertEqual(p_by_key[1].position, 1)
        self.assertEqual(p_by_key[2].supervisor_id, None)
        self.assertEqual(p_by_key[2].reason, "capacity")
        self.assertEqual(p_by_key[2].position, 2)

    def test_tie_breaking_approval_time(self):
        # Same CGPA: earlier approval time gets priority.
        c1 = Candidate(key=1, student_id=10, cgpa=3.80, approved_at=self.t1, ranking=[(101, 0.90)])
        c2 = Candidate(key=2, student_id=20, cgpa=3.80, approved_at=self.t2, ranking=[(101, 0.90)])
        free = {101: 1}

        placements = allocate([c2, c1], free, min_score=0.30)
        p_by_key = {p.key: p for p in placements}

        self.assertEqual(p_by_key[1].supervisor_id, 101)
        self.assertEqual(p_by_key[1].position, 1)
        self.assertEqual(p_by_key[2].supervisor_id, None)

    def test_tie_breaking_student_id(self):
        # Same CGPA and same approval time: lower student_id gets priority.
        c1 = Candidate(key=1, student_id=5, cgpa=3.80, approved_at=self.t1, ranking=[(101, 0.90)])
        c2 = Candidate(key=2, student_id=8, cgpa=3.80, approved_at=self.t1, ranking=[(101, 0.90)])
        free = {101: 1}

        placements = allocate([c2, c1], free, min_score=0.30)
        p_by_key = {p.key: p for p in placements}

        self.assertEqual(p_by_key[1].supervisor_id, 101)
        self.assertEqual(p_by_key[1].position, 1)
        self.assertEqual(p_by_key[2].supervisor_id, None)

    def test_capacity_and_next_choice(self):
        # Supervisor 101 has 1 seat. Candidate 1 takes it. Candidate 2 gets second choice (102).
        c1 = Candidate(key=1, student_id=1, cgpa=3.90, approved_at=self.t1, ranking=[(101, 0.90), (102, 0.80)])
        c2 = Candidate(key=2, student_id=2, cgpa=3.80, approved_at=self.t1, ranking=[(101, 0.85), (102, 0.75)])
        free = {101: 1, 102: 1}

        placements = allocate([c1, c2], free, min_score=0.30)
        p_by_key = {p.key: p for p in placements}

        self.assertEqual(p_by_key[1].supervisor_id, 101)
        self.assertEqual(p_by_key[1].choice, 1)
        self.assertEqual(p_by_key[2].supervisor_id, 102)
        self.assertEqual(p_by_key[2].choice, 2)

    def test_min_score_enforcement(self):
        # Match score below min_score (e.g. 0.25 < 0.30) is not allocated even if supervisor is free.
        c = Candidate(key=1, student_id=1, cgpa=3.90, approved_at=self.t1, ranking=[(101, 0.25)])
        free = {101: 5}

        placements = allocate([c], free, min_score=0.30)
        self.assertEqual(placements[0].supervisor_id, None)
        self.assertEqual(placements[0].reason, "no_good_match")

    def test_unmatched_reasons(self):
        # Candidate has good match (0.80) but supervisor is full -> "capacity"
        c1 = Candidate(key=1, student_id=1, cgpa=3.90, approved_at=self.t1, ranking=[(101, 0.80)])
        # Candidate has only poor match (0.20) -> "no_good_match"
        c2 = Candidate(key=2, student_id=2, cgpa=3.80, approved_at=self.t1, ranking=[(101, 0.20)])
        free = {101: 0}

        placements = allocate([c1, c2], free, min_score=0.30)
        p_by_key = {p.key: p for p in placements}

        self.assertEqual(p_by_key[1].reason, "capacity")
        self.assertEqual(p_by_key[2].reason, "no_good_match")

    def test_caller_dictionary_not_mutated(self):
        c = Candidate(key=1, student_id=1, cgpa=3.90, approved_at=self.t1, ranking=[(101, 0.80)])
        orig_free = {101: 3}
        allocate([c], orig_free, min_score=0.30)
        self.assertEqual(orig_free[101], 3)


class TestAllocationServicesAndSecurity(unittest.TestCase):
    BASE_URL = "http://localhost:8000"

    def _login(self, email: str, password: str = "Demo@12345") -> str:
        body_bytes = json.dumps({"email": email, "password": password}).encode("utf-8")
        req = urllib.request.Request(f"{self.BASE_URL}/api/v1/auth/login", data=body_bytes, method="POST")
        req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            return body["access_token"]

    def _request(self, method: str, path: str, token: str | None = None, data: dict | None = None) -> tuple[int, dict]:
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

    def test_student_forbidden_from_coordinator_endpoints(self):
        token = self._login("sadman.hossain@university.edu")

        # Student cannot view readiness (403)
        code, _ = self._request("GET", "/api/v1/allocation/readiness", token=token)
        self.assertEqual(code, 403)

        # Student cannot trigger allocation (403)
        code, _ = self._request("POST", "/api/v1/allocation/runs", token=token)
        self.assertEqual(code, 403)

        # Student cannot assign supervisor manually (403)
        code, _ = self._request("PUT", "/api/v1/proposals/1/assignment", token=token, data={"supervisor_id": 1, "reason": "test"})
        self.assertEqual(code, 403)

    def test_manual_assignment_validation(self):
        coord_token = self._login("coordinator@university.edu")

        # Empty reason should fail with 400
        code, body = self._request("PUT", "/api/v1/proposals/1/assignment", token=coord_token, data={"supervisor_id": 1, "reason": "   "})
        self.assertEqual(code, 400)
        self.assertIn("Give a reason", body.get("detail", ""))

    def test_cgpa_locking_after_assignment(self):
        with SessionLocal() as db:
            rahim_user = user_service.get_by_email(db, "rahim.hasan@university.edu")
            rahim = profile_service.get_student_by_user(db, rahim_user.id)
            assigned = db.scalar(
                SupervisorAssignment.__table__.select().where(SupervisorAssignment.student_id == rahim.id)
            )
            if assigned is not None:
                # Attempting to change CGPA must raise ConflictError
                with self.assertRaises(ConflictError):
                    profile_service.upsert_student(
                        db, rahim_user,
                        department_id=rahim.department_id,
                        program_id=rahim.program_id,
                        batch=rahim.batch,
                        cgpa=float(rahim.cgpa) + 0.1
                    )

    def test_student_cannot_view_another_student_assignment(self):
        sadman_token = self._login("sadman.hossain@university.edu")

        with SessionLocal() as db:
            rahim_user = user_service.get_by_email(db, "rahim.hasan@university.edu")
            rahim_proposal = proposal_service.get_own(db, rahim_user)

        # Sadman tries to view Rahim's assignment -> should be 404
        code, _ = self._request("GET", f"/api/v1/proposals/{rahim_proposal.id}/assignment", token=sadman_token)
        self.assertEqual(code, 404)

    def test_student_views_own_assignment(self):
        rahim_token = self._login("rahim.hasan@university.edu")
        with SessionLocal() as db:
            rahim_user = user_service.get_by_email(db, "rahim.hasan@university.edu")
            rahim_proposal = proposal_service.get_own(db, rahim_user)

        code, body = self._request("GET", f"/api/v1/proposals/{rahim_proposal.id}/assignment", token=rahim_token)
        self.assertEqual(code, 200)
        self.assertIn("Rahman", body["supervisor_name"])

    def test_supervisor_views_assigned_proposals(self):
        # Supervisor Dr. A. Rahman can view proposals of students assigned to him
        rahman_token = self._login("a.rahman@university.edu")
        code, body = self._request("GET", "/api/v1/proposals", token=rahman_token)
        self.assertEqual(code, 200)
        self.assertIsInstance(body, list)
        student_names = [p.get("student", {}).get("full_name") for p in body]
        self.assertIn("Rahim Hasan", student_names)

    def test_coordinator_manual_assignment_at_capacity(self):
        coord_token = self._login("coordinator@university.edu")
        with SessionLocal() as db:
            # Find a supervisor and temporarily set current_count == capacity
            sup = db.scalar(select(Supervisor).limit(1))
            original_count = sup.current_count
            sup.current_count = sup.capacity

            # Find an approved proposal not already assigned to this supervisor
            assigned_to_sup = select(SupervisorAssignment.proposal_id).where(SupervisorAssignment.supervisor_id == sup.id)
            proposal = db.scalar(
                select(ThesisProposal)
                .where(ThesisProposal.status == ProposalStatus.approved, ~ThesisProposal.id.in_(assigned_to_sup))
                .limit(1)
            )
            db.commit()

            try:
                code, body = self._request(
                    "PUT",
                    f"/api/v1/proposals/{proposal.id}/assignment",
                    token=coord_token,
                    data={"supervisor_id": sup.id, "reason": "Testing capacity limit"},
                )
                self.assertEqual(code, 409)
                self.assertIn("at capacity", body.get("detail", ""))
            finally:
                with SessionLocal() as reset_db:
                    reset_sup = reset_db.get(Supervisor, sup.id)
                    reset_sup.current_count = original_count
                    reset_db.commit()

    def test_coordinator_manual_assignment_not_approved(self):
        coord_token = self._login("coordinator@university.edu")
        with SessionLocal() as db:
            # Find or temporarily set a proposal to draft / revision_required
            proposal = db.scalar(select(ThesisProposal).where(ThesisProposal.status != ProposalStatus.approved).limit(1))
            if proposal is None:
                proposal = db.scalar(select(ThesisProposal).limit(1))
                orig_status = proposal.status
                proposal.status = ProposalStatus.submitted
                db.commit()
                try:
                    code, body = self._request(
                        "PUT",
                        f"/api/v1/proposals/{proposal.id}/assignment",
                        token=coord_token,
                        data={"supervisor_id": 1, "reason": "Testing unapproved"},
                    )
                    self.assertEqual(code, 409)
                    self.assertIn("Only an approved proposal", body.get("detail", ""))
                finally:
                    with SessionLocal() as reset_db:
                        p = reset_db.get(ThesisProposal, proposal.id)
                        p.status = orig_status
                        reset_db.commit()
            else:
                code, body = self._request(
                    "PUT",
                    f"/api/v1/proposals/{proposal.id}/assignment",
                    token=coord_token,
                    data={"supervisor_id": 1, "reason": "Testing unapproved"},
                )
                self.assertEqual(code, 409)
                self.assertIn("Only an approved proposal", body.get("detail", ""))

    def test_coordinator_allocation_run_and_no_cgpa_exposed(self):
        coord_token = self._login("coordinator@university.edu")

        # Check readiness
        code, readiness = self._request("GET", "/api/v1/allocation/readiness", token=coord_token)
        self.assertEqual(code, 200)
        self.assertIn("waiting_verified", readiness)

        # Trigger run if students are waiting
        if readiness["waiting_verified"] > 0:
            code, run_res = self._request("POST", "/api/v1/allocation/runs", token=coord_token)
            self.assertEqual(code, 200)
            self.assertIn("matched", run_res)
            self.assertIn("unmatched", run_res)
            # Verify no CGPA or merit rank in run response
            run_str = json.dumps(run_res).lower()
            self.assertNotIn("cgpa", run_str)
            self.assertNotIn("merit_rank", run_str)
            self.assertNotIn("position", run_str)

        # Check list runs
        code, runs = self._request("GET", "/api/v1/allocation/runs", token=coord_token)
        self.assertEqual(code, 200)
        self.assertIsInstance(runs, list)
        self.assertGreater(len(runs), 0)

        # Check get specific run
        run_id = runs[0]["id"]
        code, single_run = self._request("GET", f"/api/v1/allocation/runs/{run_id}", token=coord_token)
        self.assertEqual(code, 200)
        single_str = json.dumps(single_run).lower()
        self.assertNotIn("cgpa", single_str)
        self.assertNotIn("merit_rank", single_str)
        self.assertNotIn("position", single_str)

    def test_run_when_no_students_waiting(self):
        coord_token = self._login("coordinator@university.edu")
        code, readiness = self._request("GET", "/api/v1/allocation/readiness", token=coord_token)
        self.assertEqual(code, 200)
        if readiness["waiting_verified"] == 0:
            code, body = self._request("POST", "/api/v1/allocation/runs", token=coord_token)
            self.assertEqual(code, 400)
            self.assertIn("No students are waiting", body.get("detail", ""))

    @classmethod
    def tearDownClass(cls):
        with SessionLocal() as db:
            db.query(SupervisorAssignment).filter(SupervisorAssignment.method == AssignmentMethod.merit_allocation).delete()
            db.query(AssignmentRun).delete()
            db.query(Student).update({"merit_rank": None})
            sup_counts = {
                "a.rahman@university.edu": 4,
                "s.chowdhury@university.edu": 3,
                "m.karim@university.edu": 2,
                "k.islam@university.edu": 4,
            }
            for s in db.query(Supervisor).all():
                if s.user and s.user.email in sup_counts:
                    s.current_count = sup_counts[s.user.email]
            db.commit()


if __name__ == "__main__":
    unittest.main()
