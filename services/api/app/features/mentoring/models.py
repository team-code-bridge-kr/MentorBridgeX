"""멘토링 대화 — 사람과 사람.

**`assistant_messages` 와 다른 것이다.** 그쪽은 `role: user | assistant` 로
사람과 AI 가 주고받는 자리고, 여기는 학생과 멘토가 주고받는 자리다. 한 테이블에
섞으면 "AI 가 한 말" 과 "사람이 한 말" 이 같은 줄에 앉는데, 이 앱에서 그 둘을
가르는 일이 얼마나 중요한지는 노드 판의 「Bridge AI 해석」이 말해 준다.

MBX 에는 Alembic 이 없고 스키마를 `Base.metadata.create_all` 로 만든다.
create_all 은 **새 테이블만 만들고 기존 테이블은 바꾸지 않으므로**, 여기 있는
것은 전부 새 테이블이어야 한다. 있는 테이블에 열을 더해야 하면
`init_postgres` 에서 ALTER 로 직접 붙인다(users.password_hash 가 그 예다).
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.postgres import Base

# 짝의 상태. 초대 코드를 받아 든 순간 바로 이어진다 — 멘토가 코드를 건넨 것
# 자체가 승낙이라, 그 위에 "수락" 을 한 겹 더 두면 두 사람 다 기다리게 된다.
LINK_ACTIVE = "active"
LINK_ENDED = "ended"


class MentorLinkRow(Base):
    """학생 ↔ 멘토 한 짝.

    학급(`classrooms`)과 나란한 개념이되 **1:1** 이다. 학급은 한 교사가 여럿을
    보는 자리고, 멘토링은 한 사람이 한 사람을 보는 자리다.
    """

    __tablename__ = "mentor_links"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    mentor_id: Mapped[str] = mapped_column(String(36), index=True)
    student_id: Mapped[str] = mapped_column(String(36), index=True)
    status: Mapped[str] = mapped_column(String(16), default=LINK_ACTIVE)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    # 같은 짝이 두 번 생기지 않게. 끊었다 다시 이으면 같은 줄을 되살린다.
    __table_args__ = (
        Index("ix_mentor_links_pair", "mentor_id", "student_id", unique=True),
    )


class MentorInviteRow(Base):
    """멘토가 만든 초대 코드. 학생이 이 코드로 짝이 된다.

    학급의 `join_code` 와 같은 방식이다 — 사람이 불러 주고 받아 적는 코드라
    유일성은 DB 에서 막는다. 다만 학급 코드와 달리 **한 번 쓰면 닫힌다**:
    1:1 짝이라 여러 학생이 같은 코드로 들어오면 안 된다.
    """

    __tablename__ = "mentor_invites"

    code: Mapped[str] = mapped_column(String(8), primary_key=True)
    mentor_id: Mapped[str] = mapped_column(String(36), index=True)
    used_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class MentorMessageRow(Base):
    """한 마디.

    읽음은 **받는 사람이 언제 읽었는지**가 아니라 메시지마다 표시한다. 대화가
    길어지면 "어디까지 읽었나" 를 따로 들고 있는 편이 싸지만, 그러면 안 읽은
    개수를 셀 때마다 두 값을 견줘야 하고 한쪽이 어긋나면 영영 안 맞는다.
    """

    __tablename__ = "mentor_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    link_id: Mapped[str] = mapped_column(String(36), index=True)
    sender_id: Mapped[str] = mapped_column(String(36), index=True)
    body: Mapped[str] = mapped_column(Text)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

    __table_args__ = (Index("ix_mentor_messages_thread", "link_id", "created_at"),)
