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

from sqlalchemy import Select, and_, case, false, func, or_, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from .models import (
    KIND_NEWS,
    KIND_PAPER,
    ArticleFeedbackRow,
    ArticleRow,
    UserKeywordRow,
    UserReadRow,
)

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
# 취향순 — 좋아요(👍)한 글의 주제부터 보여주고, 그 안에서는 최신순이다.
# **관련도순이 아니다.** 글마다 점수를 매기는 구조는 여전히 없고, 여기서 쓰는
# 근거는 사용자가 직접 누른 좋아요 하나뿐이다.
SORT_TASTE = "taste"
SORTS = {SORT_LATEST, SORT_OLDEST, SORT_TASTE}

FEEDBACK_LIKE = "like"
FEEDBACK_HIDE = "hide"
FEEDBACK_VALUES = {FEEDBACK_LIKE, FEEDBACK_HIDE}

# 발행일이 미래인 글은 내보내지 않는다.
#
# 원문 쪽 날짜가 잘못 오는 경우가 있다 — 일부 학술지(DOAJ 경유)가 2109~2121년으로
# 들어온다. 최신순 정렬에서 그런 글은 **영원히 맨 앞**을 차지해서, 피드도
# 대시보드 "오늘의 관심 기사"도 그 몇 건으로 굳는다. 실제로 최신 40건이 전부
# 미래 날짜 논문이라 뉴스가 한 건도 보이지 않았다.
#
# 시차와 예약 발행을 감안해 이틀만 봐준다.
FUTURE_TOLERANCE = timedelta(days=2)


def day_bucket(published_at: datetime) -> datetime:
    """그 글이 실린 **날**. SQL 쪽 `_day_expr()` 과 반드시 같은 값이어야 한다.

    keyset 커서가 날짜 묶음 경계를 넘어야 하는데, 파이썬과 Postgres 가 하루를
    다르게 자르면 그 경계에서 글이 겹치거나 통째로 사라진다. 양쪽 다 **UTC 로
    옮긴 뒤** 자정으로 내린다(Postgres 세션 시간대에 기대지 않는다).
    """
    return published_at.astimezone(UTC).replace(
        tzinfo=None, hour=0, minute=0, second=0, microsecond=0
    )


def encode_cursor(
    published_at: datetime, article_id: str, pref: int = 0, news: int = 0
) -> str:
    """다음 페이지의 시작점.

    취향순에서는 정렬 키가 (선호 여부, 발행일, id) 세 값이라 커서도 셋을 담는다.
    앞의 두 자리만 담으면 선호 묶음과 나머지 묶음의 경계에서 페이지가 겹치거나
    통째로 건너뛴다.

    「전체」 최신순에서는 정렬 키가 (날짜, 기사 먼저, 발행 시각, id) 넷이다.
    날짜는 발행 시각에서 나오므로 커서에 더 담을 것은 **기사인지 여부** 하나다.
    """
    raw = f"{published_at.astimezone(UTC).isoformat()}|{article_id}|{pref}|{news}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii")


def decode_cursor(cursor: str) -> tuple[datetime, str, int, int] | None:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode("ascii")).decode("utf-8")
        parts = raw.split("|")
        iso, article_id = parts[0], parts[1]
        # 옛 커서(자리가 셋 이하)도 그대로 받는다 — 화면을 열어 둔 채 배포되면
        # 다음 페이지 요청이 낡은 커서를 들고 온다.
        pref = int(parts[2]) if len(parts) > 2 else 0
        news = int(parts[3]) if len(parts) > 3 else 0
        return datetime.fromisoformat(iso), article_id, pref, news
    except (ValueError, IndexError, UnicodeDecodeError):
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


def _day_expr():
    """SQL 쪽 날짜 묶음. `day_bucket()` 과 같은 값을 내야 한다 — 주석 참고."""
    return func.date_trunc("day", func.timezone("UTC", ArticleRow.published_at))


def _news_expr():
    """기사면 1, 논문이면 0. 큰 값이 먼저 서므로 기사가 앞이다."""
    return case((ArticleRow.kind == KIND_NEWS, 1), else_=0)


