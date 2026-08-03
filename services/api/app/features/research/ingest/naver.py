"""네이버 뉴스 검색 수집기 (NAVER Cloud Platform API HUB).

**엔드포인트를 헷갈리지 말 것.** 같은 "네이버 검색"이라도 두 갈래가 있다.

- 예전 developers.naver.com: ``openapi.naver.com`` + ``X-Naver-Client-Id/Secret``
- 지금 쓰는 NCP API HUB:     ``naverapihub.apigw.ntruss.com`` +
  ``X-NCP-APIGW-API-KEY-ID`` / ``X-NCP-APIGW-API-KEY``

NCP 콘솔에서 발급한 키를 옛 엔드포인트에 보내면 401(errorCode 024) 이 나는데,
메시지가 "인증에 실패했습니다"라 키가 틀린 것처럼 보인다. 실제로는 문이 다르다.

RSS 와 다른 점 두 가지를 여기서 흡수한다.

1. **언론사명이 응답에 없다.** originallink 도메인으로 유추한다.
2. **제목·요약에 <b> 태그와 HTML 엔티티가 섞여 온다.** 검색어 강조 표시다.
   summarize.strip_html 로 걷어낸다.

하루 25,000회. 소스 하나가 한 번에 1요청이라 6시간 주기로도 여유가 크다.
"""

from __future__ import annotations

import json
from datetime import datetime
from email.utils import parsedate_to_datetime
from urllib.parse import urlencode, urlparse

from app.config import get_settings

from ..models import KIND_NEWS, SourceRow
from .base import FetchedItem, FetchOutcome
from .http import BackOffRequired, PoliteClient, RobotsDisallowed
from .summarize import strip_html, to_summary

API_URL = "https://naverapihub.apigw.ntruss.com/search/v1/news"
DISPLAY = 100  # 한 번에 받을 최대 건수 (API 상한)
# 검색어 구분자. 네이버 검색은 **OR 문법을 지원하지 않는다** — "촉매 OR 고분자"를
# 보내면 그 문구 그대로 찾아서 0건이 나온다(실측). 그래서 낱말마다 따로 요청하고
# 여기서 합친다. 하루 25,000회라 소스당 몇 개씩 나눠 보내도 여유가 크다.
TERM_SEP = "|"

# 도메인 → 언론사명. 자주 걸리는 곳만 손으로 넣고 나머지는 도메인을 그대로 쓴다.
# 전 언론사를 표로 관리하려 들면 유지가 안 된다 — 화면에 도메인이 떠도
# 출처를 못 알아보는 것보다는 낫다.
OUTLETS = {
    "yna.co.kr": "연합뉴스", "etnews.com": "전자신문", "hankyung.com": "한국경제",
    "donga.com": "동아일보", "chosun.com": "조선일보", "joongang.co.kr": "중앙일보",
    "hani.co.kr": "한겨레", "khan.co.kr": "경향신문", "seoul.co.kr": "서울신문",
    "mk.co.kr": "매일경제", "sedaily.com": "서울경제", "fnnews.com": "파이낸셜뉴스",
    "edaily.co.kr": "이데일리", "newsis.com": "뉴시스", "news1.kr": "뉴스1",
    "zdnet.co.kr": "ZDNet Korea", "bloter.net": "블로터", "dt.co.kr": "디지털타임스",
    "kbs.co.kr": "KBS", "imbc.com": "MBC", "sbs.co.kr": "SBS", "ytn.co.kr": "YTN",
    "dongascience.com": "동아사이언스", "hellodd.com": "헬로디디",
    "docdocdoc.co.kr": "청년의사", "medigatenews.com": "메디게이트뉴스",
    "kmib.co.kr": "국민일보", "segye.com": "세계일보", "munhwa.com": "문화일보",
    "asiae.co.kr": "아시아경제", "heraldcorp.com": "헤럴드경제",
    # 검색으로 자주 올라오는 곳들 — 실측 상위 도메인을 보고 채웠다
    "newspim.com": "뉴스핌", "mt.co.kr": "머니투데이", "ajunews.com": "아주경제",
    "hankookilbo.com": "한국일보", "nocutnews.co.kr": "노컷뉴스", "etoday.co.kr": "이투데이",
    "gukjenews.com": "국제뉴스", "shinailbo.co.kr": "신아일보", "naeil.com": "내일신문",
    "g-enews.com": "글로벌이코노믹", "viva100.com": "브릿지경제", "m-i.kr": "매일일보",
    "metroseoul.co.kr": "메트로신문", "imaeil.com": "매일신문", "busan.com": "부산일보",
    "ekn.kr": "에너지경제", "enewstoday.co.kr": "이뉴스투데이", "hankooki.com": "한국일보",
    "sentv.co.kr": "서울경제TV", "ccdailynews.com": "충청일보", "kmaeil.com": "경기매일",
    "womaneconomy.co.kr": "여성경제신문", "medigatenews.com": "메디게이트뉴스",
}


