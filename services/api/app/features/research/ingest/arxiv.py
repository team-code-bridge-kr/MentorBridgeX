"""arXiv 공식 API 수집기 (스크래핑 아님).

http://export.arxiv.org/api/query 는 Atom 을 돌려주므로 feedparser 로 파싱한다.
arXiv 는 요청 간 3초 간격을 요구하는데, PoliteClient 가 도메인 단위로 이미 지킨다.

source.query 에 검색식을 넣는다 — 보통 `cat:cs.LG` 같은 카테고리.
"""

from __future__ import annotations

import calendar
from datetime import UTC, datetime
from urllib.parse import urlencode

import feedparser

from ..models import KIND_PAPER, SourceRow
from .base import FetchedItem, FetchOutcome
from .http import BackOffRequired, PoliteClient, RobotsDisallowed
from .summarize import strip_html, to_summary

API_URL = "http://export.arxiv.org/api/query"
MAX_RESULTS = 40


class ArxivFetcher:
    def __init__(self, client: PoliteClient) -> None:
        self._client = client

    async def fetch(self, source: SourceRow) -> FetchOutcome:
        query = (source.query or "").strip()
        if not query:
            return FetchOutcome(status="skipped", error="arxiv 소스에 query(카테고리)가 없습니다")

        url = f"{API_URL}?" + urlencode(
            {
                "search_query": query,
                "sortBy": "submittedDate",
                "sortOrder": "descending",
                "start": 0,
                "max_results": MAX_RESULTS,
            }
        )

        try:
            res = await self._client.get(url)
        except RobotsDisallowed as exc:
            return FetchOutcome(status="skipped", error=f"robots.txt: {exc}")
        except BackOffRequired as exc:
            return FetchOutcome(status="error", error=str(exc), should_back_off=True)
        except Exception as exc:  # noqa: BLE001
            return FetchOutcome(status="error", error=f"{type(exc).__name__}: {exc}"[:500])

        parsed = feedparser.parse(res.text)
        items: list[FetchedItem] = []
        for entry in list(parsed.entries or []):
            link = (getattr(entry, "link", "") or "").strip()
            title = strip_html(getattr(entry, "title", "") or "")
            if not link or not title:
                continue
            authors = getattr(entry, "authors", None) or []
            author = ", ".join(a.get("name", "") for a in authors if a.get("name"))[:300]
            items.append(
                FetchedItem(
                    url=link,
                    title=title[:500],
                    summary=to_summary(getattr(entry, "summary", "") or ""),
                    author=author or None,
                    outlet="arXiv",
                    kind=KIND_PAPER,
                    lang="en",
                    published_at=_published_at(entry),
                )
            )

        # arXiv 는 조건부 요청을 지원하지 않으므로 ETag 를 저장하지 않는다
        return FetchOutcome(status="ok", items=items)


def _published_at(entry) -> datetime | None:
    for key in ("published_parsed", "updated_parsed"):
        value = getattr(entry, key, None)
        if value:
            return datetime.fromtimestamp(calendar.timegm(value), tz=UTC)
    return None
