"""sentence-transformers based embedding adapter (Phase 1 — local, no API cost)."""

from __future__ import annotations

import asyncio
import math
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer

_model: "SentenceTransformer | None" = None


def _load_model(model_name: str) -> "SentenceTransformer":
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer  # noqa: PLC0415
        _model = SentenceTransformer(model_name)
    return _model


def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


class SentenceTransformerEmbeddingAdapter:
    def __init__(self, model_name: str = "jhgan/ko-sroberta-multitask") -> None:
        self._model_name = model_name

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        loop = asyncio.get_event_loop()
        model = _load_model(self._model_name)
        result: list[list[float]] = await loop.run_in_executor(
            None,
            lambda: model.encode(texts, convert_to_numpy=True).tolist(),
        )
        return result
