from app.adapters.embedding_mock import _deterministic_vector
from app.adapters.factory import get_embedding_adapter, get_ml_adapter
from app.db.factory import get_graph_store
from app.schemas.graph import NodeType
from app.schemas.recommendations import BranchRecommendationResponse, SuggestedKeyword


class RecommendationService:
    def __init__(self) -> None:
        self.graph = get_graph_store()
        self.ml = get_ml_adapter()
        self.embedding = get_embedding_adapter()

    async def branch_recommend(
        self,
        user_id: str,
        *,
        seeds: list[str],
        seed_node_ids: list[str],
        max_results: int,
    ) -> BranchRecommendationResponse:
        snapshot = await self.graph.get_snapshot(user_id)

        seed_labels = list(seeds)
        if seed_node_ids:
            id_to_label = {n.id: n.label for n in snapshot.nodes}
            seed_labels.extend(id_to_label[nid] for nid in seed_node_ids if nid in id_to_label)

        retrieval_labels: list[str] = []
        for node in snapshot.nodes:
            vec = _deterministic_vector(node.label)
            query_vec = _deterministic_vector(" ".join(seed_labels) or node.label)
            score = sum(a * b for a, b in zip(vec, query_vec, strict=False))
            if score > 0.3:
                retrieval_labels.append(node.label)

        suggestions: list[SuggestedKeyword] = await self.ml.suggest_branch_keywords(
            user_id=user_id,
            seeds=seed_labels,
            graph=snapshot,
            retrieval_labels=retrieval_labels,
            max_results=max_results,
        )

        return BranchRecommendationResponse(
            suggestions=suggestions,
            retrieval_count=len(retrieval_labels),
        )

    async def accept_suggestion(self, user_id: str, label: str) -> None:
        await self.graph.create_node(user_id, node_type=NodeType.KEYWORD, label=label)
