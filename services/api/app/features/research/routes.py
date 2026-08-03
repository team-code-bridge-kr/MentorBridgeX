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

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.factory import is_offline_demo
from app.db.postgres import UserRow, utcnow
from app.dependencies import get_current_user, get_db_session
from app.errors import AppError

from .feed import (
    DEFAULT_LIMIT,
    MAX_LIMIT,
    TAB_ALL,
    TAB_SAVED,
    TABS,
    build_feed_query,
    decode_cursor,
    encode_cursor,
    load_keywords,
    matched_keywords,
)
from .ingest.runner import run_ingest
from .models import (
    KW_MANUAL,
    KW_PRESET,
    ArticleTermRow,
    FetchLogRow,
    ResearchProfileRow,
    SourceRow,
    TrackKeywordRow,
    TrackRow,
    UserKeywordRow,
    UserReadRow,
)
from .schemas import (
    ArticleOut,
    DiscoverOut,
    FeedOut,
    FetchLogOut,
    IngestRunOut,
    KeywordCreateIn,
    KeywordListOut,
    KeywordOut,
    OkOut,
    ProfileOut,
    ProfileUpdateIn,
    ReadIn,
    SaveIn,
    TermOut,
    TrackListOut,
    TrackOut,
)
from .seed_data import TRACKS
from .terms.service import recompute_terms

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


@router.get("/feed", response_model=FeedOut, summary="개인화 피드")
async def get_feed(
    user: CurrentUser,
    session: DbSession,
    tab: Annotated[str, Query(description="all | news | paper | saved")] = TAB_ALL,
    cursor: Annotated[str | None, Query(description="이전 응답의 next_cursor")] = None,
    limit: Annotated[int, Query(ge=1, le=MAX_LIMIT)] = DEFAULT_LIMIT,
) -> FeedOut:
    db = _require_db(session)
    if tab not in TABS:
        raise AppError("RESEARCH_BAD_TAB", f"알 수 없는 탭입니다: {tab}", status_code=400)

    keywords = await load_keywords(db, user.id)
    if not keywords and tab != TAB_SAVED:
        # 온보딩 전 — 키워드가 없으면 매칭할 것도 없다
        return FeedOut(items=[], next_cursor=None)

    stmt = build_feed_query(
        user_id=user.id,
        keywords=keywords,
        tab=tab,
        cursor=decode_cursor(cursor) if cursor else None,
        limit=limit,
    )
    rows = (await db.execute(stmt)).all()

    items = [
        ArticleOut(
            id=article.id,
            url=article.url,
            title=article.title,
            summary=article.summary,
            author=article.author,
            outlet=article.outlet,
            kind=article.kind,
            lang=article.lang,
            published_at=article.published_at,
            matched_keywords=matched_keywords(article.search_text, keywords),
            read=read_row is not None,
            saved=bool(read_row and read_row.saved),
        )
        for article, read_row in rows
    ]

    next_cursor = None
    if len(items) == limit:
        last_article = rows[-1][0]
        next_cursor = encode_cursor(last_article.published_at, last_article.id)
    return FeedOut(items=items, next_cursor=next_cursor)


