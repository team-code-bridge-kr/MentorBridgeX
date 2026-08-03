"""온보딩 API.

- GET   /v1/onboarding            현재 상태 (이탈 복구용)
- PATCH /v1/onboarding            바뀐 항목만 저장
- POST  /v1/onboarding/keywords   세부 관심 키워드 저장
- GET   /v1/onboarding/preview    "이런 글을 받게 됩니다" 3건
- POST  /v1/onboarding/complete   완료
- GET   /v1/classrooms            내 학급
- POST  /v1/classrooms            학급 개설 (교사)
- POST  /v1/classrooms/join       참여 코드로 참여

**키워드를 언제 넣는가.** 학과를 고르면(STEP 3) 그 학과의 *핵심* 키워드만 넣고,
나머지는 STEP 4 에서 고르게 한다. 학과 프리셋을 통째로 넣어 버리면 STEP 4 가
할 일이 없어지고, 반대로 STEP 4 에서 고른 것만 남기면 **건너뛴 사람이 더 많은
키워드를 갖는** 이상한 상태가 된다.

**가중치는 넣지 않았다.** 설계안은 "아직 모르겠어요"에 0.5 가중치를 말하지만,
지금 매칭(pg_trgm 부분일치)에는 점수 개념이 자체가 없어서 weight 컬럼을 만들어도
아무 데도 쓰이지 않는다. 대신 계열 전체의 **핵심 키워드만** 넣어 넓되 얕게 잡는다.
"""

from __future__ import annotations

import secrets
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.factory import is_offline_demo
from app.db.postgres import UserRow, utcnow
from app.dependencies import get_current_user, get_db_session
from app.errors import AppError

from ..research.feed import TAB_ALL, build_feed_query, load_keywords
from ..research.models import (
    KW_MANUAL,
    KW_PRESET,
    ArticleRow,
    ResearchProfileRow,
    TrackKeywordRow,
    TrackRow,
    UserKeywordRow,
)
from ..research.seed_data import CORE_WEIGHT, display_keywords
from .models import (
    GRADES,
    MAX_MAJORS,
    ROLE_STUDENT,
    ROLE_TEACHER,
    ROLES,
    ClassroomMemberRow,
    ClassroomRow,
    MentorProfileRow,
    UserMajorRow,
    UserProfileRow,
)
from .schemas import (
    ClassroomCreateIn,
    ClassroomJoinIn,
    ClassroomListOut,
    ClassroomOut,
    KeywordSelectIn,
    PreviewItem,
    PreviewOut,
    StateOut,
    StatePatchIn,
)

router = APIRouter(prefix="/v1/onboarding", tags=["onboarding"])
classroom_router = APIRouter(prefix="/v1/classrooms", tags=["onboarding"])

CurrentUser = Annotated[UserRow, Depends(get_current_user)]
DbSession = Annotated[AsyncSession | None, Depends(get_db_session)]

PREVIEW_LIMIT = 3

# 참여 코드에서 헷갈리는 글자를 뺀다. 사람이 칠판에 적고 학생이 받아 적는 값이라
# 0/O, 1/I/l 이 섞이면 "코드가 안 먹혀요"가 그대로 문의가 된다.
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LEN = 6


def _require_db(session: AsyncSession | None) -> AsyncSession:
    if session is None or is_offline_demo():
        raise AppError(
            "ONBOARDING_OFFLINE_UNSUPPORTED",
            "온보딩은 오프라인 데모 모드에서 지원하지 않습니다.",
            status_code=503,
        )
    return session


async def _get_or_create_profile(db: AsyncSession, user_id: str) -> UserProfileRow:
    row = await db.get(UserProfileRow, user_id)
    if row is not None:
        return row
    now = await utcnow()
    row = UserProfileRow(
        user_id=user_id, role=ROLE_STUDENT, step=0, created_at=now, updated_at=now
    )
    db.add(row)
    await db.flush()
    return row


async def _majors(db: AsyncSession, user_id: str) -> list[str]:
    rows = await db.execute(
        select(UserMajorRow.track_id)
        .where(UserMajorRow.user_id == user_id)
        .order_by(UserMajorRow.created_at, UserMajorRow.track_id)
    )
    return [t for (t,) in rows.all()]


