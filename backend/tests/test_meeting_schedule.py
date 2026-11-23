"""A supervisor sets a meeting date directly, and can move it later."""
import unittest
from datetime import datetime, timedelta, timezone

from tests import helpers as h


def when(days: int, hour: int = 10) -> str:
    day = datetime.now(timezone.utc) + timedelta(days=days)
    return day.replace(hour=hour, minute=0, second=0, microsecond=0).isoformat()


class TestSupervisorSchedulesMeeting(unittest.TestCase):
    def setUp(self):
        self.sup = h.login(h.SUPERVISOR)
        self.student = h.login(h.STUDENT)
        code, rows = h.request("GET", "/api/v1/milestones/progress", token=self.sup)
        self.assertEqual(code, 200)
        self.thesis_id = next(r["thesis_id"] for r in rows if h.STUDENT.split("@")[0].split(".")[0].title() in
                              " ".join(r["student_names"]))
        self.created: list[int] = []

    def tearDown(self):
        for meeting_id in self.created:
            h.request("POST", f"/api/v1/meetings/{meeting_id}/cancel", token=self.sup, data={})

    def _schedule(self, **over):
        body = {"thesis_id": self.thesis_id, "meeting_date": when(40), "agenda": "Review chapter 3", "mode": "online",
                "location": "Meet link"} | over
        code, out = h.request("POST", "/api/v1/meetings/schedule", token=self.sup, data=body)
        if code == 200:
            self.created.append(out["id"])
        return code, out

    def test_supervisor_schedules_and_student_is_told(self):
        code, meeting = self._schedule(meeting_date=when(41, 11))
        self.assertEqual(code, 200)
        self.assertEqual(meeting["status"], "scheduled")  # no request and no accept step
        code, mine = h.request("GET", "/api/v1/meetings", token=self.student)
        self.assertIn(meeting["id"], [m["id"] for m in mine])
        code, notes = h.request("GET", "/api/v1/notifications", token=self.student)
        self.assertTrue(any("scheduled a meeting" in n["text"] for n in notes))

    def test_reschedule_moves_the_date_and_notifies(self):
        _, meeting = self._schedule(meeting_date=when(42))
        new_date = when(43, 15)
        code, moved = h.request("POST", f"/api/v1/meetings/{meeting['id']}/reschedule", token=self.sup,
                                data={"meeting_date": new_date, "location": "Room 5"})
        self.assertEqual(code, 200)
        self.assertEqual(moved["location"], "Room 5")
        self.assertEqual(datetime.fromisoformat(moved["meeting_date"]), datetime.fromisoformat(new_date))
        _, notes = h.request("GET", "/api/v1/notifications", token=self.student)
        self.assertTrue(any("was moved to" in n["text"] for n in notes))

    def test_rules(self):
        self.assertEqual(self._schedule(meeting_date=when(-2))[0], 400)  # the past
        self.assertEqual(self._schedule(agenda="x")[0], 422)  # agenda too short
        self.assertEqual(self._schedule(mode="phone")[0], 422)
        _, first = self._schedule(meeting_date=when(44, 9))
        self.assertEqual(self._schedule(meeting_date=when(44, 9))[0], 409)  # same time twice
        self.assertEqual(first["status"], "scheduled")

    def test_only_the_assigned_supervisor(self):
        body = {"thesis_id": self.thesis_id, "meeting_date": when(45), "agenda": "Sneaky meeting"}
        for token, expected in ((h.login(h.OTHER_SUPERVISOR), 404), (self.student, 403),
                                (h.login(h.COORDINATOR), 403), (None, 401)):
            code, _ = h.request("POST", "/api/v1/meetings/schedule", token=token, data=body)
            self.assertEqual(code, expected, token)
        _, meeting = self._schedule(meeting_date=when(46))
        code, _ = h.request("POST", f"/api/v1/meetings/{meeting['id']}/reschedule", token=h.login(h.OTHER_SUPERVISOR),
                            data={"meeting_date": when(47)})
        self.assertIn(code, (403, 404))
        code, _ = h.request("POST", f"/api/v1/meetings/{meeting['id']}/reschedule", token=self.student,
                            data={"meeting_date": when(47)})
        self.assertEqual(code, 403)


if __name__ == "__main__":
    unittest.main()
