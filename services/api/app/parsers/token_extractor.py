"""Rule-based token extraction from Korean text (not ML).

ML-based keyword weighting / branch recommendations remain in adapters (team lead).
"""

from __future__ import annotations

import re
from collections import Counter

HANGUL_TOKEN = re.compile(r"[가-힣]{2,}")
LATIN_TOKEN = re.compile(r"[A-Za-z]{2,}")
DIGIT_TOKEN = re.compile(r"\d{2,}")
_SPLIT = re.compile(r"[\s,.·:;()\[\]{}<>/|「」『』\"'“”]+")

# Trailing particles / endings common in school record prose.
_SUFFIXES = (
    "하였습니다",
    "하였으며",
    "하였고",
    "하였음",
    "하였다",
    "했으며",
    "했고",
    "하기",
    "하는",
    "하여",
    "해서",
    "이며",
    "이고",
    "임",
    "함",
    "음",
    "등",
)
_PARTICLES = ("을", "를", "이", "가", "은", "는", "의", "에", "도", "와", "과", "로", "만", "에서")

# Administrative / layout noise common in school record PDFs.
_STOPWORDS = frozenset(
    {
        "학교",
        "학년",
        "학기",
        "학생",
        "성명",
        "번호",
        "반",
        "담임",
        "교과",
        "과목",
        "단위수",
        "성취도",
        "석차등급",
        "비고",
        "해당",
        "사항",
        "없음",
        "동국대학교",
        "사범대학",
        "부속고등학교",
        "년",
        "월",
        "일",
        "전교생",
        "수강자",
        "참가",
        "대상",
        "인원",
        "구분",
        "명칭",
        "종류",
        "내용",
        "발급기관",
        "영역",
        "시간",
        "특기사항",
        "졸업",
        "입학",
        "대장",
        "기록부",
        "생활",
        "세부",
        "능력",
        "및",
        "종합",
        "의견",
        "상황",
        "발달",
        "원점수",
        "과목평균",
        "표준편차",
        "이수단위",
        "합계",
        "정보",
        "주소",
        "성별",
        "남",
        "여",
        "통해",
        "위해",
        "등을",
        "등의",
        "있는",
        "있어",
        "보임",
        "보이",
        "함께",
        "대한",
        "대해",
        "자신",
        "모습",
        "수업",
        "이용",
        "참여",
        "문제",
        "기술",
    }
)


def _normalize_korean(token: str) -> str:
    word = token
    for suffix in sorted(_SUFFIXES, key=len, reverse=True):
        if word.endswith(suffix) and len(word) - len(suffix) >= 2:
            word = word[: -len(suffix)]
            break
    for particle in _PARTICLES:
        if word.endswith(particle) and len(word) - len(particle) >= 2:
            word = word[: -len(particle)]
            break
    return word if len(word) >= 2 else token


def extract_tokens(text: str) -> list[str]:
    """Return tokens (duplicates allowed) from normalized text."""
    if not text or not text.strip():
        return []

    tokens: list[str] = []
    for chunk in _SPLIT.split(text.strip()):
        if not chunk:
            continue
        for match in HANGUL_TOKEN.finditer(chunk):
            tokens.append(_normalize_korean(match.group(0)))
        for match in LATIN_TOKEN.finditer(chunk):
            tokens.append(match.group(0))
        for match in DIGIT_TOKEN.finditer(chunk):
            tokens.append(match.group(0))
    return tokens


def extract_token_frequencies(
    text: str,
    *,
    min_len: int = 2,
    top_n: int | None = None,
) -> list[tuple[str, int]]:
    """Count token frequencies, drop stopwords, return descending by count."""
    counter: Counter[str] = Counter()
    for token in extract_tokens(text):
        if len(token) < min_len or token in _STOPWORDS:
            continue
        if token.isdigit():
            continue
        counter[token] += 1

    ranked = sorted(counter.items(), key=lambda item: (-item[1], item[0]))
    if top_n is not None:
        return ranked[:top_n]
    return ranked