async def _core_keywords(db: AsyncSession, track_ids: list[str]) -> list[str]:
    """트랙들의 핵심 키워드(시드에서 가중치를 높여 둔 앞쪽 개념)."""
    if not track_ids:
        return []
    rows = await db.execute(
        select(TrackKeywordRow.keyword)
        .where(
            TrackKeywordRow.track_id.in_(track_ids),
            TrackKeywordRow.weight >= CORE_WEIGHT,
        )
        .order_by(TrackKeywordRow.keyword)
    )
    return sorted({k for (k,) in rows.all()})


async def _replace_preset_keywords(db: AsyncSession, user_id: str, keywords: list[str]) -> None:
    """프리셋 키워드를 통째로 갈아끼운다. 직접 추가한 것(manual)은 건드리지 않는다."""
    await db.execute(
        delete(UserKeywordRow).where(
            UserKeywordRow.user_id == user_id, UserKeywordRow.source == KW_PRESET
        )
    )
    if not keywords:
        return
    now = await utcnow()
    stmt = pg_insert(UserKeywordRow)
    await db.execute(
        stmt.on_conflict_do_nothing(
            index_elements=[UserKeywordRow.user_id, UserKeywordRow.keyword]
        ),
        [
            {"user_id": user_id, "keyword": k, "source": KW_PRESET, "created_at": now}
            for k in keywords
        ],
    )


async def _tracks_of_group(db: AsyncSession, track_group: str) -> list[str]:
    """계열에 속한 트랙들. 계열은 "공학,자연" 처럼 둘일 수 있다."""
    fields = [f.strip() for f in track_group.split(",") if f.strip()]
    if not fields:
        return []
    rows = await db.execute(select(TrackRow.id).where(TrackRow.field.in_(fields)))
    return [t for (t,) in rows.all()]


async def _classrooms_of(db: AsyncSession, user_id: str, role: str) -> list[ClassroomOut]:
    if role == ROLE_TEACHER:
        rows = await db.execute(
            select(ClassroomRow)
            .where(ClassroomRow.teacher_id == user_id)
            .order_by(ClassroomRow.created_at)
        )
        owned = list(rows.scalars().all())
        ids = [c.id for c in owned]
    else:
        rows = await db.execute(
            select(ClassroomRow)
            .join(ClassroomMemberRow, ClassroomMemberRow.classroom_id == ClassroomRow.id)
            .where(ClassroomMemberRow.user_id == user_id)
            .order_by(ClassroomMemberRow.joined_at)
        )
        owned = list(rows.scalars().all())
        ids = [c.id for c in owned]

    counts: dict[str, int] = {}
    if ids:
        crows = await db.execute(
            select(ClassroomMemberRow.classroom_id, func.count())
            .where(ClassroomMemberRow.classroom_id.in_(ids))
            .group_by(ClassroomMemberRow.classroom_id)
        )
        counts = dict(crows.all())

    return [
        ClassroomOut(
            id=c.id,
            name=c.name,
            school=c.school,
            join_code=c.join_code,
            member_count=counts.get(c.id, 0),
            owned=c.teacher_id == user_id,
        )
        for c in owned
    ]


async def _state(db: AsyncSession, user_id: str) -> StateOut:
    profile = await _get_or_create_profile(db, user_id)
    majors = await _majors(db, user_id)
    count = await db.scalar(
        select(func.count()).select_from(UserKeywordRow).where(UserKeywordRow.user_id == user_id)
    )
    mentor = await db.get(MentorProfileRow, user_id)
    return StateOut(
        role=profile.role,
        grade=profile.grade,
        track_group=profile.track_group,
        majors=majors,
        unsure=bool(profile.track_group) and not majors,
        step=profile.step or 0,
        completed=profile.completed_at is not None,
        keyword_count=count or 0,
        school=profile.school,
        subject=profile.subject,
        teacher_grades=profile.teacher_grades,
        mentor_track_id=mentor.track_id if mentor else None,
        mentor_affiliation=mentor.affiliation if mentor else None,
        mentor_status=mentor.status if mentor else None,
        classrooms=await _classrooms_of(db, user_id, profile.role),
    )


