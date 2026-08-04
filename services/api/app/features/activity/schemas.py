"""최근 활동 API 스키마."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

# 활동 유형. 프론트의 activityMeta.js 와 값이 일치해야 한다.
TYPES = (
    "conversation",
    "article",
    "paper",
    "graph",
    "feedback",
    "document",
    "form",
    "voice",
    "mixed",
)


class RelatedRef(BaseModel):
    id: str | None = None
    title: str = ""


class ResultSummary(BaseModel):
    """작업 결과. 0 인 항목은 화면에서 빼므로 굳이 채우지 않는다."""

    message_count: int = 0
    added_node_count: int = 0
    resolved_comment_count: int = 0
    saved_article_count: int = 0
    modified_document_count: int = 0


class RestoreTarget(BaseModel):
    """활동을 다시 여는 방법.

    화면 이동 주소만으로는 부족하다 — 그때 쓰던 문맥까지 함께 붙여야
    "이어서 하기"가 된다. 그래서 conversation_id 와 contexts 를 같이 준다.
    """

    type: str
    route: str | None = None
    conversation_id: str | None = None
    contexts: list[dict] = Field(default_factory=list)


class ActivityOut(BaseModel):
    id: str  # = activity_key. 고정·이름변경·숨김이 이 값을 쓴다.
    conversation_id: str | None = None
    title: str
    generated_title: bool = False
    primary_type: str
    context_types: list[str] = Field(default_factory=list)
    context_summary: str = ""
    related_article: RelatedRef | None = None
    related_graph: RelatedRef | None = None
    related_feedback: RelatedRef | None = None
    result_summary: ResultSummary = Field(default_factory=ResultSummary)
    updated_at: datetime
    created_at: datetime
    restore_target: RestoreTarget
    pinned: bool = False
    # 검색용 원문 — 화면에는 안 보이지만 서버 검색이 이 위에서 돈다
    search_hint: str = ""


class ActivityListOut(BaseModel):
    items: list[ActivityOut]
    total: int = 0
    pinned_limit: int = 5


class ActivityPatchIn(BaseModel):
    title: str | None = Field(default=None, max_length=160)
    pinned: bool | None = None


class OkOut(BaseModel):
    ok: bool = True
