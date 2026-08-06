"""생기부 구획을 그래프의 뼈대로 세운다.

여태 그래프는 별 모양이었다. 가운데에 문서 노드 하나, 둘레에 개념 60개, 선은
전부 "이 개념이 문서에 나왔다"(MENTIONED_IN). 60개 선이 모두 같은 뜻이라
읽을 것이 없고, 화면은 그 사실을 감추려고 **가짜 가지**를 그렸다 —
`external_refs.section` 으로 과목별 묶음을 만들어 트리처럼 보이게 했지만
그건 그림일 뿐이라 눌러도 아무 데도 가지 않고, 고칠 수도 없었다.

여기서는 그 층을 **진짜 노드와 진짜 선**으로 만든다.

    [내 생기부]                     Document
        ↑ BELONGS_TO
    [1학년] [2학년] [3학년]          Period
        ↑ OCCURRED_IN
    [1학년 국어] [자율활동] …        Subject / Activity — 생기부 구획 하나가 노드 하나
        ↑ MENTIONED_IN
    [음운 변동 현상] …               개념

개념이 어느 구획에 붙는지는 **그 구획 본문에 그 낱말이 실제로 있는지**로 정한다
(`node_evidence` 의 찾기를 그대로 쓴다). 지어내지 않는다 — 못 찾으면 문서에
그대로 매단다.

**여러 번 돌려도 안전하다.** 이미 맞게 서 있으면 아무것도 건드리지 않는다.
학생이 직접 만든 노드와 손으로 이은 선은 절대 지우지 않는다.
"""

from __future__ import annotations

import logging

from app.schemas.documents import DocumentSection, SectionType
from app.schemas.graph import GraphNode, NodeType, RelationType
from app.services.node_evidence import SECTION_LABELS, hinted_type, patterns_of

logger = logging.getLogger(__name__)

# 우리가 세운 뼈대 노드임을 알아보는 표시. 학생이 만든 노드와 섞이면 다시 세울 때
# 남의 노드를 지우게 된다.
STRUCTURE_SOURCE = "structure"

# 이만큼도 안 되는 구획은 노드로 만들지 않는다. "(작성 시작)" 같은 빈 껍데기가
# 과목 노드로 서면 그래프에 빈 가지만 늘어난다.
MIN_CONTENT = 40

# 개념 하나가 매달릴 수 있는 구획 수. 흔한 낱말("발표")은 서른 군데에 다 나오는데
# 그걸 다 이으면 그래프가 다시 그물이 된다.
MAX_PARENTS = 2

_ACTIVITY_TYPES = {
    SectionType.AUTONOMOUS, SectionType.CLUB, SectionType.VOLUNTEER,
    SectionType.CAREER, SectionType.AWARD, SectionType.READING,
    SectionType.BEHAVIOR,
}


def section_label(section: DocumentSection) -> str:
    """구획 노드의 이름. 학생이 생기부에서 부르는 이름 그대로."""
    if section.section_type == SectionType.SUBJECT_SPECIFIC and section.subject_id:
        grade = f"{section.period_id} " if section.period_id else ""
        return f"{grade}{section.subject_id}"
    return SECTION_LABELS.get(section.section_type, str(section.section_type))


def _node_type(section: DocumentSection) -> NodeType:
    if section.section_type == SectionType.SUBJECT_SPECIFIC:
        return NodeType.SUBJECT
    return NodeType.ACTIVITY if section.section_type in _ACTIVITY_TYPES else NodeType.SUBJECT


def _refs(node: GraphNode) -> dict:
    return node.external_refs or {}


def is_structure(node: GraphNode) -> bool:
    return _refs(node).get("source") == STRUCTURE_SOURCE


def _usable(sections: list[DocumentSection]) -> list[DocumentSection]:
    return [
        s for s in sections
        if s.content and s.content != "(작성 시작)" and len(s.content.strip()) >= MIN_CONTENT
    ]


class _Plan:
    """지금 그래프와 있어야 할 모습의 차이. 셀 수 있어야 무엇이 바뀌는지 말할 수 있다."""

    def __init__(self) -> None:
        self.nodes_added = 0
        self.nodes_removed = 0
        self.edges_added = 0
        self.edges_removed = 0

    @property
    def changed(self) -> bool:
        return bool(self.nodes_added or self.nodes_removed or self.edges_added or self.edges_removed)

    def as_dict(self) -> dict:
        return {
            "nodes_added": self.nodes_added,
            "nodes_removed": self.nodes_removed,
            "edges_added": self.edges_added,
            "edges_removed": self.edges_removed,
            "changed": self.changed,
        }


