from fastapi import APIRouter, Depends, status

from app.db.factory import get_graph_store
from app.db.memory import MemoryUser
from app.db.postgres import UserRow
from app.dependencies import get_current_user
from app.errors import AppError
from app.schemas.graph import (
    EdgeCreateRequest,
    GraphEdge,
    GraphNode,
    GraphSnapshot,
    NodeCreateRequest,
    NodePatchRequest,
    SeedRequest,
)

router = APIRouter(prefix="/v1/students/me/graph", tags=["ontology-graph"])


def _store():
    return get_graph_store()


@router.get("", response_model=GraphSnapshot, summary="전체 그래프 스냅샷")
async def get_graph(user: UserRow | MemoryUser = Depends(get_current_user)) -> GraphSnapshot:
    return await _store().get_snapshot(user.id)


@router.post("/seed", response_model=list[GraphNode], summary="시드 키워드 등록")
async def create_seed(
    body: SeedRequest,
    user: UserRow | MemoryUser = Depends(get_current_user),
) -> list[GraphNode]:
    return await _store().create_seeds(user.id, body.seeds)


@router.post("/nodes", response_model=GraphNode, status_code=status.HTTP_201_CREATED)
async def create_node(
    body: NodeCreateRequest,
    user: UserRow | MemoryUser = Depends(get_current_user),
) -> GraphNode:
    return await _store().create_node(
        user.id,
        node_type=body.type,
        label=body.label,
        description=body.description,
        external_refs=body.external_refs,
    )


@router.patch("/nodes/{node_id}", response_model=GraphNode)
async def patch_node(
    node_id: str,
    body: NodePatchRequest,
    user: UserRow | MemoryUser = Depends(get_current_user),
) -> GraphNode:
    node = await _store().patch_node(user.id, node_id, label=body.label, description=body.description)
    if not node:
        raise AppError("DOC_NOT_FOUND", "노드를 찾을 수 없습니다.", status_code=404)
    return node


@router.delete("/nodes/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_node(
    node_id: str, user: UserRow | MemoryUser = Depends(get_current_user)
) -> None:
    if not await _store().delete_node(user.id, node_id):
        raise AppError("DOC_NOT_FOUND", "노드를 찾을 수 없습니다.", status_code=404)


@router.post("/edges", response_model=GraphEdge, status_code=status.HTTP_201_CREATED)
async def create_edge(
    body: EdgeCreateRequest,
    user: UserRow | MemoryUser = Depends(get_current_user),
) -> GraphEdge:
    return await _store().create_edge(
        user.id, source_id=body.source_id, target_id=body.target_id, relation=body.relation
    )


@router.delete("/edges/{edge_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_edge(
    edge_id: str, user: UserRow | MemoryUser = Depends(get_current_user)
) -> None:
    if not await _store().delete_edge(user.id, edge_id):
        raise AppError("DOC_NOT_FOUND", "엣지를 찾을 수 없습니다.", status_code=404)
