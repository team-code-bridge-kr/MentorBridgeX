"""중복 제거.

두 갈래로 막는다:
1. URL 정규화 후 unique 제약 — 같은 글의 추적 파라미터 변형을 하나로 본다
2. 제목 해시 — 통신사 기사를 여러 매체가 전재하는 경우 URL 이 달라도 걸러낸다
"""

from __future__ import annotations

import hashlib
import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

# 광고·유입 추적용 — 글의 내용과 무관하므로 정규화 단계에서 버린다
TRACKING_PREFIXES = ("utm_", "pk_", "ito", "at_")
TRACKING_KEYS = {
    "fbclid",
    "gclid",
    "igshid",
    "ref",
    "referrer",
    "source",
    "spm",
    "cmpid",
    "mkt_tok",
}

_NON_WORD_RE = re.compile(r"[^0-9a-z가-힣]+")


def canonical_url(url: str) -> str:
    parts = urlsplit(url.strip())
    scheme = (parts.scheme or "https").lower()
    netloc = parts.netloc.lower()
    if netloc.startswith("www."):
        netloc = netloc[4:]
    if (scheme == "https" and netloc.endswith(":443")) or (
        scheme == "http" and netloc.endswith(":80")
    ):
        netloc = netloc.rsplit(":", 1)[0]

    kept = [
        (k, v)
        for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if k.lower() not in TRACKING_KEYS and not k.lower().startswith(TRACKING_PREFIXES)
    ]
    query = urlencode(sorted(kept))

    path = parts.path.rstrip("/") or "/"
    return urlunsplit((scheme, netloc, path, query, ""))  # fragment 제거


def title_hash(title: str) -> str:
    """공백·기호·대소문자를 무시한 제목 지문."""
    normalized = _NON_WORD_RE.sub("", title.lower())
    return hashlib.sha1(normalized.encode("utf-8")).hexdigest()[:40]


def search_text(title: str, summary: str) -> str:
    """pg_trgm 매칭 대상. lower() 를 매 쿼리마다 돌리지 않으려고 미리 만들어 둔다."""
    return f"{title} {summary}".lower().strip()
