"""피드 조회 — 사용자 키워드로 글을 고르고 keyset 커서로 페이지를 넘긴다.

매칭을 미리 계산해 두지 않는 이유: 사용자마다 키워드 집합이 다르고 수시로 바뀐다.
대신 articles.search_text 에 pg_trgm GIN 인덱스를 걸어 쿼리 시점에 판정한다.

페이지네이션은 OFFSET 이 아니라 (published_at, id) keyset 이다. 수집기가 계속
새 글을 넣는 서비스라 OFFSET 은 페이지를 넘기는 사이에 중복·누락을 만든다.
"""

from __future__ import annotations

import base64
from datetime import UTC, datetime

from sqlalchemy import Select, and_, or_, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from .models import KIND_NEWS, KIND_PAPER, ArticleRow, UserKeywordRow, UserReadRow

TAB_ALL = "all"
TAB_NEWS = "news"
TAB_PAPER = "paper"
TAB_SAVED = "saved"
TABS = {TAB_ALL, TAB_NEWS, TAB_PAPER, TAB_SAVED}

DEFAULT_LIMIT = 20
MAX_LIMIT = 50
# 검색어 상한 — trgm LIKE 는 길수록 느려지고, 이보다 긴 건 검색어가 아니라 문장이다
MAX_QUERY_LEN = 60


def encode_cursor(published_at: datetime, article_id: str) -> str:
    raw = f"{published_at.astimezone(UTC).isoformat()}|{article_id}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii")


def decode_cursor(cursor: str) -> tuple[datetime, str] | None:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode("ascii")).decode("utf-8")
        iso, article_id = raw.split("|", 1)
        return datetime.fromisoformat(iso), article_id
    except (ValueError, UnicodeDecodeError):
        return None  # 조작되었거나 낡은 커서 — 첫 페이지로 취급한다


def _escape_like(keyword: str) -> str:
    """LIKE 패턴 메타문자를 무력화한다. 키워드에 % 나 _ 가 들어와도 오작동하지 않게."""
    return keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def keyword_filter(keywords: list[str]):
    """키워드 OR 조건. 각각이 GIN trgm 인덱스를 탈 수 있도록 개별 LIKE 로 펼친다."""
    return or_(
        *[
            ArticleRow.search_text.like(f"%{_escape_like(k.lower())}%", escape="\\")
            for k in keywords
        ]
    )


async def load_keywords(session: AsyncSession, user_id: str) -> list[str]:
    rows = await session.execute(
        select(UserKeywordRow.keyword).where(UserKeywordRow.user_id == user_id)
    )
    return [k for (k,) in rows.all()]


def matched_keywords(search_text: str, keywords: list[str]) -> list[str]:
    """어떤 키워드가 걸렸는지는 SQL 로 되돌려받기 번거로워 파이썬에서 판정한다.

    search_text 는 이미 소문자로 정규화돼 있고 한 페이지는 최대 50건이라 부담이 없다.
    """
    haystack = search_text or ""
    return [k for k in keywords if k.lower() in haystack]


def build_feed_query(
    *,
    user_id: str,
    keywords: list[str],
    tab: str,
    cursor: tuple[datetime, str] | None,
    limit: int,
    query: str = "",
) -> Select:
    stmt = select(ArticleRow, UserReadRow).join(
        UserReadRow,
        and_(
            UserReadRow.article_id == ArticleRow.id,
            UserReadRow.user_id == user_id,
        ),
        isouter=True,
    )

    if tab == TAB_SAVED:
        # 저장함은 키워드와 무관하게 내가 저장한 글 전부
        stmt = stmt.where(UserReadRow.saved.is_(True))
    else:
        # 검색 중에는 **내 키워드 울타리를 걷는다.** 아직 등록하지 않은 개념을
        # 찾아보려고 검색하는 것인데 등록된 키워드로 한 번 더 거르면
        # "검색해도 안 나오는" 화면이 된다.
        if not query:
            stmt = stmt.where(keyword_filter(keywords))
        if tab == TAB_NEWS:
            stmt = stmt.where(ArticleRow.kind == KIND_NEWS)
        elif tab == TAB_PAPER:
            stmt = stmt.where(ArticleRow.kind == KIND_PAPER)

    if query:
        # 키워드 매칭과 같은 길 — search_text 의 pg_trgm GIN 인덱스를 그대로 탄다
        stmt = stmt.where(
            ArticleRow.search_text.like(f"%{_escape_like(query.lower())}%", escape="\\")
        )

    if cursor is not None:
        published_at, article_id = cursor
        stmt = stmt.where(
            tuple_(ArticleRow.published_at, ArticleRow.id) < tuple_(published_at, article_id)
        )

    return stmt.order_by(ArticleRow.published_at.desc(), ArticleRow.id.desc()).limit(limit)
