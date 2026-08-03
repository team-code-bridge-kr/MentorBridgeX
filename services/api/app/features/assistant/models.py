"""MBX AI 어시스턴트 — 대화 저장 모델.

대시보드의 중심은 챗봇이지만, 일반 챗봇과 다른 점은 **문맥**이다.
사용자의 그래프·기사·코멘트를 대화에 끌어와 답한다. 어떤 문맥이 붙었는지를
메시지와 함께 저장해야 나중에 대화를 이어갈 때 같은 문맥을 복원할 수 있다.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.postgres import Base

# 문맥 칩 종류 — 프론트의 AIContextChip 과 값이 일치해야 한다
CTX_ARTICLE = "article"
CTX_GRAPH = "graph"
CTX_NODE = "node"
CTX_COMMENT = "comment"
CTX_FILE = "file"

ROLE_USER = "user"
ROLE_ASSISTANT = "assistant"


class ConversationRow(Base):
    __tablename__ = "assistant_conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    # 첫 사용자 메시지에서 잘라 만든다 — 최근 대화 목록에 그대로 노출된다
    title: Mapped[str] = mapped_column(String(120))
    # 이 대화가 다루는 프로젝트/그래프 (최근 대화 목록의 부제)
    subject: Mapped[str] = mapped_column(String(120), default="")
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class MessageRow(Base):
    __tablename__ = "assistant_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    conversation_id: Mapped[str] = mapped_column(String(36), index=True)
    role: Mapped[str] = mapped_column(String(16))  # user | assistant
    content: Mapped[str] = mapped_column(Text, default="")
    # 이 턴에 붙은 문맥 칩 (JSON list) — 대화를 이어갈 때 복원한다
    context: Mapped[str] = mapped_column(Text, default="[]")
    # 어시스턴트가 만든 결과 카드 (JSON list) — 텍스트만 길게 뱉지 않게 하는 장치
    cards: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
