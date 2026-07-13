"""In-memory stores for OFFLINE_DEMO=1 (no Docker / no Neo4j·PostgreSQL)."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from app.schemas.graph import GraphEdge, GraphNode, GraphSnapshot, NodeType, RelationType


def _now() -> datetime:
    return datetime.now(timezone.utc)


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
    """데모 사용자 첫 로그인 시 물리학 지식그래프 + 활동 데이터를 미리 채운다."""
    store = get_memory_graph_store()
    if store._nodes.get(user_id):
        return  # 이미 데이터 있으면 스킵

    db = get_memory_db()
    now = _now()

    # ── 그래프 노드 ─────────────────────────────────────────
    def _n(label: str, ntype: NodeType, desc: str | None = None, days: int = 7) -> GraphNode:
        node = GraphNode(
            id=str(uuid4()),
            type=ntype,
            label=label,
            description=desc,
            created_at=now - timedelta(days=days),
            updated_at=now - timedelta(days=days),
        )
        store._nodes.setdefault(user_id, {})[node.id] = node
        return node

    root  = _n("물리학",   NodeType.SUBJECT,  "물리학 전체 학습 영역", days=14)
    n_qm  = _n("양자역학", NodeType.INQUIRY,  "원자 이하 세계의 물리 법칙 탐구", days=12)
    n_cl  = _n("고전역학", NodeType.INQUIRY,  "뉴턴 운동 법칙과 역학 체계", days=12)
    n_em  = _n("전자기학", NodeType.INQUIRY,  "전기·자기 현상과 맥스웰 방정식", days=10)
    n_td  = _n("열역학",   NodeType.INQUIRY,  "에너지 보존과 엔트로피", days=10)
    n_exp = _n("실험물리", NodeType.KEYWORD,  "물리 실험 설계 및 측정", days=7)
    n_thr = _n("이론물리", NodeType.KEYWORD,  "수학적 모델과 물리 이론", days=7)
    n_ec  = _n("전기회로", NodeType.KEYWORD,  "전기 회로 설계와 분석", days=5)

    # ── 그래프 엣지 ─────────────────────────────────────────
    for src, tgt in [
        (root.id, n_qm.id), (root.id, n_cl.id),
        (root.id, n_em.id), (root.id, n_td.id),
        (n_qm.id, n_exp.id), (n_cl.id, n_thr.id), (n_em.id, n_ec.id),
    ]:
        e = GraphEdge(
            id=str(uuid4()),
            source_id=src,
            target_id=tgt,
            relation=RelationType.RELATES_TO,
            created_at=now - timedelta(days=7),
        )
        store._edges.setdefault(user_id, {})[e.id] = e

    # ── 코멘트 ──────────────────────────────────────────────
    if not hasattr(db, "comments"):
        db.comments = {}  # type: ignore[attr-defined]
    for author, ctype, target, content, replied, days_f in [
        ("김선생님", "노드",   "양자역학 노드",
         "이 노드에 관련 논문 링크를 추가해 보는 것은 어떨까요? arXiv의 최신 논문들을 참고하면 좋을 것 같습니다.",
         False, 0.4),
        ("박선생님", "텍스트", "세특 영역",
         "실험 결과를 수치로 표현해 주세요. 구체적인 데이터가 있으면 더 설득력 있는 세특이 됩니다.",
         True, 2.0),
        ("이선생님", "그래프", "전체 그래프",
         "과학 분야 노드들이 잘 연결되어 있어요. 인문학 분야도 연결해 보면 융합 역량을 보여줄 수 있습니다.",
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
        ("양자역학 탐구 발표 준비", "완료", 1234,
         "오늘 양자역학 발표를 준비하면서 슈뢰딩거 방정식과 파동함수 개념을 정리했습니다. "
         "불확정성 원리와 관찰자 효과에 대해서도 논의했습니다.", 3.0),
        ("물리 실험 보고서 작성", "검토 대기", 876,
         "오늘 전자기 유도 실험 결과를 정리했습니다. 패러데이 법칙 적용 방안을 검토했습니다.", 1.0),
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
    fid = str(uuid4())
    db.forms[fid] = {  # type: ignore[attr-defined]
        "id": fid, "user_id": user_id, "template_id": "setuk",
        "title": "세특 요약 보고서 — 김학생",
        "content": (
            "김학생은 물리학을 중심으로 양자역학, 고전역학, 전자기학, 열역학에 대해 탐구하였습니다. "
            "수업과 연계한 자료를 검토하고, 핵심 개념을 그래프 노드로 정리하며 탐구 과정을 심화하였습니다."
        ),
        "used_nodes": ["물리학", "양자역학", "고전역학", "전자기학"],
        "status": "완료",
        "created_at": now - timedelta(days=5),
        "updated_at": now - timedelta(days=5),
    }
