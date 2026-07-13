"""In-memory stores for OFFLINE_DEMO=1 (no Docker / no Neo4j·PostgreSQL)."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from app.schemas.graph import GraphEdge, GraphNode, GraphSnapshot, NodeType, RelationType


def _now() -> datetime:
    return datetime.now(UTC)


@dataclass
class MemoryUser:
    id: str
    email: str
    display_name: str
    created_at: datetime


@dataclass
class MemoryDocument:
    id: str
    user_id: str
    section_type: str
    content: str
    period_id: str | None
    subject_id: str | None
    version: int
    source: str
    created_at: datetime
    updated_at: datetime


@dataclass
class MemoryJob:
    id: str
    user_id: str
    job_type: str
    status: str
    progress: int
    payload: str
    result: str | None
    error: str | None
    created_at: datetime
    updated_at: datetime


@dataclass
class MemoryDatabase:
    users_by_email: dict[str, MemoryUser] = field(default_factory=dict)
    users_by_id: dict[str, MemoryUser] = field(default_factory=dict)
    documents: dict[str, MemoryDocument] = field(default_factory=dict)
    jobs: dict[str, MemoryJob] = field(default_factory=dict)


_db = MemoryDatabase()


def get_memory_db() -> MemoryDatabase:
    return _db


def reset_memory_db() -> None:
    global _db
    _db = MemoryDatabase()
    _graph_store = InMemoryGraphStore()


class InMemoryGraphStore:
    def __init__(self) -> None:
        self._nodes: dict[str, dict[str, GraphNode]] = {}
        self._edges: dict[str, dict[str, GraphEdge]] = {}

    async def get_snapshot(self, user_id: str) -> GraphSnapshot:
        nodes = list(self._nodes.get(user_id, {}).values())
        edges = list(self._edges.get(user_id, {}).values())
        return GraphSnapshot(nodes=nodes, edges=edges)

    async def create_node(
        self,
        user_id: str,
        *,
        node_type: NodeType,
        label: str,
        description: str | None = None,
        external_refs: dict | None = None,
    ) -> GraphNode:
        now = _now()
        node = GraphNode(
            id=str(uuid4()),
            type=node_type,
            label=label,
            description=description,
            external_refs=external_refs or {},
            created_at=now,
            updated_at=now,
        )
        self._nodes.setdefault(user_id, {})[node.id] = node
        return node

    async def patch_node(
        self, user_id: str, node_id: str, *, label: str | None, description: str | None
    ) -> GraphNode | None:
        node = self._nodes.get(user_id, {}).get(node_id)
        if not node:
            return None
        data = node.model_dump()
        if label is not None:
            data["label"] = label
        if description is not None:
            data["description"] = description
        data["updated_at"] = _now()
        updated = GraphNode(**data)
        self._nodes[user_id][node_id] = updated
        return updated

    async def delete_node(self, user_id: str, node_id: str) -> bool:
        nodes = self._nodes.get(user_id, {})
        if node_id not in nodes:
            return False
        del nodes[node_id]
        edges = self._edges.get(user_id, {})
        for eid, edge in list(edges.items()):
            if edge.source_id == node_id or edge.target_id == node_id:
                del edges[eid]
        return True

    async def create_edge(
        self, user_id: str, *, source_id: str, target_id: str, relation: RelationType
    ) -> GraphEdge:
        now = _now()
        edge = GraphEdge(
            id=str(uuid4()),
            source_id=source_id,
            target_id=target_id,
            relation=relation,
            created_at=now,
        )
        self._edges.setdefault(user_id, {})[edge.id] = edge
        return edge

    async def get_node(self, user_id: str, node_id: str) -> GraphNode | None:
        return self._nodes.get(user_id, {}).get(node_id)

    async def delete_edge(self, user_id: str, edge_id: str) -> bool:
        edges = self._edges.get(user_id, {})
        if edge_id not in edges:
            return False
        del edges[edge_id]
        return True

    async def create_seeds(self, user_id: str, seeds: list[str]) -> list[GraphNode]:
        return [
            await self.create_node(user_id, node_type=NodeType.KEYWORD, label=s.strip())
            for s in seeds
            if s.strip()
        ]


_graph_store = InMemoryGraphStore()


def get_memory_graph_store() -> InMemoryGraphStore:
    return _graph_store


def _kw(text: str, limit: int = 6) -> list[str]:
    tokens = re.findall(r"[가-힣A-Za-z0-9]{2,}", text or "")
    seen: list[str] = []
    for t in tokens:
        if t not in seen:
            seen.append(t)
        if len(seen) >= limit:
            break
    return seen


def seed_demo_data(user_id: str) -> None:
    """데모 사용자 첫 로그인 시 5과목 지식그래프 + 활동 데이터를 미리 채운다."""
    store = get_memory_graph_store()
    if store._nodes.get(user_id):
        return  # 이미 데이터 있으면 스킵

    db = get_memory_db()
    now = _now()

    # ── 그래프 노드 ─────────────────────────────────────────
    # external_refs 에 x/y(%) 를 담아 프론트 초기 레이아웃에 활용
    def _n(
        label: str,
        ntype: NodeType,
        x: str,
        y: str,
        desc: str | None = None,
        days: int = 7,
    ) -> GraphNode:
        node = GraphNode(
            id=str(uuid4()),
            type=ntype,
            label=label,
            description=desc,
            external_refs={"x": x, "y": y},
            created_at=now - timedelta(days=days),
            updated_at=now - timedelta(days=days),
        )
        store._nodes.setdefault(user_id, {})[node.id] = node
        return node

    def _e(src: GraphNode, tgt: GraphNode, days: int = 7) -> None:
        edge = GraphEdge(
            id=str(uuid4()),
            source_id=src.id,
            target_id=tgt.id,
            relation=RelationType.RELATES_TO,
            created_at=now - timedelta(days=days),
        )
        store._edges.setdefault(user_id, {})[edge.id] = edge

    # ── 핵심 노드 (SUBJECT → root) — 오각형 배치 ────────────
    s_math = _n("수학",  NodeType.SUBJECT, "50%", "20%", "수학 전 영역", days=30)
    s_sci  = _n("과학",  NodeType.SUBJECT, "78%", "40%", "과학 전 영역", days=30)
    s_eng  = _n("영어",  NodeType.SUBJECT, "68%", "74%", "영어 전 영역", days=30)
    s_kor  = _n("국어",  NodeType.SUBJECT, "22%", "40%", "국어 전 영역", days=30)
    s_soc  = _n("사회",  NodeType.SUBJECT, "32%", "74%", "사회 전 영역", days=30)

    # ── 연결 노드 (INQUIRY → topic) ──────────────────────────
    # 수학
    i_calc = _n("미적분",   NodeType.INQUIRY, "40%",  "8%", "극한·미분·적분", days=20)
    i_prob = _n("확률통계", NodeType.INQUIRY, "62%",  "8%", "확률과 통계 분석", days=18)
    # 과학
    i_phy  = _n("물리학",   NodeType.INQUIRY, "88%", "26%", "역학·전자기·현대물리", days=25)
    i_chem = _n("화학",     NodeType.INQUIRY, "88%", "55%", "원소·반응·유기화학", days=22)
    # 영어
    i_read = _n("영어독해", NodeType.INQUIRY, "80%", "85%", "수능·EBS 지문 분석", days=20)
    i_writ = _n("영어작문", NodeType.INQUIRY, "56%", "88%", "에세이·이메일 작성", days=15)
    # 국어
    i_lit  = _n("문학",     NodeType.INQUIRY, "12%", "26%", "현대·고전 문학 감상", days=25)
    i_wr2  = _n("독서",     NodeType.INQUIRY, "34%",  "8%", "비문학 독해와 요약", days=18)
    # 사회
    i_eco  = _n("경제",     NodeType.INQUIRY, "22%", "88%", "시장·금융·국제무역", days=22)
    i_pol  = _n("정치와법", NodeType.INQUIRY, "12%", "58%", "민주주의·헌법·법치", days=20)

    # ── 말단 노드 (ACTIVITY → leaf) ──────────────────────────
    a_diff = _n("미분방정식", NodeType.ACTIVITY, "28%",  "2%", "이공계 필수 도구", days=10)
    a_mech = _n("고전역학",   NodeType.ACTIVITY, "94%", "14%", "뉴턴·라그랑주 역학", days=12)
    a_org  = _n("유기화학",   NodeType.ACTIVITY, "94%", "66%", "탄소 화합물 반응", days=10)
    a_essay= _n("독서감상문", NodeType.ACTIVITY, "40%",  "2%", "독서 기반 글쓰기", days=8)
    a_econ = _n("시사경제",   NodeType.ACTIVITY, "18%", "96%", "실생활 경제 적용", days=6)
    a_nov  = _n("현대소설",   NodeType.ACTIVITY,  "4%", "16%", "현대 작가 주요 작품", days=8)

    # ── 엣지 연결 ────────────────────────────────────────────
    for src, tgt in [
        # 수학 가지
        (s_math, i_calc), (s_math, i_prob), (i_calc, a_diff),
        # 과학 가지
        (s_sci, i_phy), (s_sci, i_chem), (i_phy, a_mech), (i_chem, a_org),
        # 영어 가지
        (s_eng, i_read), (s_eng, i_writ),
        # 국어 가지
        (s_kor, i_lit), (s_kor, i_wr2), (i_lit, a_nov), (i_wr2, a_essay),
        # 사회 가지
        (s_soc, i_eco), (s_soc, i_pol), (i_eco, a_econ),
        # 교차 연결 (융합 역량)
        (i_calc, i_phy), (i_read, i_lit),
    ]:
        _e(src, tgt)

    # ── 코멘트 ──────────────────────────────────────────────
    if not hasattr(db, "comments"):
        db.comments = {}  # type: ignore[attr-defined]
    for author, ctype, target, content, replied, days_f in [
        ("김선생님", "노드", "물리학 노드",
         "역학 개념과 함께 현대물리(양자역학, 상대성이론) 내용도 추가해 보면 "
         "탐구 깊이가 크게 향상될 것 같습니다.",
         False, 0.4),
        ("박선생님", "텍스트", "세특 영역",
         "미적분과 물리학 노드가 연결된 것이 인상적이에요. "
         "실험 데이터를 수치로 세특에 담으면 더욱 설득력 있어집니다.",
         True, 2.0),
        ("이선생님", "그래프", "전체 그래프",
         "5개 과목이 균형 있게 구성되어 있어요. "
         "각 과목 간 융합 노드를 더 연결하면 융합 역량을 보여줄 수 있습니다.",
         True, 1.0),
    ]:
        cid = str(uuid4())
        db.comments[cid] = {  # type: ignore[attr-defined]
            "id": cid, "user_id": user_id, "author": author,
            "type": ctype, "target": target, "content": content,
            "reports": 0, "replied": replied,
            "created_at": now - timedelta(days=days_f),
        }

    # ── 음성 세션 ────────────────────────────────────────────
    if not hasattr(db, "voice"):
        db.voice = {}  # type: ignore[attr-defined]
    for title, st, dur, transcript, days_f in [
        ("미적분-물리학 융합 탐구 발표", "완료", 1580,
         "미적분의 미분방정식을 활용해 고전역학의 운동 방정식을 유도하는 과정을 발표했습니다. "
         "수학과 물리학의 연계성을 중심으로 탐구 내용을 정리했습니다.", 5.0),
        ("영어 독해 학습 정리", "완료", 920,
         "수능 영어 독해 지문 분석 방법을 정리했습니다. "
         "주제문 파악과 논리 구조 분석을 중심으로 공부했습니다.", 3.0),
        ("사회·경제 시사 스터디", "검토 대기", 740,
         "최근 금리 인상이 소비와 투자에 미치는 영향을 분석했습니다. "
         "정치와 법 단원과 연계해 시장 규제 정책도 논의했습니다.", 1.0),
    ]:
        vid = str(uuid4())
        db.voice[vid] = {  # type: ignore[attr-defined]
            "id": vid, "user_id": user_id, "title": title, "status": st,
            "duration_sec": dur, "transcript": transcript,
            "keywords": _kw(transcript), "participants": ["김학생"],
            "stt_mode": "mock",
            "created_at": now - timedelta(days=days_f),
            "updated_at": now - timedelta(days=days_f),
        }

    # ── 생성 양식 ────────────────────────────────────────────
    if not hasattr(db, "forms"):
        db.forms = {}  # type: ignore[attr-defined]
    for fid_tmpl, title, content, used in [
        ("setuk",
         "세특 요약 보고서 — 김학생",
         "김학생은 수학과 과학을 중심으로 미적분, 물리학, 화학 분야를 탐구하였습니다. "
         "미분방정식을 활용해 역학 문제를 풀이하고, 유기화학 실험을 통해 "
         "이론과 실험의 연계성을 심화하였습니다.",
         ["수학", "미적분", "물리학", "화학", "미분방정식"]),
        ("saseo",
         "대학 자기소개서 초안 — 김학생",
         "저는 수학과 과학에 깊은 관심을 가지고, 특히 미적분과 물리학의 연계성을 "
         "탐구해 왔습니다. 미분방정식을 통한 역학 문제 풀이 경험은 "
         "이공계 전공 진학의 동기가 되었습니다.",
         ["수학", "물리학", "미적분"]),
    ]:
        fid = str(uuid4())
        db.forms[fid] = {  # type: ignore[attr-defined]
            "id": fid, "user_id": user_id, "template_id": fid_tmpl,
            "title": title, "content": content, "used_nodes": used,
            "status": "완료",
            "created_at": now - timedelta(days=7),
            "updated_at": now - timedelta(days=7),
        }
