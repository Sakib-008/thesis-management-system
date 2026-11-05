"""Finds existing proposals that are too similar to a new one. Pure functions, no database."""
import re
from dataclasses import dataclass

from app.ai.scoring import cosine

_NOT_WORD = re.compile(r"[^a-z0-9]+")


def normalize_title(title: str) -> str:
    """Lower case, punctuation removed, single spaces. Two titles that differ only in this are the same title."""
    return _NOT_WORD.sub(" ", title.lower()).strip()


def level_for(similarity: float, high: float, possible: float) -> str | None:
    """Similarity and both thresholds are fractions from 0 to 1."""
    if similarity >= high:
        return "high"
    if similarity >= possible:
        return "possible"
    return None


@dataclass
class Query:
    title: str
    embedding: list[float]


@dataclass
class Candidate:
    proposal_id: int
    title: str
    embedding: list[float]


@dataclass
class Match:
    proposal_id: int
    similarity: float  # 0 to 1
    method: str  # "title" or "embedding"
    level: str  # "high" or "possible"


def find_matches(
    query: Query, candidates: list[Candidate], high: float, possible: float, max_matches: int = 5
) -> list[Match]:
    """The most similar candidates, best first. Only matches at or above the 'possible' level are kept."""
    wanted_title = normalize_title(query.title)
    found = []
    for cand in candidates:
        if wanted_title and normalize_title(cand.title) == wanted_title:
            found.append(Match(cand.proposal_id, 1.0, "title", "high"))
            continue
        similarity = max(0.0, min(1.0, cosine(query.embedding, cand.embedding)))
        level = level_for(similarity, high, possible)
        if level:
            found.append(Match(cand.proposal_id, similarity, "embedding", level))
    found.sort(key=lambda m: (-m.similarity, m.proposal_id))
    return found[:max_matches]