"""피드 조회 — 사용자 키워드로 글을 고르고 keyset 커서로 페이지를 넘긴다.

매칭을 미리 계산해 두지 않는 이유: 사용자마다 키워드 집합이 다르고 수시로 바뀐다.
대신 articles.search_text 에 pg_trgm GIN 인덱스를 걸어 쿼리 시점에 판정한다.

페이지네이션은 OFFSET 이 아니라 (published_at, id) keyset 이다. 수집기가 계속
새 글을 넣는 서비스라 OFFSET 은 페이지를 넘기는 사이에 중복·누락을 만든다.
"""

from __future__ import annotations

import base64
import re
from datetime import UTC, datetime, timedelta

from sqlalchemy import Select, and_, false, or_, select, tuple_
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
# 기간 필터로 받는 값(일). 0 이면 제한 없음.
PERIODS = {0, 1, 7, 30, 90, 365}
# 정렬. **관련도순은 없다** — 글마다 점수를 매기는 구조가 아직 없어서,
# 있는 척하면 사용자가 고른 대로 정렬됐다고 착각한다.
SORT_LATEST = "latest"
SORT_OLDEST = "oldest"
SORTS = {SORT_LATEST, SORT_OLDEST}

# 발행일이 미래인 글은 내보내지 않는다.
#
# 원문 쪽 날짜가 잘못 오는 경우가 있다 — 일부 학술지(DOAJ 경유)가 2109~2121년으로
# 들어온다. 최신순 정렬에서 그런 글은 **영원히 맨 앞**을 차지해서, 피드도
# 대시보드 "오늘의 관심 기사"도 그 몇 건으로 굳는다. 실제로 최신 40건이 전부
# 미래 날짜 논문이라 뉴스가 한 건도 보이지 않았다.
#
# 시차와 예약 발행을 감안해 이틀만 봐준다.
FUTURE_TOLERANCE = timedelta(days=2)


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


_WORD_SPLIT = re.compile(r"[\s/·,]+")
MIN_WORD_LEN = 2


def term_condition(term: str):
    """한 낱말이면 그대로, 여러 낱말이면 **모든 낱말을 포함**하는 조건으로 본다.

    "cloud computing" 을 통짜 문구로 찾으면 우리 글 1,154건 중 0건이 걸린다.
    실제 글은 "cloud environments", "cloud-native computing" 처럼 쓰기 때문이다.
    낱말을 모두 포함하는 조건으로 바꾸면 그런 글이 잡히면서도(실측 2건) 무관한
    글이 쏟아지지 않는다. "data structure" 도 통짜 0건 → 낱말 조건 12건이다.

    낱말마다 LIKE 라 GIN trgm 인덱스는 그대로 탄다.
    """
    words = [w for w in _WORD_SPLIT.split(term.strip().lower()) if len(w) >= MIN_WORD_LEN]
    if not words:
        return None
    return and_(
        *[ArticleRow.search_text.like(f"%{_escape_like(w)}%", escape="\\") for w in words]
    )


def keyword_filter(keywords: list[str]):
    """키워드 OR 조건. 각각이 GIN trgm 인덱스를 탈 수 있도록 개별 LIKE 로 펼친다."""
    conditions = [c for c in (term_condition(k) for k in keywords) if c is not None]
    # 조건이 하나도 없으면 or_() 가 빈 절이 되어 전체가 통과해 버린다 — 막는다
    return or_(*conditions) if conditions else false()


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
    matched = []
    for k in keywords:
        words = [w for w in _WORD_SPLIT.split(k.strip().lower()) if len(w) >= MIN_WORD_LEN]
        if words and all(w in haystack for w in words):
            matched.append(k)
    return matched


def build_feed_query(
    *,
    user_id: str,
    keywords: list[str],
    tab: str,
    cursor: tuple[datetime, str] | None,
    limit: int,
    query: str = "",
    days: int = 0,
    selected: list[str] | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort: str = SORT_LATEST,
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
        if selected:
            # 화면에서 고른 키워드만으로 좁힌다. 내 키워드 전체(OR)와 같은 방식이라
            # 검색 로직을 새로 만들지 않는다 — 대상 집합만 줄어든다.
            stmt = stmt.where(keyword_filter(selected))
        elif not query:
            stmt = stmt.where(keyword_filter(keywords))
        if tab == TAB_NEWS:
            stmt = stmt.where(ArticleRow.kind == KIND_NEWS)
        elif tab == TAB_PAPER:
            stmt = stmt.where(ArticleRow.kind == KIND_PAPER)

    if query:
        # 키워드 매칭과 같은 길 — search_text 의 pg_trgm GIN 인덱스를 그대로 탄다
        condition = term_condition(query)
        if condition is not None:
            stmt = stmt.where(condition)

    # 발행일 기준으로 자른다. 수집 시각으로 자르면 "오래된 글을 오늘 수집한"
    # 경우가 최근 글로 보인다.
    if date_from is not None:
        stmt = stmt.where(ArticleRow.published_at >= date_from)
    if date_to is not None:
        stmt = stmt.where(ArticleRow.published_at <= date_to)
    if days and date_from is None and date_to is None:
        stmt = stmt.where(
            ArticleRow.published_at >= datetime.now(UTC) - timedelta(days=days)
        )

    # 날짜가 깨진 글이 최신순 맨 앞을 영구 점유하지 못하게 한다 (FUTURE_TOLERANCE 참고).
    # 저장함은 사용자가 직접 담은 글이라 건드리지 않는다.
    if tab != TAB_SAVED:
        stmt = stmt.where(ArticleRow.published_at <= datetime.now(UTC) + FUTURE_TOLERANCE)

    # keyset 커서는 정렬 방향과 짝이 맞아야 한다. 방향이 뒤집히면 비교도 뒤집는다.
    ascending = sort == SORT_OLDEST
    if cursor is not None:
        published_at, article_id = cursor
        pair = tuple_(ArticleRow.published_at, ArticleRow.id)
        target = tuple_(published_at, article_id)
        stmt = stmt.where(pair > target if ascending else pair < target)

    order = (
        (ArticleRow.published_at.asc(), ArticleRow.id.asc())
        if ascending
        else (ArticleRow.published_at.desc(), ArticleRow.id.desc())
    )
    return stmt.order_by(*order).limit(limit)
