from collections.abc import AsyncGenerator
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Integer, LargeBinary, String, Text, select
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
    # 비밀번호로 가입한 계정만 값이 있다. 구글로 만든 계정은 비어 있고,
    # 그때는 구글로만 들어온다 (services/passwords.py 머리말 참고).
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)


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


class DocumentFileRow(Base):
    """업로드한 생기부 PDF 원본.

    학생 한 명당 **최신본 한 개**만 둔다(user_id 가 기본키). 이전 판을 쌓아 둘
    이유가 없고, 민감한 개인정보를 필요 이상으로 오래 갖고 있지 않기 위해서다.

    디스크가 아니라 DB 에 담는 이유: 삭제가 한 트랜잭션에서 끝난다. 파일로 두면
    행은 지웠는데 파일이 남는 경우를 따로 챙겨야 하고, 백업·복원도 갈라진다.
    생기부 PDF 는 보통 1MB 안팎이라 이 규모에서는 DB 에 두는 편이 안전하다.
    """

    __tablename__ = "document_files"

    user_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    filename: Mapped[str] = mapped_column(String(300))
    byte_size: Mapped[int] = mapped_column(Integer)
    page_count: Mapped[int] = mapped_column(Integer, default=0)
    # 같은 파일을 다시 올렸는지 확인용. 내용 자체를 식별자로 쓰지는 않는다.
    sha256: Mapped[str] = mapped_column(String(64))
    content: Mapped[bytes] = mapped_column(LargeBinary)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


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
        # pg_trgm — 탐구 피드의 한국어 키워드 부분일치(조사가 붙어도 매칭)에 필요.
        # 인덱스보다 먼저 만들어져야 하므로 create_all 앞에 둔다.
        await conn.exec_driver_sql("CREATE EXTENSION IF NOT EXISTS pg_trgm")
        await conn.run_sync(Base.metadata.create_all)
        # Alembic 이 없고 create_all 은 **기존 테이블을 바꾸지 않는다.** 이미
        # 만들어진 users 에 열을 더하려면 여기서 직접 붙여야 한다. Postgres 의
        # IF NOT EXISTS 라 여러 번 떠도 안전하다.
        await conn.exec_driver_sql(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)"
        )


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


async def utcnow() -> datetime:
    return datetime.now(UTC)


async def get_user_by_email(session: AsyncSession, email: str) -> UserRow | None:
    result = await session.execute(select(UserRow).where(UserRow.email == email))
    return result.scalar_one_or_none()