@router.get("", response_model=StateOut, summary="온보딩 상태")
async def get_state(user: CurrentUser, session: DbSession) -> StateOut:
    db = _require_db(session)
    state = await _state(db, user.id)
    await db.commit()
    return state


@router.patch("", response_model=StateOut, summary="온보딩 상태 부분 저장")
async def patch_state(body: StatePatchIn, user: CurrentUser, session: DbSession) -> StateOut:
    db = _require_db(session)
    profile = await _get_or_create_profile(db, user.id)
    now = await utcnow()

    if body.role is not None:
        if body.role not in ROLES:
            raise AppError("ONBOARDING_BAD_ROLE", "알 수 없는 역할입니다.", status_code=400)
        # 역할이 바뀌면 이전 역할에서 고른 것들이 남아 있으면 안 된다.
        # 학과만 지우고 키워드를 두면, 고른 적 없는 분야의 글이 계속 온다.
        if body.role != profile.role:
            await db.execute(delete(UserMajorRow).where(UserMajorRow.user_id == user.id))
            await db.execute(
                delete(ResearchProfileRow).where(ResearchProfileRow.user_id == user.id)
            )
            await _replace_preset_keywords(db, user.id, [])
            profile.grade = None
            profile.track_group = None
        profile.role = body.role

    if body.grade is not None:
        if body.grade not in GRADES:
            raise AppError("ONBOARDING_BAD_GRADE", "알 수 없는 학년입니다.", status_code=400)
        profile.grade = body.grade

    keywords_dirty = False

    if body.track_group is not None:
        if profile.track_group != body.track_group:
            # 계열을 바꾸면 이전 계열의 학과는 의미가 없다
            await db.execute(delete(UserMajorRow).where(UserMajorRow.user_id == user.id))
        profile.track_group = body.track_group
        keywords_dirty = True

    if body.majors is not None:
        if len(body.majors) > MAX_MAJORS:
            raise AppError(
                "ONBOARDING_TOO_MANY_MAJORS",
                f"학과는 {MAX_MAJORS}개까지 고를 수 있습니다.",
                status_code=400,
            )
        valid = await db.execute(select(TrackRow.id).where(TrackRow.id.in_(body.majors or [])))
        valid_ids = {t for (t,) in valid.all()}
        unknown = [m for m in body.majors if m not in valid_ids]
        if unknown:
            raise AppError(
                "ONBOARDING_TRACK_NOT_FOUND",
                f"존재하지 않는 학과입니다: {', '.join(unknown)}",
                status_code=404,
            )
        await db.execute(delete(UserMajorRow).where(UserMajorRow.user_id == user.id))
        for track_id in body.majors:
            db.add(UserMajorRow(user_id=user.id, track_id=track_id, created_at=now))
        keywords_dirty = True

    if keywords_dirty:
        majors = body.majors if body.majors is not None else await _majors(db, user.id)
        if majors:
            await _replace_preset_keywords(db, user.id, await _core_keywords(db, majors))
            if profile.role == ROLE_STUDENT:
                # 기존 화면들이 쓰는 '대표 학과'. research_profiles 는 1:1 이라
                # 첫 번째로 고른 학과를 대표로 둔다. 멘토에게는 두지 않는다 —
                # 그 표는 "이 학생의 진학 희망 학과"를 뜻한다.
                stmt = pg_insert(ResearchProfileRow).values(
                    user_id=user.id, track_id=majors[0], onboarded_at=now, updated_at=now
                )
                await db.execute(
                    stmt.on_conflict_do_update(
                        index_elements=[ResearchProfileRow.user_id],
                        set_={"track_id": stmt.excluded.track_id, "updated_at": now},
                    )
                )
        elif profile.track_group:
            # "아직 모르겠어요" — 계열 전체를 얕게. 대표 학과는 두지 않는다
            # (고르지 않은 학과를 골랐다고 기록할 수는 없다).
            group_tracks = await _tracks_of_group(db, profile.track_group)
            await _replace_preset_keywords(db, user.id, await _core_keywords(db, group_tracks))
            await db.execute(
                delete(ResearchProfileRow).where(ResearchProfileRow.user_id == user.id)
            )

    if body.school is not None:
        profile.school = body.school.strip() or None
    if body.subject is not None:
        profile.subject = body.subject.strip() or None
    if body.teacher_grades is not None:
        profile.teacher_grades = body.teacher_grades.strip() or None

    if any(
        v is not None
        for v in (body.mentor_track_id, body.mentor_affiliation, body.mentor_status)
    ):
        mentor = await db.get(MentorProfileRow, user.id)
        if mentor is None:
            mentor = MentorProfileRow(user_id=user.id, created_at=now, updated_at=now)
            db.add(mentor)
        if body.mentor_track_id is not None:
            mentor.track_id = body.mentor_track_id
        if body.mentor_affiliation is not None:
            mentor.affiliation = body.mentor_affiliation.strip()
        if body.mentor_status is not None:
            mentor.status = body.mentor_status
        mentor.updated_at = now

    if body.step is not None:
        # 뒤로 갔다고 진행 기록을 깎지 않는다 — 복구는 가장 멀리 간 지점으로.
        profile.step = max(profile.step or 0, body.step)

    profile.updated_at = now
    await db.flush()
    state = await _state(db, user.id)
    await db.commit()
    return state


