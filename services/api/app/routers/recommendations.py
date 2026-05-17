from fastapi import APIRouter, Depends, status

from app.db.factory import get_graph_store
from app.db.memory import MemoryUser
from app.db.postgres import UserRow
from app.dependencies import get_current_user
from app.schemas.graph import GraphNode, NodeType
from app.schemas.recommendations import (
    AcceptRecommendationRequest,
    BranchRecommendationRequest,
    BranchRecommendationResponse,
)
from app.services.recommendation_service import RecommendationService

router = APIRouter(prefix="/v1/students/me/recommendations", tags=["ontology-recommendations"])
service = RecommendationService()


@router.post(
    "/branch",
    response_model=BranchRecommendationResponse,
    summary="가지치기 키워드 추천 (Mock ML + RAG 스텁)",
)
async def branch_recommend(
    body: BranchRecommendationRequest,
    user: UserRow | MemoryUser = Depends(get_current_user),
) -> BranchRecommendationResponse:
    return await service.branch_recommend(
        user.id,
        seeds=body.seeds,
        seed_node_ids=body.seed_node_ids,
        max_results=body.max_results,
    )


@router.post(
    "/{suggestion_label}/accept",
    response_model=GraphNode,
    status_code=status.HTTP_201_CREATED,
    summary="추천 키워드 채택 → 그래프 노드 생성",
)
async def accept_recommendation(
    suggestion_label: str,
    user: UserRow | MemoryUser = Depends(get_current_user),
) -> GraphNode:
    label = suggestion_label.replace("_", " ")
    return await get_graph_store().create_node(user.id, node_type=NodeType.KEYWORD, label=label)


@router.post("/accept", response_model=GraphNode, status_code=status.HTTP_201_CREATED)
async def accept_recommendation_body(
    body: AcceptRecommendationRequest,
    user: UserRow | MemoryUser = Depends(get_current_user),
) -> GraphNode:
    await service.accept_suggestion(user.id, body.label)
    snapshot = await get_graph_store().get_snapshot(user.id)
    for node in reversed(snapshot.nodes):
        if node.label == body.label:
            return node
    return await get_graph_store().create_node(
        user.id, node_type=NodeType.KEYWORD, label=body.label
    )
