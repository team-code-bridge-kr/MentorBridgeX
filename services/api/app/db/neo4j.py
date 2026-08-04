import json
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from neo4j import AsyncDriver, AsyncGraphDatabase

from app.config import get_settings
from app.schemas.graph import GraphEdge, GraphNode, GraphSnapshot, NodeType, RelationType

_driver: AsyncDriver | None = None


def get_neo4j_driver() -> AsyncDriver:
    global _driver
    if _driver is None:
        settings = get_settings()
        _driver = AsyncGraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_user, settings.neo4j_password),
        )
    return _driver


async def close_neo4j() -> None:
    global _driver
    if _driver is not None:
        await _driver.close()
        _driver = None


async def init_neo4j() -> None:
    driver = get_neo4j_driver()
    async with driver.session() as session:
        await session.run(
            "CREATE CONSTRAINT node_id IF NOT EXISTS FOR (n:Node) REQUIRE n.node_id IS UNIQUE"
        )


def _to_datetime(value: Any) -> datetime:
    if value is None:
        return datetime.now(UTC)
    if isinstance(value, datetime):
        return value
    if hasattr(value, "to_native"):
        return value.to_native()
    text = str(value).replace("Z", "+00:00")
    return datetime.fromisoformat(text)


def _parse_node(record: dict[str, Any]) -> GraphNode:
    refs_raw = record.get("external_refs_json")
    refs: dict[str, Any] = {}
    if isinstance(refs_raw, str) and refs_raw.strip():
        try:
            parsed = json.loads(refs_raw)
            if isinstance(parsed, dict):
                refs = parsed
        except json.JSONDecodeError:
            refs = {}
    return GraphNode(
        id=record["node_id"],
        type=NodeType(record["type"]),
        label=record["label"],
        description=record.get("description"),
        external_refs=refs,
        created_at=_to_datetime(record.get("created_at")),
        updated_at=_to_datetime(record.get("updated_at")),
    )


def _parse_edge(record: dict[str, Any]) -> GraphEdge:
    return GraphEdge(
        id=record["edge_id"],
        source_id=record["source_id"],
        target_id=record["target_id"],
        relation=RelationType(record["relation"]),
        created_at=_to_datetime(record.get("created_at")),
    )


