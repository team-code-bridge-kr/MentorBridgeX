"""article_terms 재계산.

TF-IDF 는 코퍼스 전체를 알아야 해서 수집 직후 건건이 계산할 수 없다 (IDF 분모가
미완성이라 점수가 흔들린다). 수집 사이클이 끝난 뒤 배치로 다시 계산한다.

지금은 전체 재계산이다. 기사가 수만 건을 넘어가면 증분으로 바꾸면 되고,
그때 바꿀 곳은 이 함수 하나다.
"""

from __future__ import annotations

import logging

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import ArticleRow, ArticleTermRow
from .base import TermExtractor
from .statistical import StatisticalTermExtractor

logger = logging.getLogger("research.terms")

TOP_K = 5
# 재계산 대상 상한 — 코퍼스가 커져도 배치 한 번이 메모리를 다 먹지 않게
MAX_CORPUS = 20_000


def get_extractor() -> TermExtractor:
    """구현체 선택 지점. LLM/형태소 기반으로 바꾸려면 여기만 손대면 된다."""
    return StatisticalTermExtractor()


async def recompute_terms(session: AsyncSession, *, top_k: int = TOP_K) -> int:
    """전체 기사의 개념을 다시 뽑아 article_terms 를 교체한다. 저장된 행 수를 돌려준다."""
    rows = await session.execute(
        select(ArticleRow.id, ArticleRow.search_text)
        .order_by(ArticleRow.published_at.desc())
        .limit(MAX_CORPUS)
    )
    docs = [(doc_id, text or "") for doc_id, text in rows.all()]
    if not docs:
        return 0

    extracted = get_extractor().extract(docs, top_k=top_k)

    payload = [
        {"article_id": doc_id, "term": term.term, "score": term.score}
        for doc_id, terms in extracted.items()
        for term in terms
    ]

    # 통째로 교체 — 이전 배치에서 나온 낡은 개념이 남지 않게
    await session.execute(
        delete(ArticleTermRow).where(ArticleTermRow.article_id.in_([d[0] for d in docs]))
    )
    if payload:
        await session.execute(
            pg_insert(ArticleTermRow).on_conflict_do_nothing(
                index_elements=[ArticleTermRow.article_id, ArticleTermRow.term]
            ),
            payload,
        )
    await session.commit()
    logger.info("terms recomputed docs=%d terms=%d", len(docs), len(payload))
    return len(payload)
