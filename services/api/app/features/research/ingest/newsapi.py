"""NewsAPI.org 수집기 (선택 소스 — 기본 꺼짐).

**요금제를 먼저 확인할 것.** 2026-08 기준 공식 안내:

- Developer($0): 하루 100요청, **기사 24시간 지연**, 그리고
  "may be used for development and testing in a development environment only,
  and cannot be used in a staging or production environment (including internally)"
  → 지금 운영 중인 mbx.teamcodebridge.dev 에는 **무료 플랜을 쓸 수 없다.**
- Business($449/월): 실시간, 월 25만 요청.

그래서 이 수집기는 만들어만 두고 seed 에서 enabled=False 로 넣는다.
NEWSAPI_KEY 가 비어 있으면 소스를 건너뛴다(스킵 로그만 남는다).

source.query 에 검색어를 넣는다 (예: "반도체 OR 인공지능").
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from urllib.parse import urlencode

from app.config import get_settings

from ..models import KIND_NEWS, SourceRow
from .base import FetchedItem, FetchOutcome
from .http import BackOffRequired, PoliteClient, RobotsDisallowed
from .summarize import strip_html, to_summary

API_URL = "https://newsapi.org/v2/everything"
PAGE_SIZE = 50


class NewsApiFetcher:
    def __init__(self, client: PoliteClient) -> None:
        self._client = client

    async def fetch(self, source: SourceRow) -> FetchOutcome:
        key = get_settings().newsapi_key
        if not key:
            return FetchOutcome(status="skipped", error="NEWSAPI_KEY 가 없습니다")

        query = (source.query or "").strip()
        if not query:
            return FetchOutcome(status="skipped", error="newsapi 소스에 query(검색어)가 없습니다")

        url = f"{API_URL}?" + urlencode(
            {
                "q": query,
                "language": source.url or "ko",  # url 칸을 언어 코드로 쓴다
                "sortBy": "publishedAt",
                "pageSize": PAGE_SIZE,
                "apiKey": key,
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
        except json.JSONDecodeError:
            return FetchOutcome(status="error", error="JSON 파싱 실패")

        if payload.get("status") != "ok":
            # 요청 한도 초과(rateLimited)면 물러난다 — 하루 100회짜리 플랜이라 흔하다
            code = payload.get("code", "")
            return FetchOutcome(
                status="error",
                error=f"newsapi {code}: {payload.get('message', '')}"[:500],
                should_back_off=code in {"rateLimited", "maximumResultsReached"},
            )

        items: list[FetchedItem] = []
        for a in payload.get("articles", []) or []:
            url_ = (a.get("url") or "").strip()
            title = strip_html(a.get("title") or "").strip()
            if not url_ or not title:
                continue
            # description 은 이미 짧지만, 저장 규칙(3문장·400자)은 여기서도 똑같이 건다
            summary = to_summary(strip_html(a.get("description") or ""))
            image = (a.get("urlToImage") or "").strip() or None
            items.append(
                FetchedItem(
                    url=url_,
                    title=title[:500],
                    summary=summary,
                    author=(a.get("author") or None),
                    outlet=((a.get("source") or {}).get("name") or source.outlet)[:160],
                    kind=KIND_NEWS,
                    lang="ko",
                    published_at=_published_at(a.get("publishedAt")),
                    image_url=image if image and len(image) <= 700 else None,
                )
            )

        return FetchOutcome(status="ok", items=items)


def _published_at(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(UTC)
    except ValueError:
        return None
