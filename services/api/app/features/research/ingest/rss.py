"""RSS/Atom 수집기.

RSS 는 보통 요약(description)까지 주므로 그것을 3문장으로 잘라 쓴다.
요약이 비어 있을 때만 원문 페이지에서 본문을 뽑는다 (extract.py) — 그 경우에도
저장하는 건 3문장까지다.
"""

from __future__ import annotations

import calendar
from datetime import UTC, datetime

import feedparser

from ..models import KIND_NEWS, SourceRow
from .base import FetchedItem, FetchOutcome
from .extract import extract_summary
from .http import BackOffRequired, PoliteClient, RobotsDisallowed
from .summarize import strip_html, to_summary

# 한 번에 가져올 최대 건수 — 피드가 120건씩 주는 곳이 있어 상한을 둔다
MAX_ITEMS_PER_FETCH = 60


class RssFetcher:
    def __init__(self, client: PoliteClient, *, enable_extraction: bool = True) -> None:
        self._client = client
        self._enable_extraction = enable_extraction

    async def fetch(self, source: SourceRow) -> FetchOutcome:
        try:
            res = await self._client.get(
                source.url, etag=source.etag, last_modified=source.last_modified
            )
        except RobotsDisallowed as exc:
            return FetchOutcome(status="skipped", error=f"robots.txt: {exc}")
        except BackOffRequired as exc:
            return FetchOutcome(status="error", error=str(exc), should_back_off=True)
        except Exception as exc:  # noqa: BLE001 — 한 소스의 실패가 전체를 막으면 안 된다
            return FetchOutcome(status="error", error=_short(exc))

        if res.not_modified:
            return FetchOutcome(status="not_modified")

        parsed = feedparser.parse(res.text)
        entries = list(parsed.entries or [])[:MAX_ITEMS_PER_FETCH]
        outlet = source.outlet or _feed_title(parsed) or source.name

        items: list[FetchedItem] = []
        for entry in entries:
            item = await self._to_item(entry, source, outlet)
            if item is not None:
                items.append(item)

        return FetchOutcome(
            status="ok",
            items=items,
            etag=res.etag,
            last_modified=res.last_modified,
        )

    async def _to_item(self, entry, source: SourceRow, outlet: str) -> FetchedItem | None:
        url = (getattr(entry, "link", "") or "").strip()
        title = strip_html(getattr(entry, "title", "") or "").strip()
        if not url or not title:
            return None

        raw_summary = (
            getattr(entry, "summary", None)
            or getattr(entry, "description", None)
            or _first_content(entry)
            or ""
        )
        summary = to_summary(raw_summary)

        # RSS 가 요약을 안 줄 때만 원문 페이지를 읽는다. 그래도 3문장까지만 남긴다.
        if not summary and self._enable_extraction:
            summary = await extract_summary(self._client, url)

        return FetchedItem(
            url=url,
            title=title[:500],
            summary=summary,
            author=(getattr(entry, "author", None) or None),
            outlet=outlet[:160],
            kind=KIND_NEWS,
            lang="ko",
            published_at=_published_at(entry),
        )


def _feed_title(parsed) -> str:
    feed = getattr(parsed, "feed", None)
    return strip_html(getattr(feed, "title", "") or "") if feed else ""


def _first_content(entry) -> str:
    content = getattr(entry, "content", None)
    if content and isinstance(content, list) and content:
        return content[0].get("value", "") or ""
    return ""


def _published_at(entry) -> datetime | None:
    for key in ("published_parsed", "updated_parsed"):
        value = getattr(entry, key, None)
        if value:
            return datetime.fromtimestamp(calendar.timegm(value), tz=UTC)
    return None


def _short(exc: Exception) -> str:
    return f"{type(exc).__name__}: {exc}"[:500]
