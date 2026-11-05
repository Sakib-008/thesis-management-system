"""Checks the real AI embedding model on this machine.

It loads the model (downloading it the first time), embeds the specification's example texts
and prints the cosine similarities. Run it once after building the backend image:

    docker compose exec backend python -m app.scripts.check_embedding_model
"""
import time

from app.ai.embedder import get_embedder
from app.ai.scoring import cosine, semantic_score
from app.ai.text import proposal_text, supervisor_text
from app.scripts.seed_demo import PROPOSALS, SUPERVISORS

LO, HI = 0.10, 0.70


def main() -> None:
    embedder = get_embedder()
    print(f"Model: {embedder.name}")

    # The first proposal in the demo data is Rahim Hasan's traffic sign proposal.
    _, title, _, keywords, abstract, problem, objectives, _, _, _ = PROPOSALS[0]
    proposal = proposal_text(title, abstract, keywords, problem, objectives)
    texts = [proposal]
    texts += [supervisor_text(fields, expertise) for _, _, _, _, fields, expertise in SUPERVISORS]

    started = time.time()
    vectors = embedder.embed(texts)
    print(f"Loaded the model and embedded {len(texts)} texts in {time.time() - started:.1f} seconds")
    print(f"Each text became a vector of {len(vectors[0])} numbers\n")

    print(f"Proposal: {title}\n")
    print(f"{'Supervisor':<20}{'Cosine':>8}{'Expertise score S':>20}")
    results = []
    for (_, name, *_), vector in zip(SUPERVISORS, vectors[1:]):
        cos = cosine(vectors[0], vector)
        results.append((name, cos))
        print(f"{name:<20}{cos:>8.3f}{semantic_score(cos, LO, HI) * 100:>19.1f}%")

    best = max(results, key=lambda r: r[1])[0]
    print(f"\nMost similar supervisor: {best}")
    print("Expected: Dr. A. Rahman first and Dr. K. Islam (cyber security) last.")
    print("Related texts usually score between 0.3 and 0.7.")


if __name__ == "__main__":
    main()