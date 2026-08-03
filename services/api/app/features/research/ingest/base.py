"""수집기 공통 타입.

소스 타입(rss/arxiv/crossref)마다 Fetcher 구현체를 두고, runner 가 동일하게 다룬다.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Protocol, runtime_checkable

from ..models import SourceRow


@dataclass
class FetchedItem:
    """수집된 글 1건.

    저작권 제약상 본문 필드가 없다. summary 는 여기 담기기 전에 이미
    3문장으로 잘려 있어야 한다 (summarize.to_summary).
    """

    url: str
    title: str
    summary: str = ""
    author: str | None = None
    outlet: str = ""
    kind: str = "news"
    lang: str = "ko"
    published_at: datetime | None = None
    # 대표 이미지 주소. 내려받지 않고 주소만 넘긴다 (models.ArticleRow.image_url 주석)
    image_url: str | None = None


@dataclass
class FetchOutcome:
    """한 소스에 대한 수집 결과."""

    status: str  # ok | not_modified | error | skipped
    items: list[FetchedItem] = field(default_factory=list)
    etag: str | None = None
    last_modified: str | None = None
    error: str | None = None
    # 429/503 처럼 "잠시 물러나야 하는" 실패인지 — failure_count 누적 대상
    should_back_off: bool = False


@runtime_checkable
class Fetcher(Protocol):
    """소스 타입별 수집기."""

    async def fetch(self, source: SourceRow) -> FetchOutcome: ...
