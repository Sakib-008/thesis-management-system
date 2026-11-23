"""Phase 16: AI accuracy and response time of the supervisor recommendation, measured through the real service.

For every proposal that has an answer key it generates the recommendations, then reports
  Top-1 accuracy : the first supervisor is one of the right supervisors
  Top-3 accuracy : at least one right supervisor is among the first three
  MRR            : mean of 1 / (rank of the first right supervisor), 1.0 is perfect
  time           : seconds for one recommendation (the first run also loads the AI model)

Run it with the real model, inside Docker (needs the demo data from seed_demo):
    docker compose exec backend python -m app.scripts.eval_recommendation_accuracy
    docker compose exec backend python -m app.scripts.eval_recommendation_accuracy --repeat 5 --json out.json
The answer key is ANSWER_KEY below, or a JSON file passed with --key:  {"student@email": ["supervisor@email", ...]}
The first supervisor in a list is the ideal one, the others are acceptable. Ask your supervisors to confirm the key.

--stub uses a simple word-overlap embedder to check this script without the AI model. Its numbers are NOT results.
"""
import argparse
import hashlib
import json
import math
import re
import statistics
import time

from sqlalchemy import select

from app.ai.embedder import set_embedder
from app.db.session import SessionLocal
from app.models.profile import Supervisor
from app.models.user import User, UserRole
from app.services import proposal_service, recommendation_service

# student email -> supervisors who are a right match (the most suitable first). Judged from each proposal's topic
# and each supervisor's expertise in the demo data.
ANSWER_KEY: dict[str, list[str]] = {
    "rahim.hasan@university.edu": ["a.rahman@university.edu", "s.chowdhury@university.edu"],
    "zarin.tasnim@university.edu": ["s.chowdhury@university.edu", "a.rahman@university.edu"],
    "imran.chowdhury@university.edu": ["s.chowdhury@university.edu", "a.rahman@university.edu"],
    "tahmid.alam@university.edu": ["k.islam@university.edu"],
    "nabila.karim@university.edu": ["m.karim@university.edu"],
    "sadman.hossain@university.edu": ["m.karim@university.edu"],
    "fahim.reza@university.edu": ["s.chowdhury@university.edu"],
}


class WordHashEmbedder:
    """For --stub only: a bag of words hashed into 256 numbers. It has no understanding of meaning."""

    name = "stub-word-hash"

    def embed(self, texts: list[str]) -> list[list[float]]:
        out = []
        for text in texts:
            vec = [0.0] * 256
            for word in re.findall(r"[a-z]{3,}", text.lower()):
                vec[int(hashlib.md5(word.encode()).hexdigest(), 16) % 256] += 1.0
            norm = math.sqrt(sum(v * v for v in vec)) or 1.0
            out.append([v / norm for v in vec])
        return out


def percentile(values: list[float], pct: float) -> float:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, math.ceil(pct / 100 * len(ordered)) - 1)]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--key", help="JSON answer key to use instead of the built-in one")
    parser.add_argument("--repeat", type=int, default=3, help="timed repeats per proposal (default 3)")
    parser.add_argument("--json", help="also write the results to this file")
    parser.add_argument("--stub", action="store_true", help="dry run without the AI model; numbers are not results")
    args = parser.parse_args()
    key = json.load(open(args.key, encoding="utf-8")) if args.key else ANSWER_KEY
    if args.stub:
        set_embedder(WordHashEmbedder())

    rows, timings, first_call = [], [], None
    with SessionLocal() as db:
        actor = db.scalar(select(User).where(User.role.in_([UserRole.coordinator, UserRole.admin])))
        email_of = {s.id: s.user.email for s in db.scalars(select(Supervisor))}
        for student_email, right in key.items():
            student = db.scalar(select(User).where(User.email == student_email))
            proposal = proposal_service.get_own(db, student) if student else None
            if proposal is None:
                print(f"skipped {student_email}: no proposal")
                continue
            for run in range(max(1, args.repeat)):
                started = time.perf_counter()
                recommendation_service.generate(db, proposal.id, actor)
                got = recommendation_service.read(db, proposal.id, actor, limit=10)
                elapsed = time.perf_counter() - started
                if first_call is None:
                    first_call = elapsed  # includes loading the model
                else:
                    timings.append(elapsed)
            ranked = [email_of[r.supervisor_id] for r in got]
            ranks = [ranked.index(e) + 1 for e in right if e in ranked]
            best = min(ranks) if ranks else None
            rows.append({
                "student": student_email, "title": proposal.title, "right": right, "ranked": ranked[:3],
                "best_rank": best, "top1": best == 1, "top3": best is not None and best <= 3,
                "rr": 1 / best if best else 0.0, "top_score": got[0].score if got else None,
            })
        db.rollback()  # the demo data is left as it was, this was only a measurement

    n = len(rows)
    if n == 0:
        raise SystemExit("No proposal in the answer key was found. Run seed_demo first.")
    summary = {
        "model": "stub (not a result)" if args.stub else recommendation_service.get_embedder_name(),
        "proposals": n,
        "top1": sum(r["top1"] for r in rows) / n,
        "top3": sum(r["top3"] for r in rows) / n,
        "mrr": sum(r["rr"] for r in rows) / n,
        "first_call_seconds": round(first_call or 0, 3),
        "median_seconds": round(statistics.median(timings), 3) if timings else None,
        "p95_seconds": round(percentile(timings, 95), 3) if timings else None,
        "max_seconds": round(max(timings), 3) if timings else None,
    }

    print(f"\nModel: {summary['model']}\n")
    print(f"{'Student':<34}{'Best rank':>10}  Top 3 (supervisor e-mail names)")
    for r in rows:
        names = ", ".join(e.split("@")[0] for e in r["ranked"])
        print(f"{r['student']:<34}{str(r['best_rank'] or '-'):>10}  {names}   [right: "
              f"{', '.join(e.split('@')[0] for e in r['right'])}]")
    print(f"\nProposals tested : {n}")
    print(f"Top-1 accuracy   : {summary['top1']:.0%}")
    print(f"Top-3 accuracy   : {summary['top3']:.0%}")
    print(f"MRR              : {summary['mrr']:.2f}")
    print(f"First call       : {summary['first_call_seconds']} s (includes loading the model)")
    if timings:
        print(f"Later calls      : median {summary['median_seconds']} s, p95 {summary['p95_seconds']} s, "
              f"max {summary['max_seconds']} s over {len(timings)} runs")
    if args.json:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump({"summary": summary, "rows": rows}, f, indent=2)
        print(f"Written to {args.json}")


if __name__ == "__main__":
    main()
