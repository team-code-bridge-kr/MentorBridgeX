"""**같은 문장에 함께 나온** 노드끼리 이어 준다.

지금 그래프의 선은 거의 전부 "이 노드가 생기부 문서에 나왔다"(MENTIONED_IN)
하나다. 60개 선이 전부 같은 뜻이니, 선을 진하게 그려도 읽을 것이 없다.
학생이 알고 싶은 건 문서와의 관계가 아니라 **개념끼리의 관계**다.

근거는 지어내지 않는다. 두 낱말이 **한 문장 안에 같이 적혀 있었다**는 사실
하나만 쓴다. 그래서 제안마다 그 문장을 그대로 보여줄 수 있고, 학생은 읽어 보고
이을지 말지 정한다(자동으로 잇지 않는다 — 근거가 약한 연결이 늘면 그래프가
다시 못 읽는 그림이 된다).

같은 항목에 있었다는 것만으로는 잇지 않는다. 세특 한 과목은 500자가 넘어서
"같은 과목에 나왔다" 는 거의 모든 쌍에 해당한다 — 그건 관계가 아니라 목록이다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.schemas.documents import DocumentSection
from app.schemas.graph import GraphNode

from .graph_structure import is_structure
from .node_evidence import _label, _sentences, patterns_of, terms_of

# 한 문장에 낱말이 너무 많이 걸리면 그건 문장이 아니라 나열이다(생기부에는
# "A, B, C, D 를 조사함" 같은 줄이 있다). 그런 문장에서 나온 쌍은 관계라기보다
# 목록이라 제외한다.
MAX_PER_SENTENCE = 6

# 이름이 짧으면 아무 문장에나 걸린다("AI", "수학"). 두 글자짜리는 우연히 겹칠
# 확률이 너무 높아 그 **이름으로는** 찾지 않는다. 다만 별칭 중 하나가 충분히
# 길면 그 이름으로 찾는다 — "AI" 노드에 "인공지능" 별칭을 달아 두면 걸린다.
MIN_LABEL_LEN = 3

SUGGEST_LIMIT = 30

# 이름이 시간표에 가까운 노드는 관계의 한쪽이 될 수 없다. "2학기 ↔ 천문대
# 봉사활동" 은 두 개념의 관계가 아니라 "언제"일 뿐이다.
_TIME_ONLY = re.compile(r"^\s*\d+\s*(학기|학년|월|일|년)\s*$")


@dataclass
class LinkSuggestion:
    """두 노드를 잇자는 제안 하나."""

    source_id: str
    target_id: str
    source_label: str
    target_label: str
    count: int = 0                       # 함께 나온 문장 수
    section_label: str = ""              # 근거 문장이 있던 곳(예: "1학년 국어 세특")
    sentence: str = ""                   # 근거 문장 그대로
    _seen: set = field(default_factory=set, repr=False)


def _one_contains_other(a: GraphNode, b: GraphNode) -> bool:
    """한쪽 이름이 다른 쪽을 품고 있으면 관계가 아니다.

    "빅데이터" 와 "빅데이터 분석" 은 늘 같은 문장에 함께 나온다 — 둘이
    이어져서가 아니라 한쪽이 다른 쪽의 일부라서다. 별칭까지 견준다:
    "AI" 노드의 별칭이 "인공지능" 이면 "인공지능 윤리" 와도 겹친다.
    """
    flat = lambda t: re.sub(r"\s+", "", t)  # noqa: E731
    left = [flat(t) for t in terms_of(a)]
    right = [flat(t) for t in terms_of(b)]
    return any(x in y or y in x for x in left for y in right)


def suggest_links(
    nodes: list[GraphNode],
    sections: list[DocumentSection],
    existing: set[tuple[str, str]],
    limit: int = SUGGEST_LIMIT,
) -> list[LinkSuggestion]:
    """같은 문장에 함께 나온 노드 쌍을 찾는다.

    `existing` 은 이미 이어져 있는 쌍(양방향 모두 넣어 둘 것). 이미 있는 선을
    다시 제안하면 목록이 금세 쓸모없어진다.
    """
    targets: list[tuple[GraphNode, list]] = []
    for n in nodes:
        # 문서와 뼈대(학년·과목)는 개념이 아니다. "1학년 국어" 와 "빅데이터" 가
        # 같은 문장에 있었다는 말은 관계가 아니라 목차다.
        if str(n.type) == "Document" or is_structure(n):
            continue
        usable = [
            (term, pattern)
            for term, pattern in patterns_of(n)
            if len(term.strip()) >= MIN_LABEL_LEN and not _TIME_ONLY.match(term)
        ]
        if usable:
            targets.append((n, usable))
    if len(targets) < 2:
        return []

    found: dict[tuple[str, str], LinkSuggestion] = {}

    for section in sections:
        where = _label(section)
        for sentence in _sentences(section.content):
            hits = [n for n, usable in targets if any(p.search(sentence) for _t, p in usable)]
            if len(hits) < 2 or len(hits) > MAX_PER_SENTENCE:
                continue
            for i, a in enumerate(hits):
                for b in hits[i + 1 :]:
                    key = (a.id, b.id) if a.id < b.id else (b.id, a.id)
                    if key in existing or _one_contains_other(a, b):
                        continue
                    item = found.get(key)
                    if item is None:
                        first, second = (a, b) if a.id < b.id else (b, a)
                        item = LinkSuggestion(
                            source_id=first.id,
                            target_id=second.id,
                            source_label=first.label,
                            target_label=second.label,
                            section_label=where,
                            sentence=sentence,
                        )
                        found[key] = item
                    # 같은 문장이 두 항목에 겹쳐 들어 있는 경우가 있다(학년별
                    # 사본). 같은 문장은 한 번만 센다.
                    fingerprint = re.sub(r"\s+", "", sentence)
                    if fingerprint in item._seen:
                        continue
                    item._seen.add(fingerprint)
                    item.count += 1

    # 자주 함께 나온 쌍부터. 같은 횟수면 이름 순 — 새로고침해도 순서가 그대로다.
    return sorted(
        found.values(),
        key=lambda s: (-s.count, s.source_label, s.target_label),
    )[:limit]
