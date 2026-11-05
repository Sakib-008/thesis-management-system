import hashlib
from typing import Protocol

from app.core.config import settings
from app.core.errors import ServiceUnavailableError


class Embedder(Protocol):
    name: str

    def embed(self, texts: list[str]) -> list[list[float]]:
        """Turn each text into a vector of numbers. Similar meanings give similar vectors."""
        ...


class SentenceTransformerEmbedder:
    """Wraps the Sentence Transformers library. The model is loaded on first use, not at start-up."""

    def __init__(self, model_name: str) -> None:
        self.name = model_name
        self._model = None

    def _load(self):
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer

                self._model = SentenceTransformer(self.name)
            except Exception as exc:  # package missing, or no internet for the first download
                raise ServiceUnavailableError(
                    "The AI embedding model could not be loaded. Check the backend logs and the internet "
                    "connection; the model is downloaded the first time it is used."
                ) from exc
        return self._model

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        vectors = self._load().encode(
            texts, normalize_embeddings=True, convert_to_numpy=True, show_progress_bar=False
        )
        return [[float(x) for x in row] for row in vectors]


_embedder: Embedder | None = None


def get_embedder() -> Embedder:
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformerEmbedder(settings.embedding_model)
    return _embedder


def set_embedder(embedder: Embedder | None) -> None:
    """Swap the embedder. Used by tests; passing None goes back to the real model."""
    global _embedder
    _embedder = embedder


def text_hash(model_name: str, text: str) -> str:
    """Identifies one text for one model, so a stored vector is reused only while both are unchanged."""
    return hashlib.sha256(f"{model_name}\n{text}".encode("utf-8")).hexdigest()