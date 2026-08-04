"""최근 활동 API.

- GET    /v1/activity/recent      통합 목록 (검색·필터 포함)
- PATCH  /v1/activity/{key}       이름 변경 · 고정
- DELETE /v1/activity/{key}       목록에서 숨기기 (원본은 그대로)

사이드바와 대시보드가 **같은 엔드포인트**를 쓴다. 두 곳이 각자 목록을 만들면
정렬이 달라지고, 한쪽에서 이름을 바꿔도 다른 쪽은 옛 이름을 계속 보여준다.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import UserRow, utcnow
from app.dependencies import get_current_user, get_db_session
from app.errors import AppError
from app.features.assistant.models import ConversationRow, MessageRow

from . import service
from .models import MAX_PINNED, ActivityMetaRow
from .schemas import (
    ActivityListOut,
    ActivityOut,
    ActivityPatchIn,
    OkOut,
    RelatedRef,
    RestoreTarget,
    ResultSummary,
)

router = APIRouter(prefix="/v1/activity", tags=["activity"])

CurrentUser = Annotated[UserRow, Depends(get_current_user)]
DbSession = Annotated[AsyncSession | None, Depends(get_db_session)]

DEFAULT_LIMIT = 8
MAX_LIMIT = 100
# 필터 값 → 이 유형들 중 하나라도 걸리면 보여준다.
# 복합 활동은 포함된 유형 중 하나만 맞아도 나와야 한다.
FILTERS = {
    "all": None,
    "conversation": {service.TYPE_CONVERSATION},
    "reading": {service.TYPE_ARTICLE, service.TYPE_PAPER},
    "graph": {service.TYPE_GRAPH},
    "feedback": {service.TYPE_FEEDBACK},
    "document": {service.TYPE_DOCUMENT, service.TYPE_FORM},
    "voice": {service.TYPE_VOICE},
}


def _require_db(session: AsyncSession | None) -> AsyncSession:
    if session is None:
        raise AppError("DB_UNAVAILABLE", "데이터베이스에 연결할 수 없습니다.", status_code=503)
    return session


async def _meta_map(db: AsyncSession, user_id: str) -> dict[str, ActivityMetaRow]:
    rows = (
        await db.execute(select(ActivityMetaRow).where(ActivityMetaRow.user_id == user_id))
    ).scalars().all()
    return {r.activity_key: r for r in rows}


def _to_out(activity: service.Activity, meta: ActivityMetaRow | None) -> ActivityOut:
    title = activity.title
    generated = activity.generated_title
    if meta is not None and meta.title:
        title = meta.title
        generated = False

    restore_type = "conversation" if activity.conversation_id else activity.primary_type
    return ActivityOut(
        id=activity.key,
        conversation_id=activity.conversation_id,
        title=title,
        generated_title=generated,
        primary_type=activity.primary_type,
        context_types=activity.context_types,
        context_summary=service.context_summary(activity),
        related_article=(
            RelatedRef(id=activity.article[0], title=activity.article[1])
            if activity.article
            else None
        ),
        related_graph=(
            RelatedRef(id=activity.graph[0], title=activity.graph[1]) if activity.graph else None
        ),
        related_feedback=(
            RelatedRef(id=activity.feedback[0], title=activity.feedback[1])
            if activity.feedback
            else None
        ),
        result_summary=ResultSummary(
            message_count=activity.message_count,
            added_node_count=activity.added_node_count,
            resolved_comment_count=activity.resolved_comment_count,
            saved_article_count=activity.saved_article_count,
            modified_document_count=activity.modified_document_count,
        ),
        updated_at=activity.updated_at,
        created_at=activity.created_at,
        restore_target=RestoreTarget(
            type=restore_type,
            route=activity.route,
            conversation_id=activity.conversation_id,
            contexts=activity.contexts,
        ),
        pinned=bool(meta and meta.pinned),
        search_hint=activity.search_hint,
    )


@router.get("/recent", response_model=ActivityListOut, summary="최근 활동 (통합)")
async def recent(
    user: CurrentUser,
    session: DbSession,
    limit: Annotated[int, Query(ge=1, le=MAX_LIMIT)] = DEFAULT_LIMIT,
    kind: Annotated[str, Query(description="all | conversation | reading | graph | feedback | document | voice")] = "all",
    q: Annotated[str, Query(max_length=80)] = "",
) -> ActivityListOut:
    db = _require_db(session)
    if kind not in FILTERS:
        raise AppError("ACTIVITY_BAD_FILTER", f"알 수 없는 필터입니다: {kind}", status_code=400)

    now = datetime.now(UTC)
    collected = await service.collect(db, user.id, now)
    meta = await _meta_map(db, user.id)

    items = [
        _to_out(a, meta.get(a.key))
        for a in collected
        if not (meta.get(a.key) and meta[a.key].hidden)
    ]

    wanted = FILTERS[kind]
    if wanted:
        items = [
            it
            for it in items
            if wanted & (set(it.context_types) | {it.primary_type})
        ]

    query = q.strip().lower()
    if query:
        items = [
            it
            for it in items
            if query in it.title.lower()
            or query in it.context_summary.lower()
            or query in it.search_hint.lower()
        ]

    total = len(items)
    # 고정은 시간순에서 밀리지 않게 붙잡아 두는 것 — 항상 위로
    items.sort(key=lambda it: (not it.pinned, -it.updated_at.timestamp()))
    return ActivityListOut(items=items[:limit], total=total, pinned_limit=MAX_PINNED)


@router.patch("/{activity_key:path}", response_model=OkOut, summary="이름 변경 · 고정")
async def update(
    activity_key: str,
    body: ActivityPatchIn,
    user: CurrentUser,
    session: DbSession,
) -> OkOut:
    db = _require_db(session)
    row = await db.get(ActivityMetaRow, (user.id, activity_key))
    now = await utcnow()
    if row is None:
        row = ActivityMetaRow(user_id=user.id, activity_key=activity_key, updated_at=now)
        db.add(row)

    if body.title is not None:
        title = " ".join(body.title.split())[:160]
        if not title:
            raise AppError("ACTIVITY_TITLE_EMPTY", "이름을 입력해 주세요.", status_code=400)
        row.title = title
    if body.pinned is not None:
        if body.pinned and not row.pinned:
            pinned_now = await db.scalar(
                select(func.count())
                .select_from(ActivityMetaRow)
                .where(ActivityMetaRow.user_id == user.id, ActivityMetaRow.pinned.is_(True))
            )
            if (pinned_now or 0) >= MAX_PINNED:
                raise AppError(
                    "ACTIVITY_PIN_LIMIT",
                    f"고정은 {MAX_PINNED}개까지예요. 하나를 풀고 다시 시도해 주세요.",
                    status_code=400,
                )
        row.pinned = body.pinned
    row.updated_at = now
    await db.commit()
    return OkOut()


@router.delete("/{activity_key:path}", response_model=OkOut, summary="목록에서 숨기기")
async def remove(
    activity_key: str,
    user: CurrentUser,
    session: DbSession,
    delete_source: Annotated[
        bool, Query(description="대화까지 지울지. 그래프·문서 원본은 어떤 경우에도 지우지 않는다.")
    ] = False,
) -> OkOut:
    """기본은 **목록에서 숨기기**다.

    최근 활동에서 지운다고 그래프·기사·문서가 사라지면 안 된다. 대화만은
    사용자가 명시적으로 요청하면(delete_source) 함께 지운다 — 그 대화는
    이 활동 말고 다른 데서 쓰이지 않기 때문이다.
    """
    db = _require_db(session)
    now = await utcnow()
    row = await db.get(ActivityMetaRow, (user.id, activity_key))
    if row is None:
        row = ActivityMetaRow(user_id=user.id, activity_key=activity_key, updated_at=now)
        db.add(row)
    row.hidden = True
    row.pinned = False
    row.updated_at = now

    if delete_source and activity_key.startswith("conv:"):
        conversation_id = activity_key.split(":", 1)[1]
        conversation = await db.get(ConversationRow, conversation_id)
        if conversation is not None and conversation.user_id == user.id:
            await db.execute(
                delete(MessageRow).where(MessageRow.conversation_id == conversation_id)
            )
            await db.delete(conversation)

    await db.commit()
    return OkOut()
