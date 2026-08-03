"""통계 기반 개념 추출 — LLM 호출 없음.

절차:
1. 제목+요약을 어절로 쪼개고 한국어는 조사를 깎아낸다 (형태소 분석기 없이)
2. 불용어를 거르고, 인접 어절 bigram 까지 후보에 넣는다
   ("반도체 수출" 처럼 두 어절로 된 개념을 잡기 위함)
3. 코퍼스 전체 기준 TF-IDF 로 점수화
4. 문서별 상위 K개를 돌려준다

정확도보다 의존성 없음·설명 가능함을 택했다. 교체 지점은 TermExtractor 다.
"""

from __future__ import annotations

import math
import re
from collections import Counter, defaultdict

from .base import ExtractedTerm
from .stopwords import (
    EN_STOPWORDS,
    GENERIC_TOKENS,
    JOSA_SUFFIXES,
    KO_STOPWORDS,
    MODIFIER_SUFFIXES,
    VERB_ENDINGS,
)

_TOKEN_RE = re.compile(r"[0-9A-Za-z가-힣]+")
_HANGUL_RE = re.compile(r"[가-힣]")

MIN_KO_LEN = 2
MIN_EN_LEN = 3
MAX_TERM_LEN = 30


def specificity(term: str) -> float:
    """짧은 말일수록 개념이 아닐 확률이 높다 — 점수에 곱하는 가중치.

    "투자"·"확보" 같은 2글자 일반어가 TF-IDF 만으로는 "정밀의료"보다 위로 올라온다.
    형태소 분석기가 없으니 길이를 특이도의 대리 지표로 쓴다.
    """
    if " " in term:  # bigram — 두 어절이 붙었다는 것 자체가 구체성의 신호
        return 1.2
    length = len(term)
    if length >= 5:
        return 1.15
    if length == 4:
        return 1.0
    if length == 3:
        return 0.8
    return 0.4
# 코퍼스의 이 비율을 넘게 등장하면 변별력이 없다고 보고 버린다
MAX_DF_RATIO = 0.3
MIN_DF = 2


def _strip_josa(token: str) -> str:
    """어절 끝의 조사를 깎아낸다. 깎고 나서 너무 짧아지면 원형을 유지한다."""
    for suffix in JOSA_SUFFIXES:
        if token.endswith(suffix) and len(token) - len(suffix) >= MIN_KO_LEN:
            return token[: -len(suffix)]
    return token


def _is_korean(token: str) -> bool:
    return bool(_HANGUL_RE.search(token))


def _is_predicate(token: str) -> bool:
    """서술어·수식어 판정. 어간을 남겨도 명사가 아니라 통째로 버린다."""
    if token.endswith(VERB_ENDINGS) or token.endswith(MODIFIER_SUFFIXES):
        return True
    # "협력해"·"활용해" 같은 연결형. 2글자("이해"·"분해")는 명사일 수 있어 남긴다.
    return len(token) >= 3 and token.endswith(("해", "돼", "며", "면"))


def _normalize(token: str) -> str | None:
    if _is_korean(token):
        # 조사를 깎기 전후 양쪽에서 검사한다. "선제적으로" 는 깎아야 "선제적"이 드러난다.
        if _is_predicate(token):
            return None
        token = _strip_josa(token)
        if _is_predicate(token) or len(token) < MIN_KO_LEN or token in KO_STOPWORDS:
            return None
    else:
        token = token.lower()
        if len(token) < MIN_EN_LEN or token in EN_STOPWORDS or token.isdigit():
            return None
    if token in GENERIC_TOKENS or len(token) > MAX_TERM_LEN:
        return None
    return token


def candidate_terms(text: str) -> list[str]:
    """단일 어절 + 인접 bigram 후보."""
    raw = _TOKEN_RE.findall(text or "")
    unigrams = [t for t in (_normalize(tok) for tok in raw) if t]

    terms = list(unigrams)
    # bigram 은 같은 언어끼리만 묶는다 (한글+영어 혼합은 개념이 아니라 우연이다)
    for left, right in zip(unigrams, unigrams[1:], strict=False):
        if _is_korean(left) == _is_korean(right):
            bigram = f"{left} {right}"
            if len(bigram) <= MAX_TERM_LEN:
                terms.append(bigram)
    return terms


class StatisticalTermExtractor:
    """TF-IDF 기반 구현체."""

    def extract(
        self, docs: list[tuple[str, str]], *, top_k: int = 5
    ) -> dict[str, list[ExtractedTerm]]:
        if not docs:
            return {}

        per_doc: dict[str, Counter[str]] = {}
        df: dict[str, int] = defaultdict(int)

        for doc_id, text in docs:
            counts = Counter(candidate_terms(text))
            per_doc[doc_id] = counts
            for term in counts:
                df[term] += 1

        total = len(docs)
        max_df = max(MIN_DF, int(total * MAX_DF_RATIO))

        result: dict[str, list[ExtractedTerm]] = {}
        for doc_id, counts in per_doc.items():
            if not counts:
                result[doc_id] = []
                continue
            peak = max(counts.values())
            scored: list[ExtractedTerm] = []
            for term, tf in counts.items():
                doc_freq = df[term]
                # 한 문서에만 나오는 말은 오타·고유명사일 확률이 높고,
                # 너무 흔한 말은 변별력이 없다. 양쪽을 다 자른다.
                if doc_freq < MIN_DF or doc_freq > max_df:
                    continue
                tf_norm = 0.5 + 0.5 * (tf / peak)  # 짧은 문서가 불리해지지 않도록 정규화
                idf = math.log(total / doc_freq)
                score = tf_norm * idf * specificity(term)
                scored.append(ExtractedTerm(term=term, score=round(score, 5)))

            scored.sort(key=lambda t: (-t.score, t.term))
            result[doc_id] = scored[:top_k]
        return result