def outlet_of(url: str) -> str:
    """originallink 도메인에서 언론사명을 고른다. 모르면 도메인 그대로."""
    host = urlparse(url).netloc.lower().removeprefix("www.")
    for domain, name in OUTLETS.items():
        if host == domain or host.endswith("." + domain):
            return name
    return host or "네이버 뉴스"


class NaverNewsFetcher:
    def __init__(self, client: PoliteClient) -> None:
        self._client = client

    async def fetch(self, source: SourceRow) -> FetchOutcome:
        settings = get_settings()
        if not settings.naver_client_id or not settings.naver_client_secret:
            return FetchOutcome(status="skipped", error="NAVER_CLIENT_ID/SECRET 이 없습니다")

        terms = [t.strip() for t in (source.query or "").split(TERM_SEP) if t.strip()]
        if not terms:
            return FetchOutcome(status="skipped", error="naver 소스에 query(검색어)가 없습니다")

        headers = {
            "X-NCP-APIGW-API-KEY-ID": settings.naver_client_id,
            "X-NCP-APIGW-API-KEY": settings.naver_client_secret,
        }

        raw_items: list[dict] = []
        errors: list[str] = []
        for term in terms:
            url = f"{API_URL}?" + urlencode(
                {"query": term, "display": DISPLAY, "start": 1, "sort": "date", "format": "json"}
            )
            try:
                res = await self._client.get(url, headers=headers)
            except RobotsDisallowed as exc:
                return FetchOutcome(status="skipped", error=f"robots.txt: {exc}")
            except BackOffRequired as exc:
                return FetchOutcome(status="error", error=str(exc), should_back_off=True)
            except Exception as exc:  # noqa: BLE001
                errors.append(f"{term}: {type(exc).__name__}")
                continue

            try:
                payload = json.loads(res.text)
            except json.JSONDecodeError:
                errors.append(f"{term}: JSON 파싱 실패")
                continue
            if "items" not in payload:
                errors.append(f"{term}: {payload.get('errorMessage') or 'items 없음'}")
                continue
            raw_items.extend(payload["items"])

        # 검색어가 여러 개면 같은 기사가 겹친다 — 여기서 한 번 걸러 둔다
        # (runner 도 URL 중복을 막지만, 같은 배치 안의 중복은 여기가 먼저다)
        if not raw_items and errors:
            return FetchOutcome(status="error", error="; ".join(errors)[:500])

        seen: set[str] = set()
        items: list[FetchedItem] = []
        for it in raw_items:
            # 원 매체 주소를 쓴다. link 는 네이버 뉴스 안쪽 주소라, 학생이 원문을
            # 확인하고 출처를 인용하는 데는 originallink 가 맞다.
            link = (it.get("originallink") or it.get("link") or "").strip()
            title = strip_html(it.get("title") or "").strip()
            if not link or not title or link in seen:
                continue
            seen.add(link)
            items.append(
                FetchedItem(
                    url=link,
                    title=title[:500],
                    summary=to_summary(strip_html(it.get("description") or "")),
                    outlet=outlet_of(link)[:160],
                    kind=KIND_NEWS,
                    lang="ko",
                    published_at=_published_at(it.get("pubDate")),
                )
            )

        return FetchOutcome(status="ok", items=items)


def _published_at(raw: str | None) -> datetime | None:
    """RFC 2822 형식(예: 'Mon, 03 Aug 2026 15:03:00 +0900')."""
    if not raw:
        return None
    try:
        return parsedate_to_datetime(raw)
    except (TypeError, ValueError):
        return None
