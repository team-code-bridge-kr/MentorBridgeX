"""어시스턴트 API 스키마."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ContextItemIn(BaseModel):
    """문맥 칩. 서버가 id 로 실제 내용을 다시 읽으므로 본문은 받지 않는다."""

    type: str = Field(description="article | graph | node | comment | file")
    id: str | None = None
    label: str | None = None


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = None
    context: list[ContextItemIn] = Field(default_factory=list, max_length=8)


class ContextItemOut(BaseModel):
    type: str
    id: str | None = None
    label: str = ""


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    context: list[ContextItemOut] = Field(default_factory=list)
    cards: list[dict] = Field(default_factory=list)
    created_at: datetime


class ConversationOut(BaseModel):
    id: str
    title: str
    subject: str = ""
    message_count: int = 0
    updated_at: datetime


class ConversationListOut(BaseModel):
    conversations: list[ConversationOut]


class ConversationDetailOut(BaseModel):
    id: str
    title: str
    subject: str = ""
    messages: list[MessageOut]


class OkOut(BaseModel):
    ok: bool = True


# ── 대시보드 요약 ──────────────────────────────────────────────


class WeeklyActivityOut(BaseModel):
    """"이번 주 노드 8개 추가 · 기사 5개 탐색" 형태로 쓰이는 원자료.

    전부 0 이면 프론트가 영역 자체를 숨긴다.
    """

    nodes_added: int = 0
    articles_read: int = 0
    feedback_resolved: int = 0
    voice_sessions: int = 0
    has_activity: bool = False


class GraphSummaryOut(BaseModel):
    node_count: int = 0
    edge_count: int = 0
    recent_nodes: list[str] = Field(default_factory=list)
    last_updated: datetime | None = None
    suggested_count: int = 0
    # 미리보기 도형은 내려보내지 않는다 — 대시보드 카드가 지식 그래프 화면과
    # 같은 /v1/students/me/graph 를 그려서, 두 화면의 모양이 어긋나지 않게 한다.


class PendingFeedbackItem(BaseModel):
    id: str
    author: str
    role: str = "멘토"
    target: str = ""
    excerpt: str = ""
    created_at: datetime
    read: bool = False
    resolved: bool = False


class DashboardOut(BaseModel):
    user_name: str = ""
    onboarded: bool = False
    track_name: str | None = None
    unread_notifications: int = 0
    weekly: WeeklyActivityOut
    graph: GraphSummaryOut
    pending_feedback: list[PendingFeedbackItem] = Field(default_factory=list)
    pending_feedback_count: int = 0
