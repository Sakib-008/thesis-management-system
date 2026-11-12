"""The allocation algorithm of the specification. Pure functions, no database.

Students are served in order of CGPA, highest first. Each one is placed with the best-ranked supervisor
on their own list who has a free place and a match score of at least the minimum."""
from dataclasses import dataclass
from datetime import datetime


@dataclass
class Candidate:
    key: int  # the proposal id
    student_id: int
    cgpa: float
    approved_at: datetime
    ranking: list[tuple[int, float]]  # (supervisor id, match score from 0 to 1), best first


@dataclass
class Placement:
    key: int
    position: int  # the place in the CGPA order. Internal only: no API or screen may ever return it.
    supervisor_id: int | None
    score: float | None
    choice: int | None  # 1 means the student's best-ranked supervisor
    reason: str | None  # why the student is unmatched: "no_good_match" or "capacity"


def allocate(candidates: list[Candidate], free: dict[int, int], min_score: float) -> list[Placement]:
    """free maps a supervisor id to the number of places still free. The caller's dictionary is not changed."""
    free = dict(free)
    # Ties: the earlier approval goes first, then the lower student id, so the same input always gives
    # the same result.
    order = sorted(candidates, key=lambda c: (-c.cgpa, c.approved_at, c.student_id))
    placements = []
    for position, candidate in enumerate(order, start=1):
        placement = Placement(candidate.key, position, None, None, None, None)
        any_good_match = False
        for choice, (supervisor_id, score) in enumerate(candidate.ranking, start=1):
            if score < min_score - 1e-9:
                continue  # this match is too weak
            any_good_match = True
            if free.get(supervisor_id, 0) <= 0:
                continue  # this supervisor is full
            placement.supervisor_id, placement.score, placement.choice = supervisor_id, score, choice
            free[supervisor_id] -= 1
            break
        if placement.supervisor_id is None:
            placement.reason = "capacity" if any_good_match else "no_good_match"
        placements.append(placement)
    return placements
