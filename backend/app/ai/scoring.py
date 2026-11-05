"""The four formulas of the recommendation score. Pure functions, no database, easy to test."""
import math
from dataclasses import dataclass


@dataclass(frozen=True)
class Weights:
    """Whole percentages that add up to 100."""
    field: int
    semantic: int
    availability: int


def field_score(proposal_fields: set[str], supervisor_fields: set[str]) -> float:
    """F: the share of the proposal's research fields that the supervisor covers (0 to 1)."""
    if not proposal_fields:
        return 0.0
    return len(proposal_fields & supervisor_fields) / len(proposal_fields)


def cosine(a: list[float], b: list[float]) -> float:
    """Cosine similarity of two vectors: the dot product divided by the product of their lengths."""
    dot = sum(x * y for x, y in zip(a, b))
    length_a = math.sqrt(sum(x * x for x in a))
    length_b = math.sqrt(sum(y * y for y in b))
    if length_a == 0 or length_b == 0:
        return 0.0
    return dot / (length_a * length_b)


def semantic_score(cos: float, lo: float, hi: float) -> float:
    """S: stretches a cosine from the range lo..hi onto 0..1 and clamps it."""
    if hi <= lo:
        raise ValueError("hi must be greater than lo")
    return min(1.0, max(0.0, (cos - lo) / (hi - lo)))


def availability(capacity: int, current: int) -> float:
    """A: the share of a supervisor's capacity that is still free (0 to 1)."""
    if capacity <= 0:
        return 0.0
    return max(0.0, (capacity - current) / capacity)


def combine(f: float, s: float, a: float, weights: Weights) -> float:
    """The weighted score from 0 to 1."""
    return (weights.field * f + weights.semantic * s + weights.availability * a) / 100