@router.get("/discover", response_model=DiscoverOut, summary="읽은 글에서 자주 나온 개념")
async def discover(
    user: CurrentUser,
    session: DbSession,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> DiscoverOut:
    """내가 읽은 글들에 자주 등장한 개념 상위 N개.

    이미 내 키워드로 등록된 것은 registered=True 로 표시해 "추가" 버튼을 감춘다.
    """
    db = _require_db(session)

    read_count = await db.scalar(
        select(func.count()).select_from(UserReadRow).where(UserReadRow.user_id == user.id)
    )
    if not read_count:
        return DiscoverOut(terms=[], read_count=0)

    read_articles = select(UserReadRow.article_id).where(UserReadRow.user_id == user.id)
    rows = await db.execute(
        select(
            ArticleTermRow.term,
            func.count(ArticleTermRow.article_id).label("article_count"),
            func.sum(ArticleTermRow.score).label("total_score"),
        )
        .where(ArticleTermRow.article_id.in_(read_articles))
        .group_by(ArticleTermRow.term)
        # 여러 글에 걸쳐 반복된 개념일수록 관심사에 가깝다 — 등장 글 수를 먼저 본다
        .order_by(
            func.count(ArticleTermRow.article_id).desc(),
            func.sum(ArticleTermRow.score).desc(),
        )
        .limit(limit)
    )

    registered = {k.lower() for k in await load_keywords(db, user.id)}
    return DiscoverOut(
        read_count=read_count,
        terms=[
            TermOut(
                term=term,
                article_count=article_count,
                score=round(float(total_score or 0.0), 4),
                registered=term.lower() in registered,
            )
            for term, article_count, total_score in rows.all()
        ],
    )


@router.post("/terms/recompute", response_model=OkOut, summary="개념 재계산 (배치)")
async def recompute_terms_now(user: CurrentUser, session: DbSession) -> OkOut:
    db = _require_db(session)
    await recompute_terms(db)
    return OkOut()


@router.post("/reads", response_model=OkOut, summary="읽음 표시")
async def mark_read(body: ReadIn, user: CurrentUser, session: DbSession) -> OkOut:
    db = _require_db(session)
    now = await utcnow()
    stmt = pg_insert(UserReadRow).values(
        user_id=user.id, article_id=body.article_id, read_at=now, saved=False
    )
    # 이미 읽은 글이면 읽은 시각만 갱신한다. saved 플래그는 건드리지 않는다.
    await db.execute(
        stmt.on_conflict_do_update(
            index_elements=[UserReadRow.user_id, UserReadRow.article_id],
            set_={"read_at": stmt.excluded.read_at},
        )
    )
    await db.commit()
    return OkOut()


@router.post("/saves", response_model=OkOut, summary="저장함 토글")
async def toggle_save(body: SaveIn, user: CurrentUser, session: DbSession) -> OkOut:
    db = _require_db(session)
    now = await utcnow()
    stmt = pg_insert(UserReadRow).values(
        user_id=user.id, article_id=body.article_id, read_at=now, saved=body.saved
    )
    await db.execute(
        stmt.on_conflict_do_update(
            index_elements=[UserReadRow.user_id, UserReadRow.article_id],
            set_={"saved": stmt.excluded.saved},
        )
    )
    await db.commit()
    return OkOut()


@router.post("/ingest/run", response_model=IngestRunOut, summary="수집 수동 실행")
async def run_ingest_now(
    user: CurrentUser,
    session: DbSession,
    source_id: Annotated[str | None, Query(description="특정 소스만 수집")] = None,
) -> IngestRunOut:
    """수집을 즉시 한 번 돌린다. 스케줄러와 같은 경로를 쓴다.

    로그인 사용자면 누구나 호출할 수 있지만, 소스 단위 3초 간격과
    24시간 백오프가 그대로 적용되므로 연타해도 외부 서버에 부하가 가지 않는다.
    """
    db = _require_db(session)
    logs = await run_ingest(db, source_ids=[source_id] if source_id else None)

    names = await db.execute(select(SourceRow.id, SourceRow.name))
    name_by_id = dict(names.all())
    return IngestRunOut(
        started=True,
        logs=[
            FetchLogOut(
                source_id=log.source_id,
                source_name=name_by_id.get(log.source_id, ""),
                started_at=log.started_at,
                finished_at=log.finished_at,
                status=log.status,
                items_found=log.items_found,
                items_new=log.items_new,
                error=log.error,
            )
            for log in logs
        ],
    )


@router.get("/ingest/logs", response_model=IngestRunOut, summary="최근 수집 로그")
async def recent_ingest_logs(user: CurrentUser, session: DbSession) -> IngestRunOut:
    db = _require_db(session)
    rows = await db.execute(
        select(FetchLogRow).order_by(FetchLogRow.started_at.desc()).limit(50)
    )
    names = await db.execute(select(SourceRow.id, SourceRow.name))
    name_by_id = dict(names.all())
    return IngestRunOut(
        started=False,
        logs=[
            FetchLogOut(
                source_id=log.source_id,
                source_name=name_by_id.get(log.source_id, ""),
                started_at=log.started_at,
                finished_at=log.finished_at,
                status=log.status,
                items_found=log.items_found,
                items_new=log.items_new,
                error=log.error,
            )
            for log in rows.scalars().all()
        ],
    )


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
