from fastapi import APIRouter, Depends, HTTPException, status

from app.db.factory import get_graph_store
from app.db.memory import MemoryUser
from app.db.postgres import UserRow
from app.dependencies import get_current_user
from app.schemas.graph import GraphNode, NodeType
from app.schemas.pruning import (
    ExpandRequest,
    PruningRequest,
    PruningResponse,
    ResearchRequest,
    ResearchResponse,
)
from app.schemas.recommendations import (
    AcceptRecommendationRequest,
    BranchRecommendationRequest,
    BranchRecommendationResponse,
)
from app.services.pruning_service import PruningError, PruningService
from app.services.recommendation_service import RecommendationService

router = APIRouter(prefix="/v1/students/me/recommendations", tags=["ontology-recommendations"])
service = RecommendationService()
pruning = PruningService()


@router.post(
    "/pruning",
    response_model=PruningResponse,
    summary="가지치기 추천 1단계 — 온톨로지 기반 탐구 방향 3개 (웹 검색 없음)",
)
async def pruning_recommend(
    body: PruningRequest,
    user: UserRow | MemoryUser = Depends(get_current_user),
) -> PruningResponse:
    try:
        items, cached, generator = await pruning.recommend(
            user.id, node_id=body.node_id, grade=body.grade
        )
    except PruningError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    return PruningResponse(
        node_id=body.node_id, recommendations=items, cached=cached, generator=generator
    )


@router.post(
    "/pruning/{recommendation_id}/research",
    response_model=ResearchResponse,
    summary="가지치기 추천 2단계 — 관련 자료 찾기 (이 요청에만 web_search/web_fetch 등록)",
)
async def pruning_research(
    recommendation_id: str,
    body: ResearchRequest,
    user: UserRow | MemoryUser = Depends(get_current_user),
) -> ResearchResponse:
    try:
        return await pruning.research(
            user.id,
            node_id=body.node_id,
            grade=body.grade,
            recommendation_id=recommendation_id,
        )
    except PruningError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.post(
    "/pruning/{recommendation_id}/expand",
    response_model=GraphNode,
    status_code=status.HTTP_201_CREATED,
    summary="추천을 그래프 노드로 저장하고 선택 노드와 연결",
)
async def pruning_expand(
    recommendation_id: str,
    body: ExpandRequest,
    user: UserRow | MemoryUser = Depends(get_current_user),
) -> GraphNode:
    try:
        return await pruning.expand(
            user.id,
            node_id=body.node_id,
            grade=body.grade,
            recommendation_id=recommendation_id,
        )
    except PruningError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


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
