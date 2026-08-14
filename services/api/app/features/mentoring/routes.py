"""멘토링 대화 — 학생과 멘토가 주고받는다.

**실시간 소켓을 두지 않는다.** 이 대화는 초 단위로 오가는 것이 아니라 하루에
몇 번 오가는 것이고, 소켓 하나를 얹으면 연결 유지·재접속·인증 갱신이 따라온다.
화면이 몇 초에 한 번 물어보는 것으로 충분하다 — 대신 목록 조회를 싸게 만든다.

**짝이 없으면 아무것도 안 보인다.** 학생은 자기 멘토와만, 멘토는 자기 학생과만
말한다. 링크에 낀 두 사람이 아니면 대화도 메시지도 열리지 않는다(`_link_of`).
"""

from __future__ import annotations

import secrets
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import case, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.factory import is_offline_demo
from app.db.postgres import UserRow, utcnow
from app.dependencies import get_current_user, get_db_session
from app.errors import AppError

from ..onboarding.models import ROLE_MENTOR, MentorProfileRow, UserProfileRow
from .models import (
    LINK_ACTIVE,
    MentorInviteRow,
    MentorLinkRow,
    MentorMessageRow,
)
from .schemas import (
    InviteOut,
    JoinIn,
    MessageListOut,
    MessageOut,
    PartnerOut,
    SendIn,
    ThreadListOut,
    ThreadOut,
)

router = APIRouter(prefix="/v1/students/me/mentoring", tags=["mentoring"])

CurrentUser = Annotated[object, Depends(get_current_user)]
DbSession = Annotated[AsyncSession | None, Depends(get_db_session)]

# 학급 참여 코드와 같은 글자판 — 사람이 불러 주고 받아 적는다.
# 헷갈리는 글자(I, O, 0, 1)는 애초에 빼 두었다.
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LEN = 6
# 한 번에 돌려주는 메시지 수. 더 오래된 것은 아직 안 부른다 — 이 대화가 그만큼
# 길어지면 그때 커서를 붙인다.
PAGE = 200


def _require_db(session: AsyncSession | None) -> AsyncSession:
    if session is None or is_offline_demo():
        raise AppError(
            "MENTORING_OFFLINE_DEMO",
            "데모 모드에서는 멘토링 대화를 쓸 수 없습니다.",
            status_code=400,
        )
    return session


async def _link_of(db: AsyncSession, link_id: str, user_id: str) -> MentorLinkRow:
    """이 사람이 낀 대화인가. 아니면 **있는지조차 알려 주지 않는다** — 남의
    대화 id 를 넣어 보고 404 와 403 을 견주면 그 대화의 존재를 알 수 있다."""
    link = await db.scalar(
        select(MentorLinkRow).where(
            MentorLinkRow.id == link_id,
            or_(MentorLinkRow.mentor_id == user_id, MentorLinkRow.student_id == user_id),
        )
    )
    if link is None:
        raise AppError("MENTORING_NOT_FOUND", "그런 대화가 없습니다.", status_code=404)
    return link


async def _partner(db: AsyncSession, user_id: str) -> PartnerOut:
    row = await db.scalar(select(UserRow).where(UserRow.id == user_id))
    prof = await db.scalar(
        select(UserProfileRow).where(UserProfileRow.user_id == user_id)
    )
    mentor = await db.scalar(
        select(MentorProfileRow).where(MentorProfileRow.user_id == user_id)
    )
    return PartnerOut(
        user_id=user_id,
        display_name=(row.display_name if row else "") or "이름 없음",
        role=(prof.role if prof else "") or "",
        affiliation=(mentor.affiliation if mentor else "") or "",
    )


@router.get("/threads", response_model=ThreadListOut, summary="내 멘토링 대화 목록")
async def list_threads(user: CurrentUser, session: DbSession) -> ThreadListOut:
    db = _require_db(session)
    links = (
        await db.execute(
            select(MentorLinkRow).where(
                MentorLinkRow.status == LINK_ACTIVE,
                or_(MentorLinkRow.mentor_id == user.id, MentorLinkRow.student_id == user.id),
            )
        )
    ).scalars().all()
    if not links:
        return ThreadListOut()

    ids = [ln.id for ln in links]
    # 대화마다 마지막 한 마디와 안 읽은 수. 한 번에 긁어 온다 — 대화 수만큼
    # 질의를 날리면 목록이 열 개만 되어도 눈에 띄게 느려진다.
    last_rows = {
        r.link_id: r
        for r in (
            await db.execute(
                select(MentorMessageRow)
                .where(MentorMessageRow.link_id.in_(ids))
                .order_by(MentorMessageRow.link_id, MentorMessageRow.created_at.desc())
                .distinct(MentorMessageRow.link_id)
            )
        ).scalars().all()
    }
    unread_rows = dict(
        (
            await db.execute(
                select(MentorMessageRow.link_id, func.count())
                .where(
                    MentorMessageRow.link_id.in_(ids),
                    MentorMessageRow.sender_id != user.id,
                    MentorMessageRow.read_at.is_(None),
                )
                .group_by(MentorMessageRow.link_id)
            )
        ).all()
    )

    threads: list[ThreadOut] = []
    for ln in links:
        other = ln.student_id if ln.mentor_id == user.id else ln.mentor_id
        last = last_rows.get(ln.id)
        threads.append(
            ThreadOut(
                link_id=ln.id,
                partner=await _partner(db, other),
                last_message=(last.body[:80] if last else ""),
                last_at=(last.created_at if last else None),
                unread=int(unread_rows.get(ln.id, 0)),
            )
        )
    # 최근에 말이 오간 대화가 위로. 아직 한 마디도 없는 짝은 뒤에 둔다.
    threads.sort(key=lambda t: (t.last_at is not None, t.last_at), reverse=True)
    return ThreadListOut(
        threads=threads, unread_total=sum(t.unread for t in threads)
    )


