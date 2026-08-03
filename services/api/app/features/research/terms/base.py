"""개념 추출 인터페이스.

지금 구현체는 LLM 없이 순수 통계(n-gram + 불용어 + TF-IDF)다.
나중에 형태소 분석기나 LLM 기반으로 갈아끼울 수 있도록 이 프로토콜 뒤에 둔다.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable


@dataclass(frozen=True)
class ExtractedTerm:
    term: str
    score: float


@runtime_checkable
class TermExtractor(Protocol):
    def extract(
        self, docs: list[tuple[str, str]], *, top_k: int = 5
    ) -> dict[str, list[ExtractedTerm]]:
        """(문서id, 텍스트) 목록 → 문서별 상위 개념.

        TF-IDF 는 코퍼스 전체를 알아야 하므로 문서 하나가 아니라 묶음을 받는다.
        """
        ...
