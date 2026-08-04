"""In-memory stores for OFFLINE_DEMO=1 (no Docker / no Neo4j·PostgreSQL)."""

from __future__ import annotations

import math
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
        self._embeddings: dict[str, dict[str, list[float]]] = {}

    async def get_snapshot(self, user_id: str) -> GraphSnapshot:
        nodes = list(self._nodes.get(user_id, {}).values())
        edges = list(self._edges.get(user_id, {}).values())
        return GraphSnapshot(nodes=nodes, edges=edges)

    # ── Embeddings (F1-12) ────────────────────────────────────────────────────

    async def store_embedding(self, user_id: str, node_id: str, vector: list[float]) -> None:
        """Store a node's label embedding for cosine search."""
        self._embeddings.setdefault(user_id, {})[node_id] = list(vector)

    async def search_by_embedding(
        self, user_id: str, vector: list[float], top_k: int = 10
    ) -> list[tuple[str, float]]:
        """Return (node_id, cosine similarity) ranked descending.

        Vectors of a different dimension are skipped rather than raising, so a change
        of embedding adapter degrades to fewer hits instead of an error.
        """
        stored = self._embeddings.get(user_id, {})
        if not stored or not vector:
            return []

        query_norm = math.sqrt(sum(v * v for v in vector))
        if not query_norm:
            return []

        scored: list[tuple[str, float]] = []
        for node_id, candidate in stored.items():
            if len(candidate) != len(vector):
                continue
            candidate_norm = math.sqrt(sum(v * v for v in candidate))
            if not candidate_norm:
                continue
            dot = sum(a * b for a, b in zip(vector, candidate))
            scored.append((node_id, dot / (query_norm * candidate_norm)))

        scored.sort(key=lambda item: -item[1])
        return scored[:top_k]

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
        self,
        user_id: str,
        node_id: str,
        *,
        label: str | None,
        description: str | None,
        node_type: str | None = None,
        external_refs: dict | None = None,
    ) -> GraphNode | None:
        node = self._nodes.get(user_id, {}).get(node_id)
        if not node:
            return None
        data = node.model_dump()
        if label is not None:
            data["label"] = label
        if description is not None:
            data["description"] = description
        if node_type is not None:
            data["type"] = node_type
        if external_refs is not None:
            data["external_refs"] = external_refs
        data["updated_at"] = _now()
        updated = GraphNode(**data)
        self._nodes[user_id][node_id] = updated
        return updated

    async def delete_node(self, user_id: str, node_id: str) -> bool:
        nodes = self._nodes.get(user_id, {})
        if node_id not in nodes:
            return False
        del nodes[node_id]
        self._embeddings.get(user_id, {}).pop(node_id, None)
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

    # ── 문서 섹션 (생기부 영역별 텍스트) ─────────────────────────
    for stype, content, days_f in [
        ("subject_specific",
         "수학 과목에서는 미적분학의 극한과 미분 개념을 심층 탐구하여 "
         "운동 방정식 유도에 적용하였다. "
         "물리학과의 연계 학습을 통해 고전역학의 뉴턴 법칙을 미분방정식으로 표현하고, "
         "수치 해석을 통해 운동 궤적을 시뮬레이션하였다. "
         "확률과 통계 단원에서는 정규 분포와 가설 검정을 학습하고, "
         "실험 데이터 분석에 통계 기법을 직접 적용하여 결과의 신뢰성을 검증하였다. "
         "과학 과목에서는 유기화학 반응 메커니즘을 중심으로 탐구 보고서를 작성하였으며, "
         "탄소 화합물의 구조-반응성 관계를 시각화하여 학습 결과를 정리하였다.",
         14),
        ("autonomous",
         "학급 자치 부회장으로서 학급 행사 기획 및 운영을 주도하였다. "
         "또래 멘토링 프로그램에 참여하여 수학 개념을 어려워하는 동급생에게 미적분 기초 개념을 "
         "쉽게 풀어 설명하는 역할을 맡아 소통 역량을 키웠다. "
         "교내 과학 탐구 발표회에서 '수학과 물리학의 융합 탐구'를 주제로 "
         "발표하여 우수상을 수상하였다.",
         20),
        ("club",
         "수리과학 탐구 동아리에서 매주 팀원들과 함께 수학 문제를 풀고 풀이 방법을 공유하였다. "
         "미분방정식 스터디를 자발적으로 조직하여 물리·공학 응용 사례를 조사하고 발표하였다. "
         "동아리 발표회에서 팀 프로젝트 리더로 '카오스 이론과 날씨 예측'을 주제로 발표하였다.",
         25),
        ("volunteer",
         "지역 도서관에서 초등학생 대상 수학 학습 지원 봉사(월 2회, 총 24시간)를 수행하였다. "
         "기초 연산부터 분수·소수 개념까지 단계적으로 가르치며 교육 봉사에 보람을 느꼈다.",
         30),
        ("career",
         "물리학자 또는 항공우주공학자를 진로 목표로 설정하고 관련 대학 학과 탐방 및 "
         "입시 정보를 수집하였다. 한국항공우주연구원 견학을 통해 인공위성 제어 시스템에 대한 "
         "관심이 높아졌으며, 연구원 멘토링 세미나에 참가하여 이공계 진학 로드맵을 수립하였다. "
         "향후 미적분과 고전역학 심화 학습을 통해 전공 기초를 강화할 계획이다.",
         18),
        ("behavior",
         "성실하고 탐구적인 학습 태도로 교과 수업에 적극적으로 참여하였다. "
         "협동심이 강하고 친구들의 이해를 도우며 긍정적인 학급 분위기 형성에 기여하였다.",
         28),
        ("reading",
         "『페르마의 마지막 정리』(사이먼 싱)를 읽고 수학 증명의 아름다움과 집념에 감명받아 "
         "독서 감상문을 작성하였다. 『파인만의 물리학 강의』 1권을 통해 고전역학을 직관적으로 "
         "이해하였고, 물리학적 사고방식이 일상 문제 해결에 어떻게 적용되는지 고찰하였다.",
         22),
        ("award",
         "교내 수학 경시대회 금상 (2026년 4월), "
         "과학 탐구 발표회 우수상 (2026년 5월), "
         "영어 독해 경시대회 동상 (2026년 3월)",
         10),
    ]:
        did = str(uuid4())
        db.documents[did] = MemoryDocument(
            id=did,
            user_id=user_id,
            section_type=stype,
            content=content,
            period_id=None,
            subject_id=None,
            version=1,
            source="demo",
            created_at=now - timedelta(days=days_f),
            updated_at=now - timedelta(days=days_f),
        )

    # ── 알림 ────────────────────────────────────────────────────
    if not hasattr(db, "notifications"):
        db.notifications = {}  # type: ignore[attr-defined]
    for icon, title, notif_body, read, days_f in [
        ("comment", "새 코멘트 — 김선생님",
         "물리학 노드에 코멘트가 달렸습니다: '현대물리 내용도 추가해 보세요.'",
         False, 0.4),
        ("voice", "음성 녹음 검토 대기",
         "'사회·경제 시사 스터디' 세션이 STT 처리 완료되어 검토를 기다리고 있습니다.",
         False, 1.0),
        ("comment", "새 코멘트 — 이선생님",
         "전체 그래프에 코멘트가 달렸습니다: '과목 간 융합 노드를 더 연결해 보세요.'",
         True, 1.0),
        ("form", "양식 생성 완료",
         "'세특 요약 보고서 — 김학생' 양식이 생성되었습니다.",
         True, 7.0),
        ("comment", "새 코멘트 — 박선생님",
         "세특 영역에 코멘트가 달렸습니다: '실험 데이터를 수치로 담으면 더욱 설득력 있어집니다.'",
         True, 2.0),
        ("graph", "그래프 시작",
         "시드 키워드로 지식 그래프를 만들어 보세요.",
         True, 30.0),
        ("bell", "환영합니다",
         "MentorBridgeX에 오신 것을 환영합니다.",
         True, 30.0),
    ]:
        nid = str(uuid4())
        db.notifications[nid] = {  # type: ignore[attr-defined]
            "id": nid, "user_id": user_id, "icon": icon,
            "title": title, "body": notif_body, "read": read,
            "created_at": now - timedelta(days=days_f),
        }
