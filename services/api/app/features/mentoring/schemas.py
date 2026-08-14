"""멘토링 대화 — 주고받는 모양."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

# 한 마디의 길이. 이보다 길어지면 대화가 아니라 문서다 — 그건 보고서로 쓴다.
MAX_BODY = 2000


class PartnerOut(BaseModel):
    """대화 상대. **이메일은 담지 않는다** — 화면에 쓸 일이 없고, 담는 순간
    한쪽이 다른 쪽의 계정을 알게 된다."""

    user_id: str
    display_name: str
    role: str = ""
    # 멘토라면 전공·소속. 학생이 "누구에게 묻고 있는지" 를 알아야 한다.
    affiliation: str = ""


class ThreadOut(BaseModel):
    link_id: str
    partner: PartnerOut
    last_message: str = ""
    last_at: datetime | None = None
    unread: int = 0


class ThreadListOut(BaseModel):
    threads: list[ThreadOut] = Field(default_factory=list)
    # 사이드바 배지가 쓰는 값. 대화 여럿을 합친 수다.
    unread_total: int = 0


class MessageOut(BaseModel):
    id: str
    sender_id: str
    body: str
    mine: bool
    read: bool
    created_at: datetime


class MessageListOut(BaseModel):
    messages: list[MessageOut] = Field(default_factory=list)
    partner: PartnerOut | None = None


class SendIn(BaseModel):
    body: str = Field(min_length=1, max_length=MAX_BODY)


class InviteOut(BaseModel):
    code: str


class JoinIn(BaseModel):
    code: str = Field(min_length=4, max_length=8)
