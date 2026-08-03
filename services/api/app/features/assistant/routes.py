"""MBX AI 어시스턴트 API.

- POST   /v1/assistant/chat                 대화 (SSE 스트리밍)
- GET    /v1/assistant/conversations        최근 대화
- GET    /v1/assistant/conversations/{id}   대화 이어보기
- DELETE /v1/assistant/conversations/{id}
- GET    /v1/assistant/dashboard            대시보드 요약

브라우저 EventSource 는 Authorization 헤더를 못 붙이므로, 프론트는 fetch +
ReadableStream 으로 이 SSE 를 읽는다 (api/index.js 의 assistant.chatStream).
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.factory import get_graph_store, is_offline_demo
from app.db.postgres import CommentRow, NotificationRow, UserRow, VoiceSessionRow, utcnow
from app.dependencies import get_current_user, get_db_session
from app.errors import AppError
from app.features.research.models import ResearchProfileRow, TrackRow, UserReadRow

from .context import resolve_context
from .models import ConversationRow, MessageRow
from .schemas import (
    ChatIn,
    ContextItemOut,
    ConversationDetailOut,
    ConversationListOut,
    ConversationOut,
    DashboardOut,
    GraphSummaryOut,
    MessageOut,
    OkOut,
    PendingFeedbackItem,
    WeeklyActivityOut,
)
from .service import sse, stream_reply

logger = logging.getLogger("assistant.api")

router = APIRouter(prefix="/v1/assistant", tags=["assistant"])

CurrentUser = Annotated[UserRow, Depends(get_current_user)]
DbSession = Annotated[AsyncSession | None, Depends(get_db_session)]

TITLE_MAX = 60
PREVIEW_NODES = 8
RECENT_CONVERSATIONS = 3


def _require_db(session: AsyncSession | None) -> AsyncSession:
    if session is None or is_offline_demo():
        raise AppError(
            "ASSISTANT_OFFLINE_UNSUPPORTED",
            "AI 어시스턴트는 오프라인 데모 모드에서 지원하지 않습니다.",
            status_code=503,
        )
    return session


def _title_from(message: str) -> str:
    text = " ".join(message.split())
    return text[:TITLE_MAX] + ("…" if len(text) > TITLE_MAX else "")


async def _graph_snapshot(user_id: str):
    try:
        return await get_graph_store().get_snapshot(user_id)
    except Exception:  # noqa: BLE001 — 그래프가 없어도 대화는 되어야 한다
        logger.warning("graph snapshot unavailable user=%s", user_id)
        return None


async def _profile_block(db: AsyncSession, user: UserRow, snapshot) -> str:
    """시스템 프롬프트가 아니라 messages 로 보내는 학생 현황 (캐시 접두사 보호)."""
    lines = [f"이름: {user.display_name}"]

    row = await db.execute(
        select(TrackRow.name)
        .join(ResearchProfileRow, ResearchProfileRow.track_id == TrackRow.id)
        .where(ResearchProfileRow.user_id == user.id)
    )
    track = row.scalar_one_or_none()
    if track:
        lines.append(f"진학 희망: {track}")

    if snapshot is not None:
        nodes = list(getattr(snapshot, "nodes", []) or [])
        edges = list(getattr(snapshot, "edges", []) or [])
        if nodes:
            labels = [getattr(n, "label", "") for n in nodes][:20]
            lines.append(f"지식 그래프: 노드 {len(nodes)}개 / 연결 {len(edges)}개")
            lines.append(f"주요 노드: {', '.join(x for x in labels if x)}")
        else:
            lines.append("지식 그래프: 아직 노드가 없음")

    return "\n".join(lines)


@router.post("/chat", summary="AI 대화 (SSE 스트리밍)")
async def chat(body: ChatIn, user: CurrentUser, session: DbSession) -> StreamingResponse:
    db = _require_db(session)
    now = await utcnow()

    conversation = None
    if body.conversation_id:
        conversation = await db.get(ConversationRow, body.conversation_id)
        if conversation is not None and conversation.user_id != user.id:
            conversation = None
    if conversation is None:
        conversation = ConversationRow(
            id=str(uuid4()),
            user_id=user.id,
            title=_title_from(body.message),
            subject="",
            message_count=0,
            created_at=now,
            updated_at=now,
        )
        db.add(conversation)

    snapshot = await _graph_snapshot(user.id)
    context_block, resolved = await resolve_context(
        db,
        user.id,
        [item.model_dump() for item in body.context],
        graph_snapshot=snapshot,
    )
    profile_block = await _profile_block(db, user, snapshot)

    history_rows = await db.execute(
        select(MessageRow)
        .where(MessageRow.conversation_id == conversation.id)
        .order_by(MessageRow.created_at)
    )
    history = [{"role": m.role, "content": m.content} for m in history_rows.scalars().all()]

    db.add(
        MessageRow(
            id=str(uuid4()),
            conversation_id=conversation.id,
            role="user",
            content=body.message,
            context=json.dumps(resolved, ensure_ascii=False),
            created_at=now,
        )
    )
    if resolved and not conversation.subject:
        conversation.subject = resolved[0].get("label", "")[:120]
    await db.commit()

    conversation_id = conversation.id

    async def event_stream() -> AsyncIterator[str]:
        answer: list[str] = []
        cards: list[dict] = []

        yield sse({"type": "start", "conversation_id": conversation_id})

        async for event in stream_reply(history, body.message, context_block, profile_block):
            if event["type"] == "delta":
                answer.append(event["text"])
            elif event["type"] == "card":
                cards.append(event["card"])
            yield sse(event)

        # 스트림이 끝난 뒤에 저장한다 — 중간에 끊기면 반쪽짜리 답변이 남지 않게
        text = "".join(answer).strip()
        if text or cards:
            finished = await utcnow()
            db.add(
                MessageRow(
                    id=str(uuid4()),
                    conversation_id=conversation_id,
                    role="assistant",
                    content=text,
                    cards=json.dumps(cards, ensure_ascii=False),
                    created_at=finished,
                )
            )
            row = await db.get(ConversationRow, conversation_id)
            if row is not None:
                row.message_count = (row.message_count or 0) + 2
                row.updated_at = finished
            await db.commit()

        yield sse({"type": "done", "conversation_id": conversation_id})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/conversations", response_model=ConversationListOut, summary="최근 대화")
async def list_conversations(
    user: CurrentUser,
    session: DbSession,
    limit: Annotated[int, Query(ge=1, le=20)] = RECENT_CONVERSATIONS,
) -> ConversationListOut:
    db = _require_db(session)
    rows = await db.execute(
        select(ConversationRow)
        .where(ConversationRow.user_id == user.id, ConversationRow.message_count > 0)
        .order_by(ConversationRow.updated_at.desc())
        .limit(limit)
    )
    return ConversationListOut(
        conversations=[
            ConversationOut(
                id=c.id,
                title=c.title,
                subject=c.subject,
                message_count=c.message_count,
                updated_at=c.updated_at,
            )
            for c in rows.scalars().all()
        ]
    )


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationDetailOut,
    summary="대화 이어보기",
)
async def get_conversation(
    conversation_id: str, user: CurrentUser, session: DbSession
) -> ConversationDetailOut:
    db = _require_db(session)
    conversation = await db.get(ConversationRow, conversation_id)
    if conversation is None or conversation.user_id != user.id:
        raise AppError("ASSISTANT_NOT_FOUND", "대화를 찾을 수 없습니다.", status_code=404)

    rows = await db.execute(
        select(MessageRow)
        .where(MessageRow.conversation_id == conversation_id)
        .order_by(MessageRow.created_at)
    )
    return ConversationDetailOut(
        id=conversation.id,
        title=conversation.title,
        subject=conversation.subject,
        messages=[
            MessageOut(
                id=m.id,
                role=m.role,
                content=m.content,
                context=[ContextItemOut(**c) for c in json.loads(m.context or "[]")],
                cards=json.loads(m.cards or "[]"),
                created_at=m.created_at,
            )
            for m in rows.scalars().all()
        ],
    )


@router.delete("/conversations/{conversation_id}", response_model=OkOut, summary="대화 삭제")
async def delete_conversation(
    conversation_id: str, user: CurrentUser, session: DbSession
) -> OkOut:
    db = _require_db(session)
    conversation = await db.get(ConversationRow, conversation_id)
    if conversation is None or conversation.user_id != user.id:
        raise AppError("ASSISTANT_NOT_FOUND", "대화를 찾을 수 없습니다.", status_code=404)
    await db.execute(delete(MessageRow).where(MessageRow.conversation_id == conversation_id))
    await db.delete(conversation)
    await db.commit()
    return OkOut()


@router.get("/dashboard", response_model=DashboardOut, summary="대시보드 요약")
async def dashboard(user: CurrentUser, session: DbSession) -> DashboardOut:
    """대시보드가 한 번에 필요한 것만 모아준다 — 화면이 5번 호출하지 않도록."""
    db = _require_db(session)
    week_ago = datetime.now(UTC) - timedelta(days=7)

    snapshot = await _graph_snapshot(user.id)
    graph = _graph_summary(snapshot, week_ago)

    articles_read = await db.scalar(
        select(func.count())
        .select_from(UserReadRow)
        .where(UserReadRow.user_id == user.id, UserReadRow.read_at >= week_ago)
    )
    voice_sessions = await db.scalar(
        select(func.count())
        .select_from(VoiceSessionRow)
        .where(VoiceSessionRow.user_id == user.id, VoiceSessionRow.created_at >= week_ago)
    )
    resolved = await db.scalar(
        select(func.count())
        .select_from(CommentRow)
        .where(
            CommentRow.user_id == user.id,
            CommentRow.replied.is_(True),
            CommentRow.created_at >= week_ago,
        )
    )
    unread = await db.scalar(
        select(func.count())
        .select_from(NotificationRow)
        .where(NotificationRow.user_id == user.id, NotificationRow.read.is_(False))
    )

    # 확인/행동이 필요한 코멘트만 — 전부 보여주는 화면이 아니다
    pending_rows = await db.execute(
        select(CommentRow)
        .where(CommentRow.user_id == user.id, CommentRow.replied.is_(False))
        .order_by(CommentRow.created_at.desc())
        .limit(3)
    )
    pending = [
        PendingFeedbackItem(
            id=c.id,
            author=c.author,
            role="멘토",
            target=c.target,
            excerpt=(c.content or "")[:120],
            created_at=c.created_at,
            read=False,
            resolved=False,
        )
        for c in pending_rows.scalars().all()
    ]
    pending_count = await db.scalar(
        select(func.count())
        .select_from(CommentRow)
        .where(CommentRow.user_id == user.id, CommentRow.replied.is_(False))
    )

    profile = await db.execute(
        select(TrackRow.name)
        .join(ResearchProfileRow, ResearchProfileRow.track_id == TrackRow.id)
        .where(ResearchProfileRow.user_id == user.id)
    )
    track_name = profile.scalar_one_or_none()

    weekly = WeeklyActivityOut(
        nodes_added=_recent_node_count(snapshot, week_ago),
        articles_read=articles_read or 0,
        feedback_resolved=resolved or 0,
        voice_sessions=voice_sessions or 0,
    )
    weekly.has_activity = any(
        [weekly.nodes_added, weekly.articles_read, weekly.feedback_resolved, weekly.voice_sessions]
    )

    return DashboardOut(
        user_name=user.display_name,
        onboarded=track_name is not None,
        track_name=track_name,
        unread_notifications=unread or 0,
        weekly=weekly,
        graph=graph,
        pending_feedback=pending,
        pending_feedback_count=pending_count or 0,
    )


def _recent_node_count(snapshot, since: datetime) -> int:
    if snapshot is None:
        return 0
    count = 0
    for node in getattr(snapshot, "nodes", []) or []:
        created = getattr(node, "created_at", None)
        if isinstance(created, datetime) and created >= since:
            count += 1
    return count


def _graph_summary(snapshot, since: datetime) -> GraphSummaryOut:
    if snapshot is None:
        return GraphSummaryOut()
    nodes = list(getattr(snapshot, "nodes", []) or [])
    edges = list(getattr(snapshot, "edges", []) or [])
    if not nodes:
        return GraphSummaryOut()

    def created(node):
        value = getattr(node, "created_at", None)
        return value if isinstance(value, datetime) else datetime.min.replace(tzinfo=UTC)

    ordered = sorted(nodes, key=created, reverse=True)
    last = created(ordered[0])

    # 미리보기는 핵심 노드 위주로 잘라 보낸다 — 전체 그래프를 그리면 카드가 뭉갠다
    preview = ordered[:PREVIEW_NODES]
    preview_ids = {getattr(n, "id", None) for n in preview}
    return GraphSummaryOut(
        node_count=len(nodes),
        edge_count=len(edges),
        recent_nodes=[getattr(n, "label", "") for n in ordered[:3] if getattr(n, "label", "")],
        last_updated=last if last.year > 1 else None,
        preview_nodes=[
            {
                "id": getattr(n, "id", ""),
                "label": getattr(n, "label", ""),
                "kind": getattr(getattr(n, "type", None), "value", None)
                or str(getattr(n, "type", "") or "topic"),
                "recent": created(n) >= since,
            }
            for n in preview
        ],
        preview_edges=[
            {"source": e.source_id, "target": e.target_id}
            for e in edges
            if getattr(e, "source_id", None) in preview_ids
            and getattr(e, "target_id", None) in preview_ids
        ][:12],
        suggested_count=max(0, min(5, len(nodes) // 4)),
    )