class Neo4jGraphStore:
    async def get_snapshot(self, user_id: str) -> GraphSnapshot:
        driver = get_neo4j_driver()
        async with driver.session() as session:
            nodes_result = await session.run(
                """
                MATCH (n:Node {user_id: $user_id})
                RETURN n.node_id AS node_id, n.type AS type, n.label AS label,
                       n.description AS description,
                       n.external_refs_json AS external_refs_json,
                       n.created_at AS created_at, n.updated_at AS updated_at
                ORDER BY n.created_at
                """,
                user_id=user_id,
            )
            nodes = [_parse_node(dict(r)) async for r in nodes_result]

            edges_result = await session.run(
                """
                MATCH (a:Node {user_id: $user_id})-[r:REL]->(b:Node {user_id: $user_id})
                RETURN r.edge_id AS edge_id, a.node_id AS source_id, b.node_id AS target_id,
                       r.relation AS relation, r.created_at AS created_at
                ORDER BY r.created_at
                """,
                user_id=user_id,
            )
            edges = [_parse_edge(dict(r)) async for r in edges_result]
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
        now = datetime.now(UTC)
        node_id = str(uuid4())
        driver = get_neo4j_driver()
        async with driver.session() as session:
            await session.run(
                """
                CREATE (n:Node {
                    node_id: $node_id, user_id: $user_id, type: $type, label: $label,
                    description: $description, external_refs_json: $external_refs_json,
                    created_at: datetime($created_at), updated_at: datetime($updated_at)
                })
                """,
                node_id=node_id,
                user_id=user_id,
                type=node_type.value,
                label=label,
                description=description,
                external_refs_json=json.dumps(external_refs or {}, ensure_ascii=False),
                created_at=now.isoformat(),
                updated_at=now.isoformat(),
            )
        return GraphNode(
            id=node_id,
            type=node_type,
            label=label,
            description=description,
            external_refs=external_refs or {},
            created_at=now,
            updated_at=now,
        )

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
        now = datetime.now(UTC)
        driver = get_neo4j_driver()
        # coalesce 로 "안 보낸 값은 그대로" 를 만든다. external_refs 는 통째로
        # 갈아 끼운다 — 부분 병합은 호출부가 원래 값을 알아야 해서 더 헷갈린다.
        refs_json = json.dumps(external_refs, ensure_ascii=False) if external_refs is not None else None
        async with driver.session() as session:
            result = await session.run(
                """
                MATCH (n:Node {user_id: $user_id, node_id: $node_id})
                SET n.updated_at = datetime($updated_at),
                    n.label = coalesce($label, n.label),
                    n.description = coalesce($description, n.description),
                    n.type = coalesce($node_type, n.type),
                    n.external_refs_json = coalesce($refs_json, n.external_refs_json)
                RETURN n.node_id AS node_id, n.type AS type, n.label AS label,
                       n.description AS description,
                       n.external_refs_json AS external_refs_json,
                       n.created_at AS created_at, n.updated_at AS updated_at
                """,
                user_id=user_id,
                node_id=node_id,
                label=label,
                description=description,
                node_type=node_type.value if hasattr(node_type, "value") else node_type,
                refs_json=refs_json,
                updated_at=now.isoformat(),
            )
            record = await result.single()
            if not record:
                return None
            return _parse_node(dict(record))

    async def get_node(self, user_id: str, node_id: str) -> GraphNode | None:
        driver = get_neo4j_driver()
        async with driver.session() as session:
            result = await session.run(
                """
                MATCH (n:Node {user_id: $user_id, node_id: $node_id})
                RETURN n.node_id AS node_id, n.type AS type, n.label AS label,
                       n.description AS description,
                       n.external_refs_json AS external_refs_json,
                       n.created_at AS created_at, n.updated_at AS updated_at
                """,
                user_id=user_id,
                node_id=node_id,
            )
            record = await result.single()
            return _parse_node(dict(record)) if record else None

    async def delete_node(self, user_id: str, node_id: str) -> bool:
        driver = get_neo4j_driver()
        async with driver.session() as session:
            result = await session.run(
                """
                MATCH (n:Node {user_id: $user_id, node_id: $node_id})
                DETACH DELETE n
                RETURN count(n) AS deleted
                """,
                user_id=user_id,
                node_id=node_id,
            )
            record = await result.single()
            return bool(record and record["deleted"] > 0)

    # ── Embeddings (F1-12) ────────────────────────────────────────────────────

    async def store_embedding(self, user_id: str, node_id: str, vector: list[float]) -> None:
        """Store a node's label embedding as a property for cosine search."""
        driver = get_neo4j_driver()
        async with driver.session() as session:
            await session.run(
                """
                MATCH (n:Node {user_id: $user_id, node_id: $node_id})
                SET n.embedding = $vector
                """,
                user_id=user_id,
                node_id=node_id,
                vector=[float(v) for v in vector],
            )

    async def search_by_embedding(
        self, user_id: str, vector: list[float], top_k: int = 10
    ) -> list[tuple[str, float]]:
        """Return (node_id, cosine similarity) ranked descending.

        vector.similarity.cosine returns null when dimensions differ, so a change of
        embedding adapter degrades to fewer hits instead of erroring.
        """
        if not vector:
            return []
        driver = get_neo4j_driver()
        async with driver.session() as session:
            result = await session.run(
                """
                MATCH (n:Node {user_id: $user_id})
                WHERE n.embedding IS NOT NULL
                WITH n, vector.similarity.cosine(n.embedding, $vector) AS score
                WHERE score IS NOT NULL
                RETURN n.node_id AS node_id, score
                ORDER BY score DESC
                LIMIT $top_k
                """,
                user_id=user_id,
                vector=[float(v) for v in vector],
                top_k=top_k,
            )
            return [(r["node_id"], float(r["score"])) async for r in result]

    async def create_edge(
        self, user_id: str, *, source_id: str, target_id: str, relation: RelationType
    ) -> GraphEdge:
        now = datetime.now(UTC)
        edge_id = str(uuid4())
        driver = get_neo4j_driver()
        async with driver.session() as session:
            await session.run(
                """
                MATCH (a:Node {user_id: $user_id, node_id: $source_id})
                MATCH (b:Node {user_id: $user_id, node_id: $target_id})
                CREATE (a)-[r:REL {
                    edge_id: $edge_id, relation: $relation,
                    created_at: datetime($created_at)
                }]->(b)
                """,
                user_id=user_id,
                source_id=source_id,
                target_id=target_id,
                edge_id=edge_id,
                relation=relation.value,
                created_at=now.isoformat(),
            )
        return GraphEdge(
            id=edge_id,
            source_id=source_id,
            target_id=target_id,
            relation=relation,
            created_at=now,
        )

    async def delete_edge(self, user_id: str, edge_id: str) -> bool:
        driver = get_neo4j_driver()
        async with driver.session() as session:
            result = await session.run(
                """
                MATCH (a:Node {user_id: $user_id})-[r:REL {edge_id: $edge_id}]->
                      (b:Node {user_id: $user_id})
                DELETE r
                RETURN count(r) AS deleted
                """,
                user_id=user_id,
                edge_id=edge_id,
            )
            record = await result.single()
            return bool(record and record["deleted"] > 0)

    async def create_seeds(self, user_id: str, seeds: list[str]) -> list[GraphNode]:
        created: list[GraphNode] = []
        for seed in seeds:
            created.append(
                await self.create_node(user_id, node_type=NodeType.KEYWORD, label=seed.strip())
            )
        return created
