from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.factory import get_graph_store
from app.db.memory import MemoryUser
from app.db.postgres import UserRow
from app.dependencies import get_current_user, get_db_session
from app.errors import AppError
from app.schemas.graph import (
    EdgeCreateRequest,
    GraphEdge,
    GraphNode,
    GraphGaps,
    GraphSnapshot,
    GapEmptySubject,
    GapFadedTopic,
    GapLonelyNode,
    LinkSuggestion,
    NodeCreateRequest,
    NodeEvidence,
    NodePatchRequest,
    RelationType,
    SeedRequest,
)
from app.services import node_evidence, node_gaps, node_links
from app.services.document_service import DocumentService

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
    session: AsyncSession | None = Depends(get_db_session),
) -> list[GraphNode]:
    nodes = await _store().create_seeds(user.id, body.seeds)
    if nodes:
        from app.routers.product import _push_notification  # noqa: PLC0415
        labels = ", ".join(n.label for n in nodes[:3])
        suffix = f" 외 {len(nodes) - 3}개" if len(nodes) > 3 else ""
        await _push_notification(
            user.id,
            title="그래프 시드 추가됨",
            body=f"{labels}{suffix} 키워드로 지식 그래프가 시작되었습니다.",
            icon="graph",
            session=session,
        )
    return nodes


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
    node = await _store().patch_node(
        user.id,
        node_id,
        label=body.label,
        description=body.description,
        node_type=body.type,
        external_refs=body.external_refs,
    )
    if not node:
        raise AppError("DOC_NOT_FOUND", "노드를 찾을 수 없습니다.", status_code=404)
    return node


@router.get("/nodes/{node_id}/evidence", response_model=NodeEvidence, summary="노드의 출처 문장")
async def get_node_evidence(
    node_id: str,
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> NodeEvidence:
    """이 노드 이름이 적혀 있던 생기부 문장을 찾아 준다.

    저장해 둔 값을 꺼내는 게 아니라 그때그때 원문에서 찾는다 —
    까닭은 `services/node_evidence.py` 머리말에.
    """
    node = await _store().get_node(user.id, node_id)
    if not node:
        raise AppError("DOC_NOT_FOUND", "노드를 찾을 수 없습니다.", status_code=404)
    sections = await DocumentService().list_sections(session, user.id)
    return node_evidence.collect(node, sections)


@router.get("/links/suggested", response_model=list[LinkSuggestion], summary="이어 볼 만한 노드 짝")
async def suggest_links(
    limit: int = 30,
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> list[LinkSuggestion]:
    """생기부 **같은 문장**에 함께 나온 노드 짝을 찾아 준다.

    잇지는 않는다. 근거 문장을 함께 돌려주고 결정은 학생이 한다 — 근거가 약한
    연결이 자동으로 늘면 그래프가 다시 못 읽는 그림이 된다.
    """
    snapshot = await _store().get_snapshot(user.id)
    existing = {
        (e.source_id, e.target_id) if e.source_id < e.target_id else (e.target_id, e.source_id)
        for e in snapshot.edges
    }
    sections = await DocumentService().list_sections(session, user.id)
    found = node_links.suggest_links(snapshot.nodes, sections, existing, limit=max(1, min(limit, 60)))
    return [
        LinkSuggestion(
            source_id=s.source_id,
            target_id=s.target_id,
            source_label=s.source_label,
            target_label=s.target_label,
            count=s.count,
            section_label=s.section_label,
            sentence=s.sentence,
        )
        for s in found
    ]


@router.get("/gaps", response_model=GraphGaps, summary="그래프의 빈 곳")
async def get_gaps(
    user: UserRow | MemoryUser = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_session),
) -> GraphGaps:
    """있는 것 말고 **없는 것**을 말한다.

    있는 것은 학생이 이미 안다 — 자기가 쓴 생기부다. 정작 모르는 건 없는
    것이다. 판단은 하지 않고 사실만 셋 말한다(까닭은 `services/node_gaps.py`).
    """
    snapshot = await _store().get_snapshot(user.id)
    sections = await DocumentService().list_sections(session, user.id)
    return GraphGaps(
        empty_subjects=[
            GapEmptySubject(
                section_id=x.section_id,
                section_type=x.section_type,
                where=x.where,
                chars=x.chars,
            )
            for x in node_gaps.empty_subjects(snapshot.nodes, sections)
        ],
        lonely_nodes=[
            GapLonelyNode(node_id=x.node_id, label=x.label, section=x.section)
            for x in node_gaps.lonely_nodes(snapshot.nodes, snapshot.edges)
        ],
        faded_topics=[
            GapFadedTopic(node_id=x.node_id, label=x.label, last_seen=x.last_seen, grades=x.grades)
            for x in node_gaps.faded_topics(snapshot.nodes, sections)
        ],
    )


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
