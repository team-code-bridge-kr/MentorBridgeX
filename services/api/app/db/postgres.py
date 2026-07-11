from collections.abc import AsyncGenerator
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, String, Text, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.config import get_settings


class Base(DeclarativeBase):
    pass


class UserRow(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class DocumentSectionRow(Base):
    __tablename__ = "document_sections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    section_type: Mapped[str] = mapped_column(String(32))
    content: Mapped[str] = mapped_column(Text)
    period_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    subject_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    source: Mapped[str] = mapped_column(String(32), default="manual")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class JobRow(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    job_type: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32))
    progress: Mapped[int] = mapped_column(Integer, default=0)
    payload: Mapped[str] = mapped_column(Text, default="{}")
    result: Mapped[str | None] = mapped_column(Text, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class CommentRow(Base):
    """Text-only comments — no blobs (disk-safe)."""

    __tablename__ = "comments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    author: Mapped[str] = mapped_column(String(80))
    type: Mapped[str] = mapped_column(String(32), default="그래프")
    target: Mapped[str] = mapped_column(String(120), default="전체 그래프")
    content: Mapped[str] = mapped_column(Text)
    reports: Mapped[int] = mapped_column(Integer, default=0)
    replied: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class NotificationRow(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    icon: Mapped[str] = mapped_column(String(32), default="bell")
    title: Mapped[str] = mapped_column(String(120))
    body: Mapped[str] = mapped_column(Text)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class FormDocRow(Base):
    __tablename__ = "form_documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    template_id: Mapped[str] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text)
    used_nodes: Mapped[str] = mapped_column(Text, default="[]")  # JSON list
    status: Mapped[str] = mapped_column(String(32), default="완료")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class UserSettingsRow(Base):
    __tablename__ = "user_settings"

    user_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    prefs: Mapped[str] = mapped_column(Text, default="{}")  # JSON
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class VoiceSessionRow(Base):
    """Transcript-only sessions — audio never persisted to disk."""

    __tablename__ = "voice_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    title: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(32), default="녹음 중")
    duration_sec: Mapped[int] = mapped_column(Integer, default=0)
    transcript: Mapped[str] = mapped_column(Text, default="")
    keywords: Mapped[str] = mapped_column(Text, default="[]")
    participants: Mapped[str] = mapped_column(Text, default="[]")
    stt_mode: Mapped[str] = mapped_column(String(16), default="mock")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


engine = create_async_engine(get_settings().database_url, echo=get_settings().api_debug)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def init_postgres() -> None:
    async with engine.begin() as conn:
        await conn.exec_driver_sql("CREATE EXTENSION IF NOT EXISTS vector")
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


async def utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def get_user_by_email(session: AsyncSession, email: str) -> UserRow | None:
    result = await session.execute(select(UserRow).where(UserRow.email == email))
    return result.scalar_one_or_none()
