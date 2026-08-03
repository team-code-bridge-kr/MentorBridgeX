"""수집 오케스트레이션.

- 소스를 하나씩 돌린다. 한 소스가 실패해도 나머지는 계속 간다.
- 결과를 fetch_logs 에 남긴다 (개인 식별 정보는 넣지 않는다).
- 429/503 등이 3회 누적되면 그 소스를 24시간 쉬게 한다.
- 성공하면 실패 카운터를 리셋하고 ETag/Last-Modified 를 갱신한다.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import (
    SOURCE_ARXIV,
    SOURCE_CROSSREF,
    SOURCE_NEWSAPI,
    SOURCE_RSS,
    ArticleRow,
    FetchLogRow,
    SourceRow,
)
from .arxiv import ArxivFetcher
from .base import FetchedItem, FetchOutcome
from .crossref import CrossrefFetcher
from .newsapi import NewsApiFetcher
from .dedupe import canonical_url, search_text, title_hash
from .http import PoliteClient
from .rss import RssFetcher

logger = logging.getLogger("research.ingest")

MAX_FAILURES_BEFORE_PAUSE = 3
PAUSE_DURATION = timedelta(hours=24)


async def run_ingest(
    session: AsyncSession, *, source_ids: list[str] | None = None
) -> list[FetchLogRow]:
    """활성 소스를 순회하며 수집한다. 소스별 로그 목록을 돌려준다."""
    now = datetime.now(UTC)
    stmt = select(SourceRow).where(
        SourceRow.enabled.is_(True),
        or_(SourceRow.disabled_until.is_(None), SourceRow.disabled_until <= now),
    )
    if source_ids:
        stmt = stmt.where(SourceRow.id.in_(source_ids))
    sources = list((await session.execute(stmt)).scalars().all())

    if not sources:
        return []

    client = PoliteClient()
    fetchers = {
        SOURCE_RSS: RssFetcher(client),
        SOURCE_ARXIV: ArxivFetcher(client),
        SOURCE_CROSSREF: CrossrefFetcher(client),
        SOURCE_NEWSAPI: NewsApiFetcher(client),
    }

    logs: list[FetchLogRow] = []
    try:
        # 도메인별 3초 간격은 PoliteClient 가 보장한다. 소스는 순차로 돌려
        # 전체 부하도 낮게 유지한다 — 소스 수가 수십 개 규모라 충분히 빠르다.
        for source in sources:
            log = await _run_one(session, source, fetchers.get(source.type))
            logs.append(log)
    finally:
        await client.aclose()

    return logs


async def _run_one(
    session: AsyncSession, source: SourceRow, fetcher, /
) -> FetchLogRow:
    started = datetime.now(UTC)
    log = FetchLogRow(
        id=str(uuid4()),
        source_id=source.id,
        started_at=started,
        status="error",
    )

    if fetcher is None:
        log.status = "skipped"
        log.error = f"지원하지 않는 소스 타입: {source.type}"
        log.finished_at = datetime.now(UTC)
        session.add(log)
        await session.commit()
        return log

    try:
        outcome: FetchOutcome = await fetcher.fetch(source)
    except Exception as exc:  # noqa: BLE001 — 한 소스의 예외가 전체 수집을 멈추면 안 된다
        logger.warning("ingest failed source=%s error=%s", source.id, type(exc).__name__)
        outcome = FetchOutcome(status="error", error=f"{type(exc).__name__}: {exc}"[:500])

    log.status = outcome.status
    log.error = outcome.error
    log.items_found = len(outcome.items)

    if outcome.status == "ok":
        log.items_new = await _store_items(session, source, outcome.items)
        source.failure_count = 0
        source.disabled_until = None
        source.last_fetched_at = started
        if outcome.etag:
            source.etag = outcome.etag
        if outcome.last_modified:
            source.last_modified = outcome.last_modified
    elif outcome.status == "not_modified":
        source.failure_count = 0
        source.last_fetched_at = started
    elif outcome.status == "error" and outcome.should_back_off:
        source.failure_count = (source.failure_count or 0) + 1
        if source.failure_count >= MAX_FAILURES_BEFORE_PAUSE:
            source.disabled_until = started + PAUSE_DURATION
            logger.warning(
                "source paused source=%s until=%s", source.id, source.disabled_until.isoformat()
            )

    log.finished_at = datetime.now(UTC)
    session.add(log)
    await session.commit()
    return log


async def _store_items(
    session: AsyncSession, source: SourceRow, items: list[FetchedItem]
) -> int:
    """새 글만 저장하고 저장된 건수를 돌려준다."""
    if not items:
        return 0

    now = datetime.now(UTC)
    rows: list[dict] = []
    seen_urls: set[str] = set()
    seen_titles: set[str] = set()

    for item in items:
        url = canonical_url(item.url)
        thash = title_hash(item.title)
        if url in seen_urls or thash in seen_titles:
            continue  # 같은 응답 안에서의 중복
        seen_urls.add(url)
        seen_titles.add(thash)
        rows.append(
            {
                "id": str(uuid4()),
                "source_id": source.id,
                "url": url,
                "title": item.title,
                "summary": item.summary,
                "author": item.author,
                "outlet": item.outlet or source.outlet or source.name,
                "kind": item.kind,
                "lang": item.lang,
                "image_url": item.image_url,
                # 발행일이 없는 피드가 있다. NULL 을 두면 keyset 커서 비교가
                # NULLS LAST 처리 때문에 복잡해지므로 수집 시각으로 채운다.
                "published_at": item.published_at or now,
                "fetched_at": now,
                "title_hash": thash,
                "search_text": search_text(item.title, item.summary),
            }
        )

    if not rows:
        return 0

    # 이미 같은 제목으로 들어온 글(타 매체 전재)은 건너뛴다
    existing = await session.execute(
        select(ArticleRow.title_hash).where(
            ArticleRow.title_hash.in_([r["title_hash"] for r in rows])
        )
    )
    known_titles = {h for (h,) in existing.all()}
    rows = [r for r in rows if r["title_hash"] not in known_titles]
    if not rows:
        return 0

    # 이미 있는 URL 도 미리 걸러낸다. executemany 는 rowcount 를 주지 않아
    # "몇 건이 새로 들어갔는지" 를 응답에서 알 수 없기 때문이다.
    existing_urls = await session.execute(
        select(ArticleRow.url).where(ArticleRow.url.in_([r["url"] for r in rows]))
    )
    known_urls = {u for (u,) in existing_urls.all()}
    rows = [r for r in rows if r["url"] not in known_urls]
    if not rows:
        return 0

    # on_conflict_do_nothing 은 위 필터와 삽입 사이의 경합을 막는 안전장치로 남긴다
    stmt = pg_insert(ArticleRow).on_conflict_do_nothing(index_elements=[ArticleRow.url])
    await session.execute(stmt, rows)
    await session.commit()
    return len(rows)