def build_feed_query(
    *,
    user_id: str,
    keywords: list[str],
    tab: str,
    cursor: tuple[datetime, str, int, int] | None,
    limit: int,
    query: str = "",
    days: int = 0,
    selected: list[str] | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort: str = SORT_LATEST,
    preferred: list[str] | None = None,
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
        # "관심 없어요" 한 글은 다시 보여주지 않는다. 저장함은 건드리지 않는다 —
        # 직접 담아 둔 글까지 말없이 사라지면 없어진 줄 안다.
        stmt = stmt.where(
            ~select(ArticleFeedbackRow.article_id)
            .where(
                ArticleFeedbackRow.user_id == user_id,
                ArticleFeedbackRow.article_id == ArticleRow.id,
                ArticleFeedbackRow.value == FEEDBACK_HIDE,
            )
            .exists()
        )

    if tab != TAB_SAVED:
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

    # 취향순 — 좋아요한 주제에 걸리는 글을 앞으로. 걸릴 게 없으면(좋아요가
    # 없거나 주제가 안 잡히면) 최신순과 똑같이 굴러야 한다.
    pref_expr = None
    if sort == SORT_TASTE and preferred:
        pref_expr = case((keyword_filter(preferred), 1), else_=0)

    # 「전체」 최신순은 **같은 날 안에서 기사를 논문보다 앞에** 세운다.
    #
    # arXiv 는 하루에도 수백 편이 오늘 날짜로 들어온다. 순수 최신순이면 그
    # 무더기가 앞을 다 덮어서, 「전체」를 열면 화면이 논문으로만 찬다(실제로
    # 첫 화면 전부가 arXiv 였다). 그렇다고 기사를 통째로 앞세우면 논문은
    # 수만 건 뒤로 밀려 「전체」에서 영영 안 보인다 — 날짜로 먼저 묶고 그
    # 안에서만 기사를 올린다. 어제 기사보다 오늘 논문이 먼저다.
    #
    # 뉴스·논문 탭은 한 종류뿐이라 뜻이 없고, 오래된순·취향순은 사용자가
    # 정렬을 골라 둔 것이라 건드리지 않는다.
    news_first = tab == TAB_ALL and sort == SORT_LATEST
    day_expr = _day_expr() if news_first else None
    news_expr = _news_expr() if news_first else None

    # keyset 커서는 정렬 방향과 짝이 맞아야 한다. 방향이 뒤집히면 비교도 뒤집는다.
    ascending = sort == SORT_OLDEST
    if cursor is not None:
        published_at, article_id, pref, news = cursor
        if day_expr is not None:
            quad = tuple_(day_expr, news_expr, ArticleRow.published_at, ArticleRow.id)
            stmt = stmt.where(
                quad < tuple_(day_bucket(published_at), news, published_at, article_id)
            )
        elif pref_expr is not None:
            triple = tuple_(pref_expr, ArticleRow.published_at, ArticleRow.id)
            stmt = stmt.where(triple < tuple_(pref, published_at, article_id))
        else:
            pair = tuple_(ArticleRow.published_at, ArticleRow.id)
            target = tuple_(published_at, article_id)
            stmt = stmt.where(pair > target if ascending else pair < target)

    if day_expr is not None:
        order = (
            day_expr.desc(),
            news_expr.desc(),
            ArticleRow.published_at.desc(),
            ArticleRow.id.desc(),
        )
    elif pref_expr is not None:
        order = (pref_expr.desc(), ArticleRow.published_at.desc(), ArticleRow.id.desc())
    elif ascending:
        order = (ArticleRow.published_at.asc(), ArticleRow.id.asc())
    else:
        order = (ArticleRow.published_at.desc(), ArticleRow.id.desc())
    return stmt.order_by(*order).limit(limit)


async def liked_topics(session: AsyncSession, user_id: str, keywords: list[str]) -> list[str]:
    """좋아요한 글에서 걸렸던 내 키워드들 — 취향순이 앞으로 올릴 주제.

    글마다 점수를 매기는 게 아니라 **내가 직접 누른 좋아요**만 근거로 삼는다.
    최근 것부터 40건까지만 본다 — 취향은 바뀌고, 3년 전 좋아요까지 끌고 다니면
    지금 관심사가 묻힌다.
    """
    if not keywords:
        return []
    rows = (
        await session.execute(
            select(ArticleRow.search_text)
            .join(
                ArticleFeedbackRow,
                and_(
                    ArticleFeedbackRow.article_id == ArticleRow.id,
                    ArticleFeedbackRow.user_id == user_id,
                    ArticleFeedbackRow.value == FEEDBACK_LIKE,
                ),
            )
            .order_by(ArticleFeedbackRow.created_at.desc())
            .limit(40)
        )
    ).scalars().all()

    out: list[str] = []
    for text in rows:
        for k in matched_keywords(text, keywords):
            if k not in out:
                out.append(k)
    return out
