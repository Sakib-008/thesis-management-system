import re

_TAGS = re.compile(r"<[^>]+>")
_SPACES = re.compile(r"\s+")


def clean(text: str | None) -> str:
    """Remove markup and collapse all whitespace into single spaces."""
    return _SPACES.sub(" ", _TAGS.sub(" ", text or "")).strip()


def proposal_text(title: str, abstract: str, keywords: list[str], problem_statement: str, objectives: str) -> str:
    """The text that represents a proposal. The most informative parts come first, because the
    embedding model only reads a limited number of word pieces."""
    parts = [clean(title), clean(abstract)]
    if keywords:
        parts.append("Keywords: " + ", ".join(clean(k) for k in keywords) + ".")
    parts += [clean(problem_statement), clean(objectives)]
    return " ".join(p for p in parts if p)


def supervisor_text(field_names: list[str], expertise: str) -> str:
    """The text that represents a supervisor: their research fields, then their own expertise paragraph."""
    head = ("Research fields: " + ", ".join(sorted(field_names)) + ".") if field_names else ""
    return " ".join(p for p in (head, clean(expertise)) if p)