@router.post("/keywords", response_model=StateOut, summary="세부 관심 키워드 저장")
async def set_keywords(body: KeywordSelectIn, user: CurrentUser, session: DbSession) -> StateOut:
    db = _require_db(session)
    await _get_or_create_profile(db, user.id)
    now = await utcnow()

    majors = await _majors(db, user.id)
    core = set(await _core_keywords(db, majors))
    # 고른 것 + 학과 핵심 키워드. 핵심을 빼지 않는 이유: STEP 4 는 **더 고르는**
    # 단계지 지우는 단계가 아니다. 건너뛴 사람보다 적게 갖게 되면 안 된다.
    allowed = await db.execute(
        select(TrackKeywordRow.keyword).where(TrackKeywordRow.track_id.in_(majors or [""]))
    )
    allowed_set = {k for (k,) in allowed.all()}
    # 화면에 없던 낱말이 preset 으로 들어오면 무시한다 (요청을 그대로 믿지 않는다)
    preset = {k for k in body.preset if k in allowed_set} | core
    await _replace_preset_keywords(db, user.id, sorted(preset))

    manual = [" ".join(k.split()).strip() for k in body.manual]
    manual = [k for k in manual if 2 <= len(k) <= 80]
    if manual:
        stmt = pg_insert(UserKeywordRow)
        await db.execute(
            stmt.on_conflict_do_nothing(
                index_elements=[UserKeywordRow.user_id, UserKeywordRow.keyword]
            ),
            [
                {"user_id": user.id, "keyword": k, "source": KW_MANUAL, "created_at": now}
                for k in manual
            ],
        )

    state = await _state(db, user.id)
    await db.commit()
    return state


@router.get("/preview", response_model=PreviewOut, summary="받게 될 글 미리보기")
async def preview(user: CurrentUser, session: DbSession) -> PreviewOut:
    """완료 직전에 실제로 받게 될 글을 보여준다.

    **빈 화면으로 온보딩을 끝내지 않는다.** 키워드로 걸리는 글이 없으면 최신글로
    대신 채우고, 그 사실을 `matched=False` 로 알려 화면 문구를 바꾸게 한다.
    """
    db = _require_db(session)
    keywords = await load_keywords(db, user.id)

    items: list[PreviewItem] = []
    matched = False

    if keywords:
        stmt = build_feed_query(
            user_id=user.id,
            keywords=keywords,
            tab=TAB_ALL,
            cursor=None,
            limit=PREVIEW_LIMIT,
        )
        rows = await db.execute(stmt)
        items = [_to_item(a) for a, _read in rows.all()]
        matched = bool(items)

    if not items:
        rows = await db.execute(
            select(ArticleRow)
            .order_by(ArticleRow.published_at.desc(), ArticleRow.id.desc())
            .limit(PREVIEW_LIMIT)
        )
        items = [_to_item(a) for a in rows.scalars().all()]

    return PreviewOut(items=items, matched=matched, keywords=display_keywords(keywords)[:12])


