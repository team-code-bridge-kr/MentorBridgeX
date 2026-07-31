from typing import Protocol

from app.schemas.graph import GraphSnapshot, NodeType
from app.schemas.recommendations import SuggestedKeyword
from app.services.llm_usage import LLMUsage


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

    # ── 가지치기 추천 ─────────────────────────────────────────────────────────

    @property
    def model(self) -> str:
        """추천 결과에 어떤 모델이 쓰였는지 기록하기 위한 식별자."""
        ...

    async def recommend_pruning(self, *, context: dict) -> tuple[list[dict], LLMUsage]:
        """1단계: 온톨로지 컨텍스트만으로 추천 3개. 웹 도구를 등록하지 않는다."""
        ...

    async def find_research_sources(
        self,
        *,
        grade: str,
        topic: str,
        activity: str,
        subjects: list[str],
    ) -> tuple[dict, LLMUsage]:
        """2단계: 학생이 '관련 자료 찾기'를 눌렀을 때만 웹 도구를 붙여 호출한다."""
        ...
