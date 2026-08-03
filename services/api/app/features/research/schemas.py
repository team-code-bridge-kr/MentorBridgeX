"""탐구주제 피드 — 요청/응답 스키마."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class TrackOut(BaseModel):
    id: str
    name: str
    field: str
    description: str = ""
    keywords: list[str] = Field(default_factory=list)


class TrackListOut(BaseModel):
    tracks: list[TrackOut]


class ProfileOut(BaseModel):
    onboarded: bool
    track_id: str | None = None
    track_name: str | None = None
    keyword_count: int = 0


class ProfileUpdateIn(BaseModel):
    track_id: str = Field(min_length=1, max_length=40)


class KeywordOut(BaseModel):
    keyword: str
    source: str  # preset | manual


class KeywordListOut(BaseModel):
    keywords: list[KeywordOut]


class KeywordCreateIn(BaseModel):
    keyword: str = Field(min_length=2, max_length=80)


class ArticleOut(BaseModel):
    id: str
    url: str
    title: str
    summary: str = ""
    author: str | None = None
    outlet: str = ""
    kind: str  # news | paper
    lang: str = "ko"
    published_at: datetime | None = None
    matched_keywords: list[str] = Field(default_factory=list)
    read: bool = False
    saved: bool = False


class FeedOut(BaseModel):
    items: list[ArticleOut]
    next_cursor: str | None = None


class TermOut(BaseModel):
    term: str
    article_count: int
    score: float
    registered: bool  # 이미 내 키워드로 등록돼 있는지


class DiscoverOut(BaseModel):
    terms: list[TermOut]
    read_count: int


class ReadIn(BaseModel):
    article_id: str


class SaveIn(BaseModel):
    article_id: str
    saved: bool = True


class FetchLogOut(BaseModel):
    source_id: str
    source_name: str = ""
    started_at: datetime
    finished_at: datetime | None = None
    status: str
    items_found: int = 0
    items_new: int = 0
    error: str | None = None


class IngestRunOut(BaseModel):
    started: bool
    logs: list[FetchLogOut] = Field(default_factory=list)


class OkOut(BaseModel):
    ok: bool = True
