"""F1-12: 노드/문서 임베딩 인덱싱 서비스.

노드 생성 시 라벨 임베딩을 저장하고, 쿼리 문자열로 의미 유사 노드를 검색한다.
오프라인 데모에서는 InMemoryGraphStore의 코사인 검색을 사용한다.
"""

from __future__ import annotations

import logging

from app.adapters.factory import get_embedding_adapter
from app.db.factory import get_graph_store
from app.schemas.graph import GraphNode

logger = logging.getLogger(__name__)


class EmbeddingIndexService:
    def __init__(self) -> None:
        self.graph = get_graph_store()
        self.embedding = get_embedding_adapter()

    async def index_node(self, user_id: str, node: GraphNode) -> None:
        """노드 라벨의 임베딩을 계산하여 인덱스에 저장."""
        try:
            vecs = await self.embedding.embed_texts([node.label])
            await self.graph.store_embedding(user_id, node.id, vecs[0])
        except Exception as exc:
            logger.debug("임베딩 인덱싱 실패 (node=%s): %s", node.id, exc)

    async def index_nodes(self, user_id: str, nodes: list[GraphNode]) -> None:
        """여러 노드 일괄 인덱싱 (배치 임베딩 호출)."""
        if not nodes:
            return
        try:
            labels = [n.label for n in nodes]
            vecs = await self.embedding.embed_texts(labels)
            for node, vec in zip(nodes, vecs):
                await self.graph.store_embedding(user_id, node.id, vec)
        except Exception as exc:
            logger.warning("배치 임베딩 인덱싱 실패: %s", exc)

    async def search(
        self, user_id: str, query: str, top_k: int = 10
    ) -> list[tuple[GraphNode, float]]:
        """쿼리와 의미적으로 가장 유사한 노드를 반환."""
        try:
            vecs = await self.embedding.embed_texts([query])
        except Exception as exc:
            logger.warning("쿼리 임베딩 실패: %s", exc)
            return []

        try:
            hits = await self.graph.search_by_embedding(user_id, vecs[0], top_k)
        except Exception as exc:
            logger.warning("임베딩 검색 실패: %s", exc)
            return []
        if not hits:
            return []

        snapshot = await self.graph.get_snapshot(user_id)
        node_map = {n.id: n for n in snapshot.nodes}
        return [(node_map[nid], score) for nid, score in hits if nid in node_map]
