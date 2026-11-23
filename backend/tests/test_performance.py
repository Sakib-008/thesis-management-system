"""Phase 16 performance tests: response time of the main screens, alone and with many users at once.
Limits are generous for a laptop running Docker. Change them with PERF_P95_MS, PERF_LOGIN_MS and PERF_USERS.
Results are printed, so they can go straight into the test report."""
import os
import statistics
import time
import unittest
from concurrent.futures import ThreadPoolExecutor

from tests import helpers as h

P95_MS = float(os.environ.get("PERF_P95_MS", 500))
LOGIN_MS = float(os.environ.get("PERF_LOGIN_MS", 1500))  # password hashing is slow on purpose
USERS = int(os.environ.get("PERF_USERS", 20))
REPEATS = int(os.environ.get("PERF_REPEATS", 20))

ENDPOINTS = [
    (h.STUDENT, "/api/v1/dashboard/student"),
    (h.SUPERVISOR, "/api/v1/dashboard/supervisor"),
    (h.COORDINATOR, "/api/v1/dashboard/coordinator"),
    (h.ADMIN, "/api/v1/dashboard/admin"),
    (h.COORDINATOR, "/api/v1/proposals"),
    (h.COORDINATOR, "/api/v1/evaluation/theses"),
    (h.SUPERVISOR, "/api/v1/meetings"),
    (h.STUDENT, "/api/v1/notifications"),
    (h.ADMIN, "/api/v1/audit-logs"),
]


def timed(method: str, path: str, token: str | None, data=None) -> tuple[int, float]:
    started = time.perf_counter()
    code, _ = h.request(method, path, token=token, data=data)
    return code, (time.perf_counter() - started) * 1000


def p95(values: list[float]) -> float:
    return sorted(values)[max(0, int(len(values) * 0.95) - 1)]


class TestResponseTime(unittest.TestCase):
    def test_login(self):
        times = []
        for _ in range(5):
            code, ms = timed("POST", "/api/v1/auth/login", None, {"email": h.STUDENT, "password": h.PASSWORD})
            self.assertEqual(code, 200)
            times.append(ms)
        print(f"\n  login: median {statistics.median(times):.0f} ms, max {max(times):.0f} ms")
        self.assertLess(max(times), LOGIN_MS)

    def test_one_user_at_a_time(self):
        print(f"\n  {'endpoint':<40}{'median':>8}{'p95':>8}   ({REPEATS} requests, one at a time)")
        for email, path in ENDPOINTS:
            token = h.login(email)
            times = []
            for _ in range(REPEATS):
                code, ms = timed("GET", path, token)
                self.assertEqual(code, 200, path)
                times.append(ms)
            print(f"  {path:<40}{statistics.median(times):>6.0f}ms{p95(times):>6.0f}ms")
            self.assertLess(p95(times), P95_MS, f"{path} is too slow")


class TestManyUsersAtOnce(unittest.TestCase):
    def test_concurrent_users(self):
        tokens = {email: h.login(email) for email, _ in ENDPOINTS}
        jobs = [ENDPOINTS[i % len(ENDPOINTS)] for i in range(USERS * 5)]

        def one(job):
            email, path = job
            return timed("GET", path, tokens[email])

        started = time.perf_counter()
        with ThreadPoolExecutor(max_workers=USERS) as pool:
            results = list(pool.map(one, jobs))
        seconds = time.perf_counter() - started
        times = [ms for _, ms in results]
        failed = [code for code, _ in results if code != 200]
        print(f"\n  {USERS} users at once, {len(jobs)} requests in {seconds:.1f} s "
              f"({len(jobs) / seconds:.0f} requests/s): median {statistics.median(times):.0f} ms, "
              f"p95 {p95(times):.0f} ms, failed {len(failed)}")
        self.assertEqual(failed, [], "some requests failed under load")
        self.assertLess(p95(times), P95_MS * 6, "too slow with many users")


if __name__ == "__main__":
    unittest.main()
