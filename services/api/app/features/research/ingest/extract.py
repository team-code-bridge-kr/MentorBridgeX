"""원문 페이지에서 요약 뽑기 — RSS 가 요약을 주지 않을 때만 쓰는 보조 경로.

trafilatura 로 본문을 추출하되, **반환 전에 3문장으로 자른다.** 호출부가 실수로
전문을 저장할 수 없도록 이 모듈은 전문을 절대 내보내지 않는다.

trafilatura 는 선택 의존성이다. 없으면 조용히 빈 문자열을 돌려주고,
그 글은 요약 없이 제목+링크만으로 저장된다.
"""

from __future__ import annotations

from .http import PoliteClient
from .summarize import to_summary

try:  # pragma: no cover - 설치 여부에 따라 갈린다
    import trafilatura
except ImportError:  # pragma: no cover
    trafilatura = None  # type: ignore[assignment]


async def extract_summary(client: PoliteClient, url: str) -> str:
    """원문에서 요약 3문장을 뽑는다. 실패하면 빈 문자열."""
    if trafilatura is None:
        return ""
    try:
        res = await client.get(url)
    except Exception:  # noqa: BLE001 — 요약은 있으면 좋은 것이지 필수가 아니다
        return ""
    if not res.text:
        return ""

    try:
        body = trafilatura.extract(
            res.text,
            include_comments=False,
            include_tables=False,
            favor_precision=True,
        )
    except Exception:  # noqa: BLE001
        return ""
    return to_summary(body or "")
