# Testing, security and AI accuracy

All commands run from the project folder after `docker compose up --build`. The demo data must be loaded
(`seed_demo`, `seed_allocation_demo`, `seed_meetings_demo`, `seed_supervision_demo`, `seed_evaluation_demo`) and the
admin account `admin.demo@university.edu` must exist (`python -m app.scripts.create_admin`, or create it in the app).

## Run everything

```
docker compose exec backend python -m unittest discover -s tests -t . -v
```

The tests talk to the running API at `http://localhost:8000` (change it with `BASE_URL`). Some of them reset the demo
evaluation data first, so run them on a demo database, not on real marks.

| File | What it proves |
| --- | --- |
| `tests/test_functional.py` | Every screen's API answers for the roles that use it; modules agree with each other (supervisor and student see the same thesis, a result equals the sum of its outcome marks, the marking sheet totals 100, audit log, notifications, PDF download). |
| `tests/test_allocation.py` | Allocation and recommendation rules, privacy of CGPA. |
| `tests/test_evaluation.py` | Defense-sheet evaluation: course outcomes CO1 to CO6, Presentation and Project Evaluation groups, marks limited to each outcome's maximum, submit, publish, reopen, admin redesigning the sheet, and marks, results and notifications kept apart for each student of a team. |
| `tests/test_meeting_schedule.py` | A supervisor sets a meeting date and moves it. The student is notified. Past dates, double booking, wrong supervisor and wrong roles are refused. |
| `tests/test_notifications_dashboards.py` | Notifications and the four dashboards. |
| `tests/test_security.py` | See the next section. |
| `tests/test_performance.py` | Response time per screen, and 20 users at once. |

## Security tests (`tests/test_security.py`)

| Area | Checked |
| --- | --- |
| Authentication | Every protected endpoint refuses a visitor with no token (401). Garbage, empty, truncated, tampered and `alg: none` tokens are refused. A wrong password and an unknown e-mail give the same answer. SQL and script text in the login form is only text. Public registration cannot make an admin. No response contains a password hash. |
| Role violations | 21 endpoints times 4 roles. A role that is not allowed gets 403. A student cannot promote themselves. |
| Other people's data | A student cannot open a classmate's proposal, recommendations, documents or meetings, nor the evaluation screens. An unrelated supervisor sees none of another supervisor's meetings. Unpublished marks stay hidden. |
| Invalid files | `.exe`, `.sh`, `.html`, `.svg`, `.py`, no extension and double extensions are refused. A file whose content does not match its extension is refused. Empty files and files over 20 MB are refused. A name like `../../etc/passwd.pdf` cannot leave the upload folder. A download is only for people allowed to see the document. |
| Input | Wrong types and too long text give 422, never 500. Huge or negative ids give 404 or 422. Script text is stored as text (the Next.js app escapes it). |

The security tests clean up the documents they upload.

## AI accuracy and response time

```
docker compose exec backend python -m app.scripts.eval_recommendation_accuracy --repeat 5 --json ai_result.json
```

It runs the real recommendation service for each proposal in `ANSWER_KEY` (inside the script), and prints Top-1, Top-3,
MRR and the time of one recommendation. The first call also loads the model, so it is reported on its own. It leaves
the database unchanged. **The answer key is my judgement from each topic. Ask your supervisor to confirm or correct it,
and add real proposals if you have them.** `--stub` runs the script without the model, only to check the script itself.
The deeper study of the model (baselines, paraphrase stability) is in `eval_minilm.py`.

| Metric | Your result |
| --- | --- |
| Proposals tested | ____ |
| Top-1 accuracy | ____ % |
| Top-3 accuracy | ____ % |
| MRR | ____ |
| First call (model load) | ____ s |
| Later calls, median / p95 | ____ s / ____ s |

## Performance

```
docker compose exec backend python -m unittest tests.test_performance -v
```

Limits: p95 under 500 ms for one user, 3 s with 20 users at once. Override with `PERF_P95_MS`, `PERF_USERS`,
`PERF_REPEATS`. Measured while building (Postgres and API on one small cloud machine, demo data): single-user median
6 to 69 ms per screen, 20 users at once 67 requests per second, p95 about 525 ms, no failures. Put your own numbers
from Docker in the report.

## Known limits

- Marks and published results belong to each student. A team of two or more is marked student by student.
- The AI model downloads on first use and needs internet once. Tests that call it return 503 until it is cached.
- The tests use the live API and the demo accounts. They are not a replacement for tests on an empty database.
