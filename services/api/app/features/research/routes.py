"""탐구주제 피드 API.

- GET    /v1/research/tracks              학과 프리셋 목록
- GET    /v1/research/profile             내 트랙 / 온보딩 여부
- PUT    /v1/research/profile             트랙 선택 → 프리셋 키워드 적용
- GET    /v1/research/keywords            내 키워드
- POST   /v1/research/keywords            키워드 추가 (manual)
- DELETE /v1/research/keywords/{keyword}  키워드 삭제
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.factory import is_offline_demo
from app.db.postgres import UserRow, utcnow
from app.dependencies import get_current_user, get_db_session
from app.errors import AppError
from app.features.onboarding.models import UserMajorRow, UserProfileRow
from app.features.onboarding.service import login_state

from .feed import (
    DEFAULT_LIMIT,
    FEEDBACK_VALUES,
    MAX_LIMIT,
    MAX_QUERY_LEN,
    PERIODS,
    SORT_LATEST,
    SORT_TASTE,
    SORTS,
    TAB_ALL,
    TAB_SAVED,
    TABS,
    build_feed_query,
    decode_cursor,
    encode_cursor,
    liked_topics,
    load_keywords,
    matched_keywords,
)
from .ingest.runner import run_ingest
from .models import (
    KW_MANUAL,
    KW_PRESET,
    ArticleFeedbackRow,
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
    FeedbackIn,
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
from .seed_data import TRACKS, keyword_pairs
from .terms.service import recompute_terms

logger = logging.getLogger("research.api")

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
                TrackOut(
                    id=t[0],
                    name=t[1],
                    field=t[2],
                    description=t[3],
                    keywords=t[4],
                    keyword_groups=keyword_pairs(t[4]),
                )
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

    # 한국어·영어 짝은 **시드의 나열 순서**가 정한다. DB 에서 읽으면 정렬이
    # 바뀌어 짝을 알 수 없으므로, 묶음만 시드 상수에서 만든다.
    seed_keywords = {t[0]: t[4] for t in TRACKS}
    return TrackListOut(
        tracks=[
            TrackOut(
                id=t.id,
                name=t.name,
                field=t.field,
                description=t.description,
                keywords=by_track.get(t.id, []),
                keyword_groups=keyword_pairs(seed_keywords.get(t.id, [])),
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
        # 대표 학과가 없어도 온보딩을 끝냈을 수 있다 — "아직 모르겠어요"로
        # 계열만 고른 경우다. 그 사람을 다시 온보딩으로 돌려보내면 안 된다.
        return ProfileOut(
            onboarded=(await login_state(db, user.id)).onboarded,
            keyword_count=count or 0,
        )
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


def _parse_day(raw: str | None, *, end_of_day: bool = False) -> datetime | None:
    """YYYY-MM-DD → UTC datetime. 형식이 틀리면 조건을 걸지 않는다(무시)."""
    if not raw:
        return None
    try:
        day = datetime.strptime(raw.strip(), "%Y-%m-%d").replace(tzinfo=UTC)
    except ValueError:
        return None
    return day.replace(hour=23, minute=59, second=59) if end_of_day else day


@router.get("/feed", response_model=FeedOut, summary="개인화 피드")
async def get_feed(
    user: CurrentUser,
    session: DbSession,
    tab: Annotated[str, Query(description="all | news | paper | saved")] = TAB_ALL,
    cursor: Annotated[str | None, Query(description="이전 응답의 next_cursor")] = None,
    limit: Annotated[int, Query(ge=1, le=MAX_LIMIT)] = DEFAULT_LIMIT,
    q: Annotated[str, Query(description="검색어 (제목·요약 부분일치)", max_length=MAX_QUERY_LEN)] = "",
    days: Annotated[int, Query(description="최근 N일 (0=전체)", ge=0, le=365)] = 0,
    keywords_selected: Annotated[
        list[str] | None, Query(alias="keyword", description="화면에서 고른 키워드(여러 개면 OR)")
    ] = None,
    date_from: Annotated[str | None, Query(alias="from", description="시작일 YYYY-MM-DD")] = None,
    date_to: Annotated[str | None, Query(alias="to", description="종료일 YYYY-MM-DD")] = None,
    sort: Annotated[str, Query(description="latest | oldest | taste")] = SORT_LATEST,
) -> FeedOut:
    db = _require_db(session)
    if tab not in TABS:
        raise AppError("RESEARCH_BAD_TAB", f"알 수 없는 탭입니다: {tab}", status_code=400)

    query = q.strip()[:MAX_QUERY_LEN]
    keywords = await load_keywords(db, user.id)
    if not keywords and not query and tab != TAB_SAVED:
        # 온보딩 전 — 키워드도 검색어도 없으면 매칭할 것이 없다
        return FeedOut(items=[], next_cursor=None)

    wanted_sort = sort if sort in SORTS else SORT_LATEST
    # 취향순일 때만 좋아요를 들춘다. 다른 정렬에서는 쓸 일이 없다.
    preferred = await liked_topics(db, user.id, keywords) if wanted_sort == SORT_TASTE else []

    stmt = build_feed_query(
        user_id=user.id,
        keywords=keywords,
        tab=tab,
        cursor=decode_cursor(cursor) if cursor else None,
        limit=limit,
        query=query,
        days=days if days in PERIODS else 0,
        selected=[k for k in (keywords_selected or []) if k.strip()][:20],
        date_from=_parse_day(date_from),
        # 종료일은 그날 하루를 포함해야 한다 — 23:59:59 까지 본다
        date_to=_parse_day(date_to, end_of_day=True),
        sort=wanted_sort,
        preferred=preferred,
    )
    rows = (await db.execute(stmt)).all()

    # 화면에 지금 상태를 그대로 보여주려면 이 페이지의 글에 남긴 표시가 필요하다.
    marks: dict[str, str] = {}
    if rows:
        ids = [article.id for article, _ in rows]
        for aid, value in (
            await db.execute(
                select(ArticleFeedbackRow.article_id, ArticleFeedbackRow.value).where(
                    ArticleFeedbackRow.user_id == user.id,
                    ArticleFeedbackRow.article_id.in_(ids),
                )
            )
        ).all():
            marks[aid] = value

    items = [
        ArticleOut(
            id=article.id,
            url=article.url,
            title=article.title,
            summary=article.summary,
            author=article.author,
            outlet=article.outlet,
            image_url=article.image_url,
            kind=article.kind,
            lang=article.lang,
            published_at=article.published_at,
            matched_keywords=matched_keywords(article.search_text, keywords),
            read=read_row is not None,
            saved=bool(read_row and read_row.saved),
            feedback=marks.get(article.id, ""),
        )
        for article, read_row in rows
    ]

    next_cursor = None
    if len(items) == limit:
        last_article = rows[-1][0]
        # 취향순이면 커서에 "선호 묶음인지"까지 담아야 다음 페이지가 어긋나지 않는다
        last_pref = 1 if preferred and matched_keywords(last_article.search_text, preferred) else 0
        next_cursor = encode_cursor(last_article.published_at, last_article.id, last_pref)
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


@router.post("/feedback", response_model=OkOut, summary="취향 표시 (좋아요 / 관심 없음)")
async def set_feedback(body: FeedbackIn, user: CurrentUser, session: DbSession) -> OkOut:
    """이 글이 취향에 맞았는지 남긴다.

    `like` 는 정렬 '취향순'이 그 주제를 앞으로 올리는 근거가 되고,
    `hide` 는 목록에서 빼고 다시 보여주지 않는다. `none` 은 표시를 지운다.

    저장(user_reads.saved)과 따로 둔다 — 저장은 "다시 볼 것", 이건 "더/그만
    보고 싶다"라서 뜻이 다르다.
    """
    db = _require_db(session)
    value = (body.value or "").strip().lower()
    if value in {"", "none"}:
        await db.execute(
            delete(ArticleFeedbackRow).where(
                ArticleFeedbackRow.user_id == user.id,
                ArticleFeedbackRow.article_id == body.article_id,
            )
        )
        await db.commit()
        return OkOut()

    if value not in FEEDBACK_VALUES:
        raise AppError(
            "RESEARCH_BAD_FEEDBACK", f"알 수 없는 값입니다: {body.value}", status_code=400
        )

    now = await utcnow()
    stmt = pg_insert(ArticleFeedbackRow).values(
        user_id=user.id, article_id=body.article_id, value=value, created_at=now
    )
    await db.execute(
        stmt.on_conflict_do_update(
            index_elements=[ArticleFeedbackRow.user_id, ArticleFeedbackRow.article_id],
            set_={"value": stmt.excluded.value, "created_at": stmt.excluded.created_at},
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


@router.delete("/me", response_model=OkOut, summary="내 탐구 피드 데이터 전부 삭제")
async def delete_my_research_data(user: CurrentUser, session: DbSession) -> OkOut:
    """관심 키워드와 읽기 이력은 개인정보다. 요청하면 전부 지운다.

    지우는 것: research_profiles, user_keywords, user_reads, article_feedback,
    user_majors.
    articles 는 공용 수집 데이터라 개인과 무관하므로 남는다.

    관심 설정을 지웠으면 온보딩도 되돌린다. 키워드가 하나도 없는 채로 "온보딩
    완료" 상태를 남겨 두면 다음 로그인에 **빈 피드**로 떨어지고, 다시 고를 길이
    없다. 역할과 학년은 관심사와 무관하므로 남긴다.

    계정 삭제를 만들 때는 이 경로에 더해 user_profiles·classroom_members·
    mentor_profiles 까지 함께 지워야 한다.
    """
    db = _require_db(session)
    await db.execute(delete(UserReadRow).where(UserReadRow.user_id == user.id))
    # 취향 표시도 개인정보다 — 관심사를 지우면 함께 지운다
    await db.execute(delete(ArticleFeedbackRow).where(ArticleFeedbackRow.user_id == user.id))
    await db.execute(delete(UserKeywordRow).where(UserKeywordRow.user_id == user.id))
    await db.execute(delete(ResearchProfileRow).where(ResearchProfileRow.user_id == user.id))
    await db.execute(delete(UserMajorRow).where(UserMajorRow.user_id == user.id))
    profile = await db.get(UserProfileRow, user.id)
    if profile is not None:
        profile.track_group = None
        profile.completed_at = None
        profile.step = 1
        profile.updated_at = await utcnow()
    await db.commit()
    # 로그에 이메일·키워드 같은 식별 정보를 남기지 않는다
    logger.info("research data deleted user=%s", user.id)
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
