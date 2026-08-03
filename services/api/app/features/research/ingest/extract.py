"""원문 페이지에서 요약·대표 이미지 뽑기.

trafilatura 로 본문을 추출하되, **반환 전에 3문장으로 자른다.** 호출부가 실수로
전문을 저장할 수 없도록 이 모듈은 전문을 절대 내보내지 않는다.

대표 이미지는 og:image 메타 태그에서 **주소만** 읽는다. 이미지를 내려받지도
저장하지도 않는다 — 화면에서 원 매체 서버에 직접 붙는다. og:image 는 매체가
"링크를 공유하면 이 그림을 보여달라"고 스스로 붙여 둔 값이라, 제목·출처·원문
링크를 함께 보여주는 우리 화면의 쓰임과 어긋나지 않는다.

요약과 이미지를 **한 번의 요청에서 함께** 뽑는다. 이미지 때문에 같은 페이지를
두 번 받으면 상대 서버에 두 배의 부담을 준다.

trafilatura 는 선택 의존성이다. 없으면 요약은 비고 이미지만 나온다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urljoin

from .http import PoliteClient
from .summarize import to_summary

try:  # pragma: no cover - 설치 여부에 따라 갈린다
    import trafilatura
except ImportError:  # pragma: no cover
    trafilatura = None  # type: ignore[assignment]

# <meta property="og:image" content="..."> — 속성 순서가 뒤바뀐 경우까지 본다.
# 정식 파서를 붙이지 않는 이유: 이 한 값을 위해 의존성을 늘릴 이유가 없고,
# 실패하면 그냥 이미지 없이 넘어가면 되는 부가 정보다.
_OG_PATTERNS = (
    re.compile(
        r"<meta[^>]+(?:property|name)\s*=\s*[\"'](?:og:image(?::url)?|twitter:image)[\"'][^>]*"
        r"content\s*=\s*[\"']([^\"']+)[\"']",
        re.I,
    ),
    re.compile(
        r"<meta[^>]+content\s*=\s*[\"']([^\"']+)[\"'][^>]*"
        r"(?:property|name)\s*=\s*[\"'](?:og:image(?::url)?|twitter:image)[\"']",
        re.I,
    ),
)

MAX_IMAGE_URL = 700


@dataclass
class PageInfo:
    summary: str = ""
    image_url: str | None = None


def find_og_image(html: str, base_url: str) -> str | None:
    """og:image 주소를 찾아 절대 주소로 만든다. 없으면 None."""
    for pattern in _OG_PATTERNS:
        m = pattern.search(html)
        if not m:
            continue
        raw = m.group(1).strip()
        if not raw:
            continue
        url = urljoin(base_url, raw)
        # data: URI 는 통째로 이미지를 품고 있어 사실상 저장이 된다 — 받지 않는다
        if not url.startswith(("http://", "https://")) or len(url) > MAX_IMAGE_URL:
            continue
        return url
    return None


async def extract_page(client: PoliteClient, url: str, *, want_summary: bool = True) -> PageInfo:
    """원문 페이지를 한 번 받아 요약 3문장과 대표 이미지를 함께 돌려준다."""
    try:
        res = await client.get(url)
    except Exception:  # noqa: BLE001 — 둘 다 있으면 좋은 것이지 필수가 아니다
        return PageInfo()
    if not res.text:
        return PageInfo()

    summary = ""
    if want_summary and trafilatura is not None:
        try:
            body = trafilatura.extract(
                res.text,
                include_comments=False,
                include_tables=False,
                favor_precision=True,
            )
            summary = to_summary(body or "")
        except Exception:  # noqa: BLE001
            summary = ""

    return PageInfo(summary=summary, image_url=find_og_image(res.text, url))