async def rebuild(graph, user_id: str, sections: list[DocumentSection]) -> dict:
    """생기부 구획으로 그래프의 층을 다시 세운다.

    돌려주는 값은 무엇이 얼마나 바뀌었는지다. 아무것도 안 바뀌면 `changed=False`.
    """
    plan = _Plan()
    snapshot = await graph.get_snapshot(user_id)
    nodes = list(snapshot.nodes)
    edges = list(snapshot.edges)

    doc = next((n for n in nodes if n.type == NodeType.DOCUMENT), None)
    usable = _usable(sections)

    # 붙일 구획이 하나도 없으면 아무것도 하지 않는다. 그냥 두면 아래에서 옛 선
    # (개념 → 문서)을 "우리 것"이라며 지우는데, 대신 이을 곳이 없어서 노드가
    # 통째로 떠 버린다 — 고치려다 더 나쁘게 만드는 경우다.
    if not usable:
        logger.info("붙일 구획이 없어 뼈대를 건드리지 않음 user=%s", user_id)
        return {**plan.as_dict(), "sections": 0, "periods": 0, "concepts": 0}

    # ── 1. 있어야 할 구획 노드 ────────────────────────────────────────────
    want_sections = {s.id: s for s in usable}
    have_sections: dict[str, GraphNode] = {
        _refs(n)["section_id"]: n
        for n in nodes
        if is_structure(n) and _refs(n).get("section_id")
    }

    section_nodes: dict[str, GraphNode] = {}
    for sid, section in want_sections.items():
        node = have_sections.get(sid)
        if node is None:
            node = await graph.create_node(
                user_id,
                node_type=_node_type(section),
                label=section_label(section),
                description=f"{len(section.content):,}자",
                external_refs={
                    "source": STRUCTURE_SOURCE,
                    "section_id": sid,
                    "section": section.subject_id or section_label(section),
                    "period": section.period_id or "",
                },
            )
            plan.nodes_added += 1
        section_nodes[sid] = node

    # ── 2. 학년 노드 ──────────────────────────────────────────────────────
    want_periods = sorted({s.period_id for s in usable if s.period_id})
    have_periods: dict[str, GraphNode] = {
        _refs(n)["period_key"]: n
        for n in nodes
        if is_structure(n) and _refs(n).get("period_key")
    }
    period_nodes: dict[str, GraphNode] = {}
    for period in want_periods:
        node = have_periods.get(period)
        if node is None:
            node = await graph.create_node(
                user_id,
                node_type=NodeType.PERIOD,
                label=period,
                description=f"{sum(1 for s in usable if s.period_id == period)}과목",
                external_refs={"source": STRUCTURE_SOURCE, "period_key": period},
            )
            plan.nodes_added += 1
        period_nodes[period] = node

    # ── 3. 쓸모없어진 뼈대 노드는 걷는다 ──────────────────────────────────
    for sid, node in have_sections.items():
        if sid not in want_sections:
            await graph.delete_node(user_id, node.id)
            plan.nodes_removed += 1
    for period, node in have_periods.items():
        if period not in period_nodes:
            await graph.delete_node(user_id, node.id)
            plan.nodes_removed += 1

    # ── 4. 개념을 구획에 붙인다 ───────────────────────────────────────────
    #
    # 어디에 붙일지는 **그 구획 본문에 그 낱말이 실제로 있는지**로 정한다.
    # 노드에 적혀 있는 과목 이름(external_refs.section)은 참고만 한다 — 예전
    # 추출기가 붙인 값이라 지금 구획과 이름이 다를 수 있다.
    structure_ids = {n.id for n in section_nodes.values()} | {n.id for n in period_nodes.values()}
    concepts = [
        n for n in nodes
        if n.type != NodeType.DOCUMENT and not is_structure(n) and n.id not in structure_ids
    ]

    packed = {sid: _packed(s.content) for sid, s in want_sections.items()}
    hint_of = {sid: (s.subject_id or section_label(s)) for sid, s in want_sections.items()}
    # 이름으로 찾기 — 낱말이 본문에 그대로 없을 때 쓸 두 번째 길.
    by_subject: dict[str, str] = {}
    by_type: dict[SectionType, str] = {}
    for sid, section in want_sections.items():
        if section.subject_id:
            by_subject.setdefault(section.subject_id.replace(" ", ""), sid)
        by_type.setdefault(section.section_type, sid)

    want_edges: set[tuple[str, str, RelationType]] = set()
    for concept in concepts:
        terms = patterns_of(concept)
        if not terms:
            continue
        hits: list[tuple[int, int, str]] = []  # (힌트 일치, 나온 횟수, 구획 id)
        node_hint = str(_refs(concept).get("section") or "").replace(" ", "")
        for sid, body in packed.items():
            count = sum(len(pattern.findall(body)) for _, pattern in terms)
            if not count:
                continue
            same_hint = 1 if node_hint and node_hint == hint_of[sid].replace(" ", "") else 0
            hits.append((same_hint, count, sid))
        hits.sort(reverse=True)
        if hits:
            for _, _, sid in hits[:MAX_PARENTS]:
                want_edges.add((concept.id, section_nodes[sid].id, RelationType.MENTIONED_IN))
            continue

        # 본문에서 못 찾았다. AI 가 말을 다듬어 뽑은 것이다("학급 임원" → "학급 회장").
        # 그래도 **어느 구획을 읽다가 뽑았는지**는 적어 뒀다(external_refs.section).
        # 그 기록을 두 번째 길로 쓴다 — 지어내는 게 아니라 추출 당시의 사실이다.
        fallback = by_subject.get(node_hint)
        if fallback is None:
            hint_type = hinted_type(node_hint)
            if hint_type is not None:
                fallback = by_type.get(hint_type)
        if fallback is not None:
            want_edges.add((concept.id, section_nodes[fallback].id, RelationType.MENTIONED_IN))
        elif doc is not None:
            # 출처도 모르는 노드(학생이 직접 만든 것 등). 선을 끊으면 화면에서
            # 떠다니는 노드가 되어 예전보다 나빠진다. 문서에 그대로 매단다.
            want_edges.add((concept.id, doc.id, RelationType.MENTIONED_IN))

    # 구획 → 학년 → 문서
    for sid, section in want_sections.items():
        node = section_nodes[sid]
        parent = period_nodes.get(section.period_id or "")
        if parent is not None:
            want_edges.add((node.id, parent.id, RelationType.OCCURRED_IN))
        elif doc is not None:
            want_edges.add((node.id, doc.id, RelationType.BELONGS_TO))
    if doc is not None:
        for node in period_nodes.values():
            want_edges.add((node.id, doc.id, RelationType.BELONGS_TO))

    # ── 5. 선 맞추기 ──────────────────────────────────────────────────────
    #
    # 지울 수 있는 선은 **우리가 만든 것**뿐이다: 개념→문서(예전 별 모양)와
    # 뼈대가 걸린 선. 학생이 손으로 이은 선은 건드리지 않는다.
    alive = {n.id for n in nodes} | structure_ids
    concept_ids = {n.id for n in concepts}
    have_edges: dict[tuple[str, str, RelationType], str] = {}
    for edge in edges:
        key = (edge.source_id, edge.target_id, edge.relation)
        ours = (
            (doc is not None and edge.target_id == doc.id and edge.source_id in concept_ids)
            or edge.source_id in structure_ids
            or edge.target_id in structure_ids
        )
        if not ours:
            continue
        if key in have_edges or key not in want_edges:
            await graph.delete_edge(user_id, edge.id)
            plan.edges_removed += 1
        else:
            have_edges[key] = edge.id

    for source_id, target_id, relation in want_edges:
        if (source_id, target_id, relation) in have_edges:
            continue
        if source_id not in alive or target_id not in alive:
            continue
        await graph.create_edge(user_id, source_id=source_id, target_id=target_id, relation=relation)
        plan.edges_added += 1

    logger.info("그래프 뼈대 다시 세움 user=%s %s", user_id, plan.as_dict())
    return {
        **plan.as_dict(),
        "sections": len(want_sections),
        "periods": len(period_nodes),
        "concepts": len(concepts),
    }


def _packed(text: str) -> str:
    return "".join((text or "").split())
