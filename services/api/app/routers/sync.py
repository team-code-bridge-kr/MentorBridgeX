"""F1-06: 그래프-텍스트 양방향 동기화 라우터."""

from fastapi import APIRouter, Depends

from app.db.memory import MemoryUser
from app.db.postgres import UserRow
from app.dependencies import get_current_user
from app.schemas.sync import (
    GraphToTextRequest,
    GraphToTextResult,
    TextToGraphRequest,
    TextToGraphResult,
)
from app.services.sync_service import SyncService

router = APIRouter(prefix="/v1/students/me/graph/sync", tags=["graph-text-sync"])


@router.post(
    "/text-to-graph",
    response_model=TextToGraphResult,
    summary="F1-06 텍스트 → 그래프: 섹션 수정 시 증분 노드 추가",
)
async def text_to_graph(
    body: TextToGraphRequest,
    user: UserRow | MemoryUser = Depends(get_current_user),
) -> TextToGraphResult:
    return await SyncService().text_to_graph(user.id, body.section_title, body.text)


@router.post(
    "/graph-to-text",
    response_model=GraphToTextResult,
    summary="F1-06 그래프 → 텍스트: 노드를 텍스트에 삽입할 문장 LLM 제안",
)
async def graph_to_text(
    body: GraphToTextRequest,
    user: UserRow | MemoryUser = Depends(get_current_user),
) -> GraphToTextResult:
    return await SyncService().graph_to_text(
        user.id, body.node_id, body.section_title, body.section_text
    )
