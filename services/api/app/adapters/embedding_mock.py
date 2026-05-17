import hashlib
import math

from app.adapters.protocols import EmbeddingAdapter

DIM = 1536


def _deterministic_vector(text: str) -> list[float]:
    digest = hashlib.sha256(text.encode()).digest()
    values: list[float] = []
    for i in range(DIM):
        b = digest[i % len(digest)]
        values.append((b / 255.0) * 2 - 1)
    norm = math.sqrt(sum(v * v for v in values)) or 1.0
    return [v / norm for v in values]


class MockEmbeddingAdapter:
    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return [_deterministic_vector(t) for t in texts]
