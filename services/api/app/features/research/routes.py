"""탐구주제 피드 API.

- GET    /v1/research/tracks              학과 프리셋 목록
- GET    /v1/research/profile             내 트랙 / 온보딩 여부
- PUT    /v1/research/profile             트랙 선택 → 프리셋 키워드 적용
- GET    /v1/research/keywords            내 키워드
- POST   /v1/research/keywords            키워드 추가 (manual)
- DELETE /v1/research/keywords/{keyword}  키워드 삭제
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Path
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.factory import is_offline_demo
from app.db.postgres import UserRow, utcnow
from app.dependencies import get_current_user, get_db_session
from app.errors import AppError

from .models import (
    KW_MANUAL,
    KW_PRESET,
    ResearchProfileRow,
    TrackKeywordRow,
    TrackRow,
    UserKeywordRow,
)
from .schemas import (
    KeywordCreateIn,
    KeywordListOut,
    KeywordOut,
    OkOut,
    ProfileOut,
    ProfileUpdateIn,
    TrackListOut,
    TrackOut,
)
from .seed_data import TRACKS

router = APIRouter(prefix="/v1/research", tags=["research"])

CurrentUser = Annotated[UserRow, Depends(get_current_user)]
DbSession = Annotated[AsyncSession | None, Depends(get_db_session)]


def _require_db(session: AsyncSession | None) -> AsyncSession:
    """오프라인 데모 모드에서는 수집·개인화 기능을 제공하지 않는다."""
    if session is None or is_offline_demo():
        raise AppError(
            "RESEARCH_OFFLINE_UNSUPPORTED",
            "탐구 피드는 오프라인 데모 모드에서 지원하지 않습니다.",
            status_code=503,
        )
    return session


def _normalize(keyword: str) -> str:
    return " ".join(keyword.split()).strip()


@router.get("/tracks", response_model=TrackListOut, summary="학과 프리셋 목록")
async def list_tracks(session: DbSession) -> TrackListOut:
    # 트랙은 상수 시드라 오프라인 모드에서도 그대로 보여준다 (온보딩 화면 미리보기용)
    if session is None or is_offline_demo():
        return TrackListOut(
            tracks=[
                TrackOut(id=t[0], name=t[1], field=t[2], description=t[3], keywords=t[4])
                for t in TRACKS
            ]
        )

    rows = await session.execute(select(TrackRow).order_by(TrackRow.sort_order))
    tracks = list(rows.scalars().all())
    kw_rows = await session.execute(
        select(TrackKeywordRow.track_id, TrackKeywordRow.keyword).order_by(
            TrackKeywordRow.weight.desc(), TrackKeywordRow.keyword
        )
    )
    by_track: dict[str, list[str]] = {}
    for track_id, keyword in kw_rows.all():
        by_track.setdefault(track_id, []).append(keyword)

    return TrackListOut(
        tracks=[
            TrackOut(
                id=t.id,
                name=t.name,
                field=t.field,
                description=t.description,
                keywords=by_track.get(t.id, []),
            )
            for t in tracks
        ]
    )


@router.get("/profile", response_model=ProfileOut, summary="내 트랙 / 온보딩 여부")
async def get_profile(user: CurrentUser, session: DbSession) -> ProfileOut:
    db = _require_db(session)
    row = await db.execute(
        select(ResearchProfileRow, TrackRow.name)
        .join(TrackRow, TrackRow.id == ResearchProfileRow.track_id, isouter=True)
        .where(ResearchProfileRow.user_id == user.id)
    )
    found = row.first()
    count = await db.scalar(
        select(func.count()).select_from(UserKeywordRow).where(UserKeywordRow.user_id == user.id)
    )
    if not found:
        return ProfileOut(onboarded=False, keyword_count=count or 0)
    profile, track_name = found
    return ProfileOut(
        onboarded=True,
        track_id=profile.track_id,
        track_name=track_name,
        keyword_count=count or 0,
    )


@router.put("/profile", response_model=ProfileOut, summary="트랙 선택 → 프리셋 키워드 적용")
async def set_profile(body: ProfileUpdateIn, user: CurrentUser, session: DbSession) -> ProfileOut:
    db = _require_db(session)
    track = await db.get(TrackRow, body.track_id)
    if track is None:
        raise AppError("RESEARCH_TRACK_NOT_FOUND", "존재하지 않는 학과입니다.", status_code=404)

    now = await utcnow()
    stmt = pg_insert(ResearchProfileRow).values(
        user_id=user.id, track_id=track.id, onboarded_at=now, updated_at=now
    )
    await db.execute(
        stmt.on_conflict_do_update(
            index_elements=[ResearchProfileRow.user_id],
            set_={"track_id": stmt.excluded.track_id, "updated_at": stmt.excluded.updated_at},
        )
    )

    # 트랙을 바꾸면 이전 프리셋 키워드는 걷어낸다. 직접 추가한 것(manual)은 남긴다.
    await db.execute(
        delete(UserKeywordRow).where(
            UserKeywordRow.user_id == user.id, UserKeywordRow.source == KW_PRESET
        )
    )

    preset = await db.execute(
        select(TrackKeywordRow.keyword).where(TrackKeywordRow.track_id == track.id)
    )
    keywords = [k for (k,) in preset.all()]
    if keywords:
        kw_stmt = pg_insert(UserKeywordRow)
        await db.execute(
            kw_stmt.on_conflict_do_nothing(
                index_elements=[UserKeywordRow.user_id, UserKeywordRow.keyword]
            ),
            [
                {"user_id": user.id, "keyword": k, "source": KW_PRESET, "created_at": now}
                for k in keywords
            ],
        )
    await db.commit()

    count = await db.scalar(
        select(func.count()).select_from(UserKeywordRow).where(UserKeywordRow.user_id == user.id)
    )
    return ProfileOut(
        onboarded=True, track_id=track.id, track_name=track.name, keyword_count=count or 0
    )


@router.get("/keywords", response_model=KeywordListOut, summary="내 키워드")
async def list_keywords(user: CurrentUser, session: DbSession) -> KeywordListOut:
    db = _require_db(session)
    rows = await db.execute(
        select(UserKeywordRow)
        .where(UserKeywordRow.user_id == user.id)
        .order_by(UserKeywordRow.source, UserKeywordRow.keyword)
    )
    return KeywordListOut(
        keywords=[KeywordOut(keyword=r.keyword, source=r.source) for r in rows.scalars().all()]
    )


@router.post("/keywords", response_model=KeywordListOut, summary="키워드 추가")
async def add_keyword(
    body: KeywordCreateIn, user: CurrentUser, session: DbSession
) -> KeywordListOut:
    db = _require_db(session)
    keyword = _normalize(body.keyword)
    if len(keyword) < 2:
        raise AppError(
            "RESEARCH_KEYWORD_TOO_SHORT",
            "키워드는 2글자 이상이어야 합니다.",
            status_code=400,
        )
    now = await utcnow()
    stmt = pg_insert(UserKeywordRow).values(
        user_id=user.id, keyword=keyword, source=KW_MANUAL, created_at=now
    )
    await db.execute(
        stmt.on_conflict_do_nothing(
            index_elements=[UserKeywordRow.user_id, UserKeywordRow.keyword]
        )
    )
    await db.commit()
    return await list_keywords(user, db)


@router.delete("/keywords/{keyword}", response_model=OkOut, summary="키워드 삭제")
async def delete_keyword(
    user: CurrentUser,
    session: DbSession,
    keyword: Annotated[str, Path(min_length=1, max_length=80)],
) -> OkOut:
    db = _require_db(session)
    await db.execute(
        delete(UserKeywordRow).where(
            UserKeywordRow.user_id == user.id, UserKeywordRow.keyword == _normalize(keyword)
        )
    )
    await db.commit()
    return OkOut()