@router.get(
    "/threads/{link_id}/messages",
    response_model=MessageListOut,
    summary="대화 한 줄기",
)
async def list_messages(
    link_id: str, user: CurrentUser, session: DbSession
) -> MessageListOut:
    db = _require_db(session)
    link = await _link_of(db, link_id, user.id)
    rows = (
        await db.execute(
            select(MentorMessageRow)
            .where(MentorMessageRow.link_id == link_id)
            .order_by(MentorMessageRow.created_at.desc())
            .limit(PAGE)
        )
    ).scalars().all()

    # **여는 순간 읽음으로 친다.** 화면에 떴는데 안 읽음으로 남아 있으면
    # 배지가 영영 안 꺼진다.
    now = await utcnow()
    await db.execute(
        update(MentorMessageRow)
        .where(
            MentorMessageRow.link_id == link_id,
            MentorMessageRow.sender_id != user.id,
            MentorMessageRow.read_at.is_(None),
        )
        .values(read_at=now)
    )
    await db.commit()

    other = link.student_id if link.mentor_id == user.id else link.mentor_id
    return MessageListOut(
        partner=await _partner(db, other),
        messages=[
            MessageOut(
                id=m.id,
                sender_id=m.sender_id,
                body=m.body,
                mine=m.sender_id == user.id,
                read=m.read_at is not None,
                created_at=m.created_at,
            )
            # 최근 것부터 받아 왔으니 화면에 올릴 때 되돌린다
            for m in reversed(rows)
        ],
    )


@router.post(
    "/threads/{link_id}/messages",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
    summary="한 마디 보내기",
)
async def send_message(
    link_id: str, body: SendIn, user: CurrentUser, session: DbSession
) -> MessageOut:
    db = _require_db(session)
    await _link_of(db, link_id, user.id)
    now = await utcnow()
    msg = MentorMessageRow(
        id=str(uuid.uuid4()),
        link_id=link_id,
        sender_id=user.id,
        body=body.body.strip(),
        created_at=now,
    )
    db.add(msg)
    await db.commit()
    return MessageOut(
        id=msg.id,
        sender_id=msg.sender_id,
        body=msg.body,
        mine=True,
        read=False,
        created_at=msg.created_at,
    )


@router.post("/invite", response_model=InviteOut, summary="초대 코드 만들기 (멘토)")
async def create_invite(user: CurrentUser, session: DbSession) -> InviteOut:
    """멘토가 학생에게 건넬 코드.

    한 번 쓰면 닫힌다 — 1:1 짝이라 여러 학생이 같은 코드로 들어오면 안 된다.
    아직 아무도 안 쓴 코드가 있으면 그것을 다시 준다. 누를 때마다 새 코드를
    뱉으면 방금 불러 준 코드가 조용히 늘어난다.
    """
    db = _require_db(session)
    prof = await db.scalar(
        select(UserProfileRow).where(UserProfileRow.user_id == user.id)
    )
    if not prof or prof.role != ROLE_MENTOR:
        raise AppError(
            "MENTORING_FORBIDDEN", "멘토만 초대 코드를 만들 수 있습니다.", status_code=403
        )

    spare = await db.scalar(
        select(MentorInviteRow).where(
            MentorInviteRow.mentor_id == user.id, MentorInviteRow.used_by.is_(None)
        )
    )
    if spare:
        return InviteOut(code=spare.code)

    now = await utcnow()
    for _ in range(12):
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LEN))
        if await db.scalar(select(MentorInviteRow.code).where(MentorInviteRow.code == code)):
            continue
        db.add(MentorInviteRow(code=code, mentor_id=user.id, created_at=now))
        await db.commit()
        return InviteOut(code=code)
    raise AppError(
        "MENTORING_CODE_EXHAUSTED",
        "초대 코드를 만들지 못했습니다. 다시 시도해 주세요.",
        status_code=503,
    )


@router.post("/join", response_model=ThreadOut, summary="초대 코드로 멘토와 잇기")
async def join_with_code(
    body: JoinIn, user: CurrentUser, session: DbSession
) -> ThreadOut:
    db = _require_db(session)
    code = body.code.strip().upper()
    invite = await db.scalar(select(MentorInviteRow).where(MentorInviteRow.code == code))
    if invite is None:
        raise AppError("MENTORING_CODE_NOT_FOUND", "그런 초대 코드가 없습니다.", status_code=404)
    if invite.used_by:
        raise AppError(
            "MENTORING_CODE_USED", "이미 쓰인 초대 코드입니다.", status_code=409
        )
    if invite.mentor_id == user.id:
        raise AppError(
            "MENTORING_SELF_LINK", "자기 자신과는 이을 수 없습니다.", status_code=400
        )

    now = await utcnow()
    # 끊었다 다시 잇는 경우가 있다 — 새 줄을 만들지 말고 그 줄을 되살린다.
    # 그래야 주고받은 말이 그대로 남는다.
    link = await db.scalar(
        select(MentorLinkRow).where(
            MentorLinkRow.mentor_id == invite.mentor_id,
            MentorLinkRow.student_id == user.id,
        )
    )
    if link:
        link.status = LINK_ACTIVE
    else:
        link = MentorLinkRow(
            id=str(uuid.uuid4()),
            mentor_id=invite.mentor_id,
            student_id=user.id,
            status=LINK_ACTIVE,
            created_at=now,
        )
        db.add(link)
    invite.used_by = user.id
    await db.commit()

    return ThreadOut(link_id=link.id, partner=await _partner(db, invite.mentor_id))