def _to_item(a: ArticleRow) -> PreviewItem:
    return PreviewItem(
        id=a.id,
        title=a.title,
        summary=a.summary,
        outlet=a.outlet,
        url=a.url,
        image_url=a.image_url,
        kind=a.kind,
        published_at=a.published_at,
    )


@router.post("/complete", response_model=StateOut, summary="온보딩 완료")
async def complete(user: CurrentUser, session: DbSession) -> StateOut:
    db = _require_db(session)
    profile = await _get_or_create_profile(db, user.id)
    if profile.role == ROLE_STUDENT and not profile.grade:
        raise AppError(
            "ONBOARDING_INCOMPLETE", "학년을 먼저 선택해 주세요.", status_code=400
        )
    now = await utcnow()
    profile.completed_at = profile.completed_at or now
    profile.step = None
    profile.updated_at = now
    await db.flush()
    state = await _state(db, user.id)
    await db.commit()
    return state


# ──────────────────────────────────────────────────────────────
# 학급
# ──────────────────────────────────────────────────────────────


async def _new_join_code(db: AsyncSession) -> str:
    for _ in range(12):
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LEN))
        exists = await db.scalar(select(ClassroomRow.id).where(ClassroomRow.join_code == code))
        if not exists:
            return code
    raise AppError(
        "CLASSROOM_CODE_EXHAUSTED",
        "참여 코드를 만들지 못했습니다. 다시 시도해 주세요.",
        status_code=503,
    )


@classroom_router.get("", response_model=ClassroomListOut, summary="내 학급")
async def list_classrooms(user: CurrentUser, session: DbSession) -> ClassroomListOut:
    db = _require_db(session)
    profile = await _get_or_create_profile(db, user.id)
    out = await _classrooms_of(db, user.id, profile.role)
    await db.commit()
    return ClassroomListOut(classrooms=out)


@classroom_router.post("", response_model=ClassroomOut, summary="학급 개설 (교사)")
async def create_classroom(
    body: ClassroomCreateIn, user: CurrentUser, session: DbSession
) -> ClassroomOut:
    db = _require_db(session)
    profile = await _get_or_create_profile(db, user.id)
    if profile.role != ROLE_TEACHER:
        raise AppError("CLASSROOM_FORBIDDEN", "교사만 학급을 만들 수 있습니다.", status_code=403)

    now = await utcnow()
    room = ClassroomRow(
        id=str(uuid.uuid4()),
        teacher_id=user.id,
        school=body.school.strip() or (profile.school or ""),
        name=body.name.strip(),
        join_code=await _new_join_code(db),
        created_at=now,
    )
    db.add(room)
    await db.commit()
    return ClassroomOut(
        id=room.id,
        name=room.name,
        school=room.school,
        join_code=room.join_code,
        member_count=0,
        owned=True,
    )


@classroom_router.post("/join", response_model=ClassroomOut, summary="참여 코드로 학급 참여")
async def join_classroom(
    body: ClassroomJoinIn, user: CurrentUser, session: DbSession
) -> ClassroomOut:
    db = _require_db(session)
    code = body.join_code.strip().upper()
    room = await db.scalar(select(ClassroomRow).where(ClassroomRow.join_code == code))
    if room is None:
        raise AppError("CLASSROOM_NOT_FOUND", "그런 참여 코드가 없습니다.", status_code=404)
    if room.teacher_id == user.id:
        raise AppError(
            "CLASSROOM_SELF_JOIN",
            "직접 만든 학급에는 학생으로 참여할 수 없습니다.",
            status_code=400,
        )

    now = await utcnow()
    stmt = pg_insert(ClassroomMemberRow).values(
        classroom_id=room.id, user_id=user.id, joined_at=now
    )
    await db.execute(
        stmt.on_conflict_do_nothing(
            index_elements=[ClassroomMemberRow.classroom_id, ClassroomMemberRow.user_id]
        )
    )
    await db.commit()

    count = await db.scalar(
        select(func.count())
        .select_from(ClassroomMemberRow)
        .where(ClassroomMemberRow.classroom_id == room.id)
    )
    return ClassroomOut(
        id=room.id,
        name=room.name,
        school=room.school,
        join_code=room.join_code,
        member_count=count or 0,
        owned=False,
    )


__all__ = ["classroom_router", "router"]
