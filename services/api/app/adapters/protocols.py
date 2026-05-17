from typing import Protocol

from app.schemas.graph import GraphSnapshot, NodeType
from app.schemas.recommendations import SuggestedKeyword


class EmbeddingAdapter(Protocol):
    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        ...


class MLAdapter(Protocol):
    async def suggest_branch_keywords(
        self,
        *,
        user_id: str,
        seeds: list[str],
        graph: GraphSnapshot,
        retrieval_labels: list[str],
        max_results: int,
    ) -> list[SuggestedKeyword]:
        ...

    async def extract_keywords_from_text(
        self,
        *,
        user_id: str,
        text: str,
    ) -> list[tuple[str, NodeType]]:
        ...
