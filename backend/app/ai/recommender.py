"""Scores every supervisor for one proposal and ranks them. No database access here."""
from dataclasses import dataclass, field

from app.ai.scoring import Weights, availability, combine, cosine, field_score, semantic_score


@dataclass
class ProposalInput:
    field_names: set[str]
    embedding: list[float]


@dataclass
class SupervisorInput:
    id: int
    field_names: set[str]
    embedding: list[float] | None  # None when the supervisor has written no expertise text
    capacity: int
    current: int


@dataclass
class Params:
    weights: Weights
    cos_lo: float
    cos_hi: float
    min_score: float  # a fraction, for example 0.30


@dataclass
class Recommendation:
    supervisor_id: int
    field: float
    semantic: float
    availability: float
    total: float
    cosine: float | None
    matched_fields: list[str]
    flags: list[str] = field(default_factory=list)
    summary: str = ""
    rank: int = 0


def build_summary(n_fields: int, matched: int, s: float, has_text: bool, free: int) -> str:
    """A short plain-language reason, built from fixed templates driven by the numbers."""
    if matched == 0:
        field_part = "No research field in common"
    elif matched == n_fields:
        field_part = f"Covers all {n_fields} proposal field{'s' if n_fields != 1 else ''}"
    else:
        field_part = f"Covers {matched} of {n_fields} proposal fields"

    if not has_text:
        expertise_part = "no expertise text on file"
    elif s >= 0.75:
        expertise_part = "closely related expertise"
    elif s >= 0.50:
        expertise_part = "related expertise"
    elif s >= 0.25:
        expertise_part = "some conceptual overlap"
    else:
        expertise_part = "little overlap with the proposal text"

    if free <= 0:
        capacity_part = "no free capacity"
    elif free == 1:
        capacity_part = "one slot is free"
    else:
        capacity_part = f"{free} slots are free"

    return f"{field_part}; {expertise_part}; {capacity_part}."


def score_one(proposal: ProposalInput, sup: SupervisorInput, params: Params) -> Recommendation:
    f = field_score(proposal.field_names, sup.field_names)
    has_text = sup.embedding is not None
    cos = cosine(proposal.embedding, sup.embedding) if has_text else None
    s = semantic_score(cos, params.cos_lo, params.cos_hi) if cos is not None else 0.0
    a = availability(sup.capacity, sup.current)
    total = combine(f, s, a, params.weights)

    free = sup.capacity - sup.current
    flags = []
    if not has_text:
        flags.append("no_expertise_text")
    if free <= 0:
        flags.append("at_capacity")
    if total < params.min_score:
        flags.append("below_minimum")

    matched = sorted(proposal.field_names & sup.field_names)
    return Recommendation(
        supervisor_id=sup.id, field=f, semantic=s, availability=a, total=total, cosine=cos,
        matched_fields=matched, flags=flags,
        summary=build_summary(len(proposal.field_names), len(matched), s, has_text, free),
    )


def recommend(proposal: ProposalInput, supervisors: list[SupervisorInput], params: Params) -> list[Recommendation]:
    results = [score_one(proposal, sup, params) for sup in supervisors]
    # Highest score first. Ties go to the supervisor with more availability, then to the lower id.
    results.sort(key=lambda r: (-round(r.total, 9), -r.availability, r.supervisor_id))
    for position, result in enumerate(results, start=1):
        result.rank = position
    return results