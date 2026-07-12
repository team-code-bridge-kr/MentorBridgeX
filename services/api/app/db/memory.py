"""In-memory stores for OFFLINE_DEMO=1 (no Docker / no Neo4j·PostgreSQL)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
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
