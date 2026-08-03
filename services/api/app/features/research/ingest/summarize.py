"""요약 정규화 — 저작권 제약을 코드로 강제하는 지점.

기사 전문은 어떤 경로로도 DB 에 들어가면 안 된다. 화면에서 자르는 게 아니라
**저장 직전에** 3문장으로 잘라서, 모델에 본문 컬럼 자체가 없도록 했다.
"""

from __future__ import annotations

import html
import re

MAX_SENTENCES = 3
MAX_CHARS = 400

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")
# 한국어는 "…했다." 처럼 마침표로 끝나고, 영어 논문 초록은 ". " 로 끊긴다.
_SENT_RE = re.compile(r"(?<=[.!?。？！])\s+")


def strip_html(raw: str) -> str:
    if not raw:
        return ""
    text = _TAG_RE.sub(" ", raw)
    text = html.unescape(text)
    return _WS_RE.sub(" ", text).strip()


def to_summary(raw: str, *, max_sentences: int = MAX_SENTENCES) -> str:
    """HTML 제거 → 앞 3문장 → 길이 상한. 결과는 그대로 DB 에 넣어도 안전하다."""
    text = strip_html(raw)
    if not text:
        return ""

    sentences = [s.strip() for s in _SENT_RE.split(text) if s.strip()]
    summary = " ".join(sentences[:max_sentences]) if sentences else text

    if len(summary) > MAX_CHARS:
        # 문장 경계가 없는 긴 덩어리 — 단어 경계에서 자르고 말줄임
        cut = summary[:MAX_CHARS]
        space = cut.rfind(" ")
        summary = (cut[:space] if space > MAX_CHARS * 0.6 else cut).rstrip() + "…"
    return summary
