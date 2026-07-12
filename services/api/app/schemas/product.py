"""Product-domain schemas: comments, forms, notifications, settings, voice, stats."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class CommentOut(BaseModel):
    id: str
    author: str
    type: str
    target: str
    content: str
    reports: int = 0
    replied: bool = False
    created_at: datetime

    @property
    def createdAt(self) -> int:  # noqa: N802 — frontend camelCase
        return int(self.created_at.timestamp() * 1000)


class CommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    type: str = Field(default="그래프", max_length=32)
    target: str = Field(default="전체 그래프", max_length=120)
    author: str | None = Field(default=None, max_length=80)


class NotificationOut(BaseModel):
    id: str
    icon: str = "bell"
    title: str
    body: str
    read: bool = False
    created_at: datetime


class FormTemplateOut(BaseModel):
    id: str
    title: str
    category: str
    description: str
    uses: int = 0


class FormDocOut(BaseModel):
    id: str
    template_id: str
    title: str
    content: str
    used_nodes: list[str] = Field(default_factory=list)
    status: str = "완료"
    created_at: datetime
    updated_at: datetime


class FormGenerateRequest(BaseModel):
    template_id: str
    title: str | None = None


class FormPatchRequest(BaseModel):
    title: str | None = None
    content: str | None = None


class SettingsOut(BaseModel):
    display_name: str
    email: str
    role: str = "student"
    prefs: dict = Field(default_factory=dict)
    created_at: datetime | None = None


class SettingsPatch(BaseModel):
    display_name: str | None = Field(default=None, max_length=50)
    prefs: dict | None = None


class VoiceSessionOut(BaseModel):
    id: str
    title: str
    status: str
    duration_sec: int = 0
    transcript: str = ""
    keywords: list[str] = Field(default_factory=list)
    participants: list[str] = Field(default_factory=list)
    stt_mode: str = "mock"
    created_at: datetime
    updated_at: datetime


class VoiceSessionCreate(BaseModel):
    title: str = Field(default="새 녹음 세션", max_length=200)


class VoiceSessionPatch(BaseModel):
    title: str | None = None
    status: str | None = None
    transcript: str | None = None
    keywords: list[str] | None = None
    participants: list[str] | None = None
    duration_sec: int | None = None


class StatsOut(BaseModel):
    node_count: int = 0
    edge_count: int = 0
    comment_count: int = 0
    form_count: int = 0
    voice_count: int = 0
    voice_duration_sec: int = 0
    sections: list[dict] = Field(default_factory=list)
    top_nodes: list[dict] = Field(default_factory=list)
    recent_activities: list[dict] = Field(default_factory=list)
