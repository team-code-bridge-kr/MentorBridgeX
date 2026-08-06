"""그래프의 **빈 곳**을 찾는다.

그래프의 값어치는 있는 것을 예쁘게 보여주는 데 있지 않다. 있는 것은 학생이
이미 안다 — 자기가 쓴 생기부다. 정작 모르는 것은 **없는 것**이다.

세 가지만 말한다. 셋 다 계산으로 확인되는 사실이고, 판단은 하지 않는다.

  1. 그래프에 없는 과목 — 생기부에는 글이 있는데 노드가 하나도 없는 과목
  2. 이어지지 않은 개념 — 다른 개념과 한 번도 이어지지 않은 노드
  3. 요즘 안 보이는 주제 — 예전 학년엔 나오는데 마지막 학년엔 안 나오는 노드

3번은 **나쁘다는 뜻이 아니다.** 1학년 주제가 3학년에 없는 건 자연스러운 일이다.
그래서 화면에도 "끊겼다"가 아니라 "요즘 안 보인다"라고만 적는다 — 이어갈지
말지는 학생이 정한다.
"""

from __future__ import annotations
from app.services.graph_structure import is_structure

import re
from dataclasses import dataclass, field

from app.schemas.documents import DocumentSection
from app.schemas.graph import GraphEdge, GraphNode

from .node_evidence import _label, _sentences, patterns_of

# 글이 이보다 짧은 항목은 "비었다"고 말하지 않는다. 한두 줄짜리 기록에서
# 노드가 안 나온 건 빠뜨린 게 아니라 쓸 것이 없었던 것이다.
MIN_CONTENT = 120

LIMIT = 12


@dataclass
class EmptySubject:
    section_id: str
    section_type: str   # 화면이 그 문서를 열 때 필요하다
    where: str          # "3학년 화학Ⅱ 세특"
    chars: int


@dataclass
class LonelyNode:
    node_id: str
    label: str
    section: str


@dataclass
class FadedTopic:
    node_id: str
    label: str
    last_seen: str      # 마지막으로 나온 학년
    grades: list[str] = field(default_factory=list)


def _grade_of(section: DocumentSection) -> str:
    return (section.period_id or "").strip()


def empty_subjects(nodes: list[GraphNode], sections: list[DocumentSection]) -> list[EmptySubject]:
    """생기부에는 글이 있는데 그래프에는 노드가 없는 항목."""
    have = {
        " ".join(str((n.external_refs or {}).get("section") or "").split())
        for n in nodes
    }
    have.discard("")
    out = []
    for s in sections:
        if len(s.content) < MIN_CONTENT:
            continue
        # 세특은 과목이 곧 이름이고, 나머지 영역은 영역명이 이름이다.
        key = (s.subject_id or "").strip()
        if key and key in have:
            continue
        if not key:
            # 세특이 아닌 영역: 그 영역에서 나온 노드가 하나라도 있으면 넘어간다
            area = _label(s)
            if any(area.startswith(h) or h in area for h in have if h):
                continue
        out.append(
            EmptySubject(
                section_id=s.id,
                section_type=str(s.section_type),
                where=_label(s),
                chars=len(s.content),
            )
        )
    out.sort(key=lambda x: -x.chars)
    return out[:LIMIT]


def lonely_nodes(nodes: list[GraphNode], edges: list[GraphEdge]) -> list[LonelyNode]:
    """다른 **개념**과 한 번도 이어지지 않은 노드.

    문서 노드로 가는 선(MENTIONED_IN)은 세지 않는다. 그 선은 모든 노드가 갖고
    있어서 "이어져 있다"는 말이 되지 못한다.
    """
    doc_ids = {n.id for n in nodes if str(n.type) == "Document"}
    # 생기부 구획으로 세운 뼈대(학년·과목)는 개념이 아니다. "이어지지 않았다"고
    # 말해 봐야 학생이 할 수 있는 일이 없다 — 그건 생기부의 목차다.
    nodes = [n for n in nodes if not is_structure(n)]
    linked: set[str] = set()
    for e in edges:
        if e.source_id in doc_ids or e.target_id in doc_ids:
            continue
        linked.add(e.source_id)
        linked.add(e.target_id)
    return [
        LonelyNode(
            node_id=n.id,
            label=n.label,
            section=" ".join(str((n.external_refs or {}).get("section") or "").split()),
        )
        for n in nodes
        if n.id not in doc_ids and n.id not in linked
    ][:LIMIT]


def faded_topics(nodes: list[GraphNode], sections: list[DocumentSection]) -> list[FadedTopic]:
    """예전 학년엔 나오는데 마지막 학년엔 안 나오는 주제.

    학년이 두 해 이상 있어야 말이 된다. 한 해뿐이면 비교할 것이 없다.
    """
    grades = sorted({_grade_of(s) for s in sections if _grade_of(s)})
    if len(grades) < 2:
        return []
    latest = grades[-1]

    # 노드마다 어느 학년에서 보였는지
    seen: dict[str, set[str]] = {}
    targets = [
        (n, patterns_of(n))
        for n in nodes
        if str(n.type) != "Document" and not is_structure(n)
    ]
    targets = [(n, p) for n, p in targets if p]
    for s in sections:
        grade = _grade_of(s)
        if not grade:
            continue
        flat = " ".join(_sentences(s.content))
        for n, patterns in targets:
            if any(p.search(flat) for _t, p in patterns):
                seen.setdefault(n.id, set()).add(grade)

    out = []
    for n, _patterns in targets:
        where = seen.get(n.id)
        if not where or latest in where:
            continue
        out.append(
            FadedTopic(
                node_id=n.id,
                label=n.label,
                last_seen=sorted(where)[-1],
                grades=sorted(where),
            )
        )
    # 오래 다뤘던 주제일수록 먼저 — 한 해만 스친 것보다 눈여겨볼 만하다
    out.sort(key=lambda x: (-len(x.grades), x.label))
    return out[:LIMIT]


def _normalized(text: str) -> str:
    return re.sub(r"\s+", "", text)
