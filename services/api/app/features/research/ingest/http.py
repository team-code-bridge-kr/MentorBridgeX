"""크롤링 예절을 지키는 HTTP 클라이언트.

지키는 것:
- robots.txt 확인 후 요청 (stdlib urllib.robotparser, 결과는 메모리 캐시)
- 같은 도메인에 최소 3초 간격, 동시 요청 1개 (도메인별 락)
- User-Agent 에 서비스명과 연락처 URL 명시
- 조건부 요청(If-None-Match / If-Modified-Since)으로 중복 다운로드 방지
- 타임아웃 + 429/503/네트워크 오류에 지수 백오프 재시도 (최대 3회)
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

import httpx

UA_TOKEN = "MentorBridgeX-Bot"
# HTTP 헤더는 latin-1 만 담을 수 있다 — 한글을 넣으면 UnicodeEncodeError 가 난다.
USER_AGENT = (
    f"{UA_TOKEN}/0.1 (+https://mbx.teamcodebridge.dev/about/bot; "
    "contact: mbx@teamcodebridge.dev) student research feed reader; "
    "stores title, short summary and link only"
)

MIN_INTERVAL_SEC = 3.0
MAX_ATTEMPTS = 3
BACKOFF_BASE_SEC = 2.0
ROBOTS_TTL_SEC = 6 * 3600
# 백오프 대상 — 서버가 "지금은 곤란하다"고 말하는 상태
BACKOFF_STATUSES = {429, 500, 502, 503, 504}


class RobotsDisallowed(Exception):
    """robots.txt 가 해당 URL 수집을 막고 있음."""


class BackOffRequired(Exception):
    """429/503 등 — 소스를 잠시 쉬게 해야 하는 실패."""


@dataclass
class HttpResult:
    status: int
    text: str = ""
    etag: str | None = None
    last_modified: str | None = None
    not_modified: bool = False


class PoliteClient:
    """도메인별로 직렬화·간격 유지하는 httpx 래퍼."""

    def __init__(self, timeout: float = 20.0, min_interval: float = MIN_INTERVAL_SEC) -> None:
        self._timeout = timeout
        self._min_interval = min_interval
        self._client = httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=True,
            headers={"User-Agent": USER_AGENT},
        )
        self._locks: dict[str, asyncio.Lock] = {}
        self._last_call: dict[str, float] = {}
        self._robots: dict[str, tuple[RobotFileParser | None, float]] = {}

    async def aclose(self) -> None:
        await self._client.aclose()

    def _lock_for(self, host: str) -> asyncio.Lock:
        if host not in self._locks:
            self._locks[host] = asyncio.Lock()
        return self._locks[host]

    async def _respect_interval(self, host: str) -> None:
        last = self._last_call.get(host)
        if last is not None:
            wait = self._min_interval - (time.monotonic() - last)
            if wait > 0:
                await asyncio.sleep(wait)
        self._last_call[host] = time.monotonic()

    async def _robots_for(self, scheme: str, host: str) -> RobotFileParser | None:
        cached = self._robots.get(host)
        if cached and (time.monotonic() - cached[1]) < ROBOTS_TTL_SEC:
            return cached[0]

        parser: RobotFileParser | None = None
        try:
            res = await self._client.get(f"{scheme}://{host}/robots.txt", timeout=10.0)
            if res.status_code == 200 and "html" not in res.headers.get("content-type", ""):
                parser = RobotFileParser()
                parser.parse(res.text.splitlines())
            # 404/500 등은 "제한 없음"으로 본다 (표준 동작)
        except httpx.HTTPError:
            parser = None
        self._robots[host] = (parser, time.monotonic())
        return parser

    async def get(
        self,
        url: str,
        *,
        etag: str | None = None,
        last_modified: str | None = None,
    ) -> HttpResult:
        parts = urlsplit(url)
        host = parts.netloc
        scheme = parts.scheme or "https"

        async with self._lock_for(host):  # 동시 요청 1개
            robots = await self._robots_for(scheme, host)
            if robots is not None and not robots.can_fetch(UA_TOKEN, url):
                raise RobotsDisallowed(f"robots.txt disallows {parts.path or '/'}")

            headers: dict[str, str] = {}
            if etag:
                headers["If-None-Match"] = etag
            if last_modified:
                headers["If-Modified-Since"] = last_modified

            last_error: Exception | None = None
            for attempt in range(MAX_ATTEMPTS):
                await self._respect_interval(host)
                try:
                    res = await self._client.get(url, headers=headers)
                except httpx.HTTPError as exc:
                    last_error = exc
                else:
                    if res.status_code == 304:
                        return HttpResult(status=304, not_modified=True)
                    if res.status_code in BACKOFF_STATUSES:
                        last_error = BackOffRequired(f"HTTP {res.status_code}")
                        retry_after = _retry_after_seconds(res)
                        if retry_after is not None and attempt < MAX_ATTEMPTS - 1:
                            await asyncio.sleep(min(retry_after, 30.0))
                            continue
                    elif res.status_code >= 400:
                        # 4xx 는 재시도해도 달라지지 않는다
                        raise httpx.HTTPStatusError(
                            f"HTTP {res.status_code}", request=res.request, response=res
                        )
                    else:
                        return HttpResult(
                            status=res.status_code,
                            text=res.text,
                            etag=res.headers.get("ETag"),
                            last_modified=res.headers.get("Last-Modified"),
                        )

                if attempt < MAX_ATTEMPTS - 1:
                    await asyncio.sleep(BACKOFF_BASE_SEC**attempt)

            if isinstance(last_error, BackOffRequired):
                raise last_error
            raise BackOffRequired(str(last_error) if last_error else "요청 실패")


def _retry_after_seconds(res: httpx.Response) -> float | None:
    raw = res.headers.get("Retry-After")
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError:
        return None  # HTTP-date 형식은 무시하고 기본 백오프를 쓴다
