"""탐구주제 피드 — SQLAlchemy 모델.

MBX 에는 Alembic 이 없고 스키마를 `Base.metadata.create_all` 로 만든다.
create_all 은 **새 테이블만 만들고 기존 테이블은 변경하지 않으므로**,
기존 `users` 에 컬럼을 붙이는 대신 `research_profiles` 로 분리했다.

한국어 키워드 매칭은 pg_trgm 을 쓴다. 형태소 분석기 없이 조사가 붙은
"반도체가/반도체를" 을 "반도체" 로 잡으려면 부분일치가 필요한데,
to_tsvector('simple') 은 공백 단위라 이걸 못 한다.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.postgres import Base

# 수집 소스 타입
SOURCE_RSS = "rss"
SOURCE_ARXIV = "arxiv"
SOURCE_CROSSREF = "crossref"
SOURCE_NEWSAPI = "newsapi"

# 기사 종류 — 피드 필터 탭(뉴스/논문)에서 조인 없이 거르기 위해 비정규화해 둔다
KIND_NEWS = "news"
KIND_PAPER = "paper"

# user_keywords.source
KW_PRESET = "preset"
KW_MANUAL = "manual"


class TrackRow(Base):
    """학과/계열 프리셋."""

    __tablename__ = "tracks"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(60))
    field: Mapped[str] = mapped_column(String(40))  # 계열 묶음 (공학/자연/의약/사회/인문)
    description: Mapped[str] = mapped_column(String(200), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class TrackKeywordRow(Base):
    """트랙별 프리셋 키워드. 한국어 뉴스와 영어 논문을 동시에 잡으려고 두 언어를 함께 넣는다."""

    __tablename__ = "track_keywords"

    track_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    keyword: Mapped[str] = mapped_column(String(80), primary_key=True)
    weight: Mapped[float] = mapped_column(Float, default=1.0)


class ResearchProfileRow(Base):
    """사용자의 진학 희망 트랙. users 테이블을 건드리지 않기 위한 별도 테이블."""

    __tablename__ = "research_profiles"

    user_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    track_id: Mapped[str] = mapped_column(String(40))
    onboarded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class UserKeywordRow(Base):
    """개인화된 키워드. 개인정보로 취급 — 계정 삭제 시 함께 지운다."""

    __tablename__ = "user_keywords"

    user_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    keyword: Mapped[str] = mapped_column(String(80), primary_key=True)
    source: Mapped[str] = mapped_column(String(16), default=KW_MANUAL)  # preset | manual
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class SourceRow(Base):
    """수집 소스.

    etag/last_modified — 조건부 요청으로 중복 다운로드를 막는다.
    failure_count/disabled_until — 429·503 이 3회 누적되면 24시간 쉰다.
    """

    __tablename__ = "sources"

    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    type: Mapped[str] = mapped_column(String(16))  # rss | arxiv | crossref
    url: Mapped[str] = mapped_column(String(500))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    # arXiv 카테고리(cs.LG) 나 Crossref 질의어 등 타입별 부가 파라미터
    query: Mapped[str | None] = mapped_column(String(300), nullable=True)
    outlet: Mapped[str] = mapped_column(String(120), default="")  # 표시용 매체명

    etag: Mapped[str | None] = mapped_column(String(300), nullable=True)
    last_modified: Mapped[str | None] = mapped_column(String(120), nullable=True)
    last_fetched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failure_count: Mapped[int] = mapped_column(Integer, default=0)
    disabled_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ArticleRow(Base):
    """수집된 글.

    저작권: 본문을 저장하지 않는다. summary 는 수집 단계에서 3문장으로 잘라 넣는다.
    본문 컬럼 자체를 두지 않아 실수로라도 전문이 들어갈 수 없게 했다.
    """

    __tablename__ = "articles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    source_id: Mapped[str] = mapped_column(String(60), index=True)
    url: Mapped[str] = mapped_column(String(700), unique=True)
    title: Mapped[str] = mapped_column(String(500))
    summary: Mapped[str] = mapped_column(Text, default="")
    author: Mapped[str | None] = mapped_column(String(300), nullable=True)
    outlet: Mapped[str] = mapped_column(String(160), default="")  # 매체명 / 저널명
    # 대표 이미지 **주소만** 갖는다. 이미지를 내려받아 보관하지 않는다 —
    # 그건 재배포라 요약·링크만 남기는 이 서비스의 원칙과 어긋난다.
    # 화면에서는 <img> 로 원 매체 서버에서 직접 불러온다(링크 미리보기와 같은 방식).
    image_url: Mapped[str | None] = mapped_column(String(700), nullable=True)
    kind: Mapped[str] = mapped_column(String(16), default=KIND_NEWS, index=True)
    lang: Mapped[str] = mapped_column(String(8), default="ko")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    # 전재 기사 중복 제거용 — URL 이 달라도 같은 제목이면 같은 글로 본다
    title_hash: Mapped[str] = mapped_column(String(40), index=True)
    # lower(title + summary). 매 쿼리마다 lower() 를 다시 돌리지 않으려고 비정규화해 둔다.
    search_text: Mapped[str] = mapped_column(Text, default="")

    __table_args__ = (
        Index(
            "ix_articles_search_trgm",
            "search_text",
            postgresql_using="gin",
            postgresql_ops={"search_text": "gin_trgm_ops"},
        ),
        # 피드는 (published_at DESC, id DESC) keyset 커서로 페이지를 넘긴다
        Index("ix_articles_feed_cursor", "published_at", "id"),
    )


class ArticleTermRow(Base):
    """기사에서 추출한 핵심 개념 — Discover 화면의 재료."""

    __tablename__ = "article_terms"

    article_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    term: Mapped[str] = mapped_column(String(80), primary_key=True)
    score: Mapped[float] = mapped_column(Float, default=0.0)

    __table_args__ = (Index("ix_article_terms_term", "term"),)


class UserReadRow(Base):
    """읽음·저장 이력. 개인정보로 취급 — 계정 삭제 시 함께 지운다."""

    __tablename__ = "user_reads"

    user_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    article_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    saved: Mapped[bool] = mapped_column(Boolean, default=False)


class FetchLogRow(Base):
    """소스별 수집 결과. 개인 식별 정보는 넣지 않는다."""

    __tablename__ = "fetch_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    source_id: Mapped[str] = mapped_column(String(60), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(24))  # ok | not_modified | error | skipped
    items_found: Mapped[int] = mapped_column(Integer, default=0)
    items_new: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(String(500), nullable=True)
