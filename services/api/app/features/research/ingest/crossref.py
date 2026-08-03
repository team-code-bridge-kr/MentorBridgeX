"""Crossref REST API 수집기 (공식 API, 스크래핑 아님).

전 분야 논문 메타데이터를 DOI 기준으로 준다. arXiv 가 못 덮는 인문·사회·의약 쪽에 쓴다.
Crossref 는 연락처를 밝히면 polite pool 로 라우팅하므로 mailto 를 붙인다.

source.query 에 검색어를 넣는다 (예: "climate change adaptation").
초록(abstract)은 JATS XML 조각이라 태그를 걷어내고 3문장으로 자른다.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime

from ..models import KIND_PAPER, SourceRow
from .base import FetchedItem, FetchOutcome
from .http import BackOffRequired, PoliteClient, RobotsDisallowed
from .summarize import strip_html, to_summary

API_URL = "https://api.crossref.org/works"
CONTACT_EMAIL = "mbx@teamcodebridge.dev"
ROWS = 30


class CrossrefFetcher:
    def __init__(self, client: PoliteClient) -> None:
        self._client = client

    async def fetch(self, source: SourceRow) -> FetchOutcome:
        query = (source.query or "").strip()
        if not query:
            return FetchOutcome(status="skipped", error="crossref 소스에 query(검색어)가 없습니다")

        from urllib.parse import urlencode

        url = f"{API_URL}?" + urlencode(
            {
                "query.bibliographic": query,
                "sort": "published",
                "order": "desc",
                "rows": ROWS,
                "select": "DOI,title,abstract,author,container-title,URL,published,type",
                "mailto": CONTACT_EMAIL,
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

        try:
            payload = json.loads(res.text)
        except json.JSONDecodeError as exc:
            return FetchOutcome(status="error", error=f"JSON 파싱 실패: {exc}"[:500])

        entries = (payload.get("message") or {}).get("items") or []
        items: list[FetchedItem] = []
        for entry in entries:
            item = _to_item(entry)
            if item is not None:
                items.append(item)

        return FetchOutcome(status="ok", items=items)


def _to_item(entry: dict) -> FetchedItem | None:
    title = strip_html(_first(entry.get("title")))
    url = (entry.get("URL") or "").strip()
    if not title or not url:
        return None

    authors = entry.get("author") or []
    names = [
        " ".join(p for p in (a.get("given"), a.get("family")) if p)
        for a in authors
        if isinstance(a, dict)
    ]
    author = ", ".join(n for n in names if n)[:300]

    return FetchedItem(
        url=url,
        title=title[:500],
        summary=to_summary(entry.get("abstract") or ""),
        author=author or None,
        outlet=strip_html(_first(entry.get("container-title")))[:160] or "Crossref",
        kind=KIND_PAPER,
        lang="en",
        published_at=_published_at(entry),
    )


def _first(value) -> str:
    if isinstance(value, list):
        return str(value[0]) if value else ""
    return str(value or "")


def _published_at(entry: dict) -> datetime | None:
    parts = ((entry.get("published") or {}).get("date-parts") or [[]])[0]
    if not parts:
        return None
    year = parts[0] if len(parts) > 0 else None
    if not year:
        return None
    month = parts[1] if len(parts) > 1 else 1
    day = parts[2] if len(parts) > 2 else 1
    try:
        return datetime(int(year), int(month), int(day), tzinfo=UTC)
    except (TypeError, ValueError):
        return None
