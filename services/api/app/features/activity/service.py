"""최근 활동 통합.

**활동 테이블은 없다.** 대화·기사·그래프·코멘트·문서·양식·음성은 이미 각자의
자리에 있고, 여기서 그것을 읽어 하나의 목록으로 묶는다. 이벤트를 또 한 벌
적어 두면 두 기록이 어긋나는 날이 오고, 지난 데이터는 어차피 비어 있다.

묶는 축은 **대화**다. MBX 에서 작업은 대개 "물어보고 → 그 결과를 그래프·문서로
옮기는" 흐름이라, 그 흐름의 이름표 노릇을 할 수 있는 건 대화뿐이다
(sessionId·projectId 같은 것은 이 프로젝트에 없다).

대화에 붙는 기준은 둘 다 만족할 때뿐이다:
  1) 같은 것을 가리킨다 — 대화가 물고 있던 문맥 id 와 같은 기사·코멘트
  2) 시간이 가깝다 — 대화가 살아 있던 구간 ±FOLD_WINDOW

시간만 가깝다고 묶지 않는다. 상관없는 두 작업이 우연히 붙어 버리면, 목록이
"내가 한 일"이 아니라 "그럴듯한 이야기"가 된다.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.factory import get_graph_store
from app.db.postgres import CommentRow, DocumentSectionRow, FormDocRow, VoiceSessionRow
from app.features.assistant.models import ConversationRow, MessageRow
from app.features.research.models import ArticleRow, UserReadRow

from . import titles

logger = logging.getLogger("activity")

# 얼마나 거슬러 올라가 볼 것인가. 더 옛날 것은 "최근"이 아니다.
LOOKBACK_DAYS = 60
# 대화에 딸린 작업으로 볼 시간 폭
FOLD_WINDOW = timedelta(hours=6)
# 원본별로 훑어올 최대 건수 — 목록은 어차피 앞쪽 몇십 개만 쓴다
SCAN_LIMIT = 60

TYPE_CONVERSATION = "conversation"
TYPE_ARTICLE = "article"
TYPE_PAPER = "paper"
TYPE_GRAPH = "graph"
TYPE_FEEDBACK = "feedback"
TYPE_DOCUMENT = "document"
TYPE_FORM = "form"
TYPE_VOICE = "voice"
TYPE_MIXED = "mixed"

# 화면 라벨 — 문맥 요약 한 줄에 쓴다
TYPE_LABEL = {
    TYPE_CONVERSATION: "대화",
    TYPE_ARTICLE: "기사",
    TYPE_PAPER: "논문",
    TYPE_GRAPH: "그래프",
    TYPE_FEEDBACK: "피드백",
    TYPE_DOCUMENT: "문서",
    TYPE_FORM: "양식",
    TYPE_VOICE: "음성",
}


@dataclass
class Activity:
    """화면에 나가기 직전의 활동 하나. 스키마로는 routes 에서 옮긴다."""

    key: str
    title: str
    generated_title: bool
    primary_type: str
    updated_at: datetime
    created_at: datetime
    conversation_id: str | None = None
    context_types: list[str] = field(default_factory=list)
    contexts: list[dict] = field(default_factory=list)
    article: tuple[str, str] | None = None  # (id, title)
    graph: tuple[str | None, str] | None = None
    feedback: tuple[str, str] | None = None
    route: str | None = None
    message_count: int = 0
    added_node_count: int = 0
    resolved_comment_count: int = 0
    saved_article_count: int = 0
    modified_document_count: int = 0
    read_count: int = 0
    search_hint: str = ""

    def touch(self, when: datetime) -> None:
        """딸린 작업이 붙으면 활동 시각도 그만큼 늦춰진다."""
        if when > self.updated_at:
            self.updated_at = when


def _ctx_kind(raw_type: str, paper_ids: set[str], ctx_id: str | None) -> str:
    """대화에 붙어 있던 문맥 종류를 활동 유형으로 옮긴다."""
    if raw_type == "article":
        return TYPE_PAPER if ctx_id and ctx_id in paper_ids else TYPE_ARTICLE
    if raw_type in ("graph", "node"):
        return TYPE_GRAPH
    if raw_type == "comment":
        return TYPE_FEEDBACK
    if raw_type == "file":
        return TYPE_DOCUMENT
    return TYPE_CONVERSATION


# 프론트가 문맥 칩에 붙이는 일반 이름. 진짜 그래프 이름을 알면 그걸로 바꾼다.
GENERIC_GRAPH_LABELS = {"", "내 지식 그래프", "지식 그래프"}


async def _conversation_activities(
    db: AsyncSession, user_id: str, since: datetime, graph_title: str
) -> tuple[list[Activity], dict[str, Activity], dict[str, Activity]]:
    """대화 하나 = 활동 하나. 그 대화가 물고 있던 문맥도 함께 돌려준다.

    두 번째·세 번째 값은 "이 기사 id / 이 코멘트 id 를 쓰던 대화"를 찾기 위한
    색인이다. 딸린 작업을 접어 넣을 때 쓴다.
    """
    rows = (
        await db.execute(
            select(ConversationRow)
            .where(
                ConversationRow.user_id == user_id,
                ConversationRow.message_count > 0,
                ConversationRow.updated_at >= since,
            )
            .order_by(ConversationRow.updated_at.desc())
            .limit(SCAN_LIMIT)
        )
    ).scalars().all()
    if not rows:
        return [], {}, {}

    ids = [c.id for c in rows]
    messages = (
        await db.execute(
            select(MessageRow)
            .where(MessageRow.conversation_id.in_(ids))
            .order_by(MessageRow.created_at)
        )
    ).scalars().all()

    by_conv: dict[str, list[MessageRow]] = {cid: [] for cid in ids}
    for m in messages:
        by_conv.setdefault(m.conversation_id, []).append(m)

    # 어떤 기사가 논문인지 — 문맥 종류를 기사/논문으로 가르는 데 필요
    article_ids = {
        c.get("id")
        for msgs in by_conv.values()
        for m in msgs
        for c in _load_contexts(m)
        if c.get("type") == "article" and c.get("id")
    }
    paper_ids: set[str] = set()
    article_titles: dict[str, str] = {}
    if article_ids:
        arts = (
            await db.execute(
                select(ArticleRow.id, ArticleRow.title, ArticleRow.kind).where(
                    ArticleRow.id.in_(article_ids)
                )
            )
        ).all()
        for aid, title, kind in arts:
            article_titles[aid] = title
            if kind == "paper":
                paper_ids.add(aid)

    activities: list[Activity] = []
    by_article: dict[str, Activity] = {}
    by_comment: dict[str, Activity] = {}

    for conv in rows:
        msgs = by_conv.get(conv.id, [])
        first_user = next((m.content for m in msgs if m.role == "user"), "")
        contexts: list[dict] = []
        seen: set[str] = set()
        for m in msgs:
            for c in _load_contexts(m):
                key = f"{c.get('type')}:{c.get('id') or ''}"
                if key in seen:
                    continue
                seen.add(key)
                contexts.append(c)

        kinds: list[str] = []
        article_ref = graph_ref = feedback_ref = None
        for c in contexts:
            kind = _ctx_kind(c.get("type", ""), paper_ids, c.get("id"))
            if kind not in kinds:
                kinds.append(kind)
            label = c.get("label") or ""
            if kind in (TYPE_ARTICLE, TYPE_PAPER) and article_ref is None:
                article_ref = (c.get("id") or "", article_titles.get(c.get("id") or "", label))
            elif kind == TYPE_GRAPH and graph_ref is None:
                # "내 지식 그래프"보다 실제 그래프 이름이 목록에서 훨씬 쓸모 있다
                name = graph_title if label in GENERIC_GRAPH_LABELS else label
                graph_ref = (c.get("id"), name or "내 지식 그래프")
            elif kind == TYPE_FEEDBACK and feedback_ref is None:
                feedback_ref = (c.get("id") or "", label)

        primary = TYPE_CONVERSATION
        if len(kinds) >= 2:
            primary = TYPE_MIXED
        elif kinds:
            primary = kinds[0]

        context_label = None
        if article_ref:
            context_label = article_ref[1]
        elif graph_ref:
            context_label = graph_ref[1]
        elif feedback_ref:
            context_label = feedback_ref[1]

        title = titles.resolve(
            override=None,
            stored_title=conv.title,
            first_message=first_user,
            context_label=context_label,
        )
        last_text = next((m.content for m in reversed(msgs) if m.content), "")

        activity = Activity(
            key=f"conv:{conv.id}",
            title=title,
            generated_title=title != titles.shorten(conv.title, titles.TITLE_MAX),
            primary_type=primary,
            updated_at=conv.updated_at,
            created_at=conv.created_at,
            conversation_id=conv.id,
            context_types=kinds,
            contexts=contexts,
            article=article_ref,
            graph=graph_ref,
            feedback=feedback_ref,
            message_count=conv.message_count or len(msgs),
            search_hint=" ".join(
                [conv.title or "", conv.subject or "", first_user, last_text[:200]]
                + [c.get("label") or "" for c in contexts]
            ),
        )
        activities.append(activity)
        if article_ref and article_ref[0]:
            by_article.setdefault(article_ref[0], activity)
        if feedback_ref and feedback_ref[0]:
            by_comment.setdefault(feedback_ref[0], activity)

    return activities, by_article, by_comment


def _load_contexts(message: MessageRow) -> list[dict]:
    try:
        raw = json.loads(message.context or "[]")
    except (TypeError, ValueError):
        return []
    return [c for c in raw if isinstance(c, dict)]


def _in_window(activity: Activity, when: datetime) -> bool:
    """대화가 살아 있던 구간 ±FOLD_WINDOW 안인가."""
    return activity.created_at - FOLD_WINDOW <= when <= activity.updated_at + FOLD_WINDOW


async def _article_activities(
    db: AsyncSession, user_id: str, since: datetime, by_article: dict[str, Activity]
) -> list[Activity]:
    """읽거나 저장한 기사.

    **글 하나를 열었다고 활동 하나를 만들지 않는다.** 그러면 목록이 "읽기 기록"이
    되어, 정작 이어서 할 일(대화)이 읽은 글 사이에 파묻힌다. 그 글로 대화한 적이
    있으면 그 활동에 접어 넣고, 없으면 **하루치를 한 덩어리**로 묶는다.
    """
    rows = (
        await db.execute(
            select(UserReadRow, ArticleRow)
            .join(ArticleRow, ArticleRow.id == UserReadRow.article_id)
            .where(UserReadRow.user_id == user_id, UserReadRow.read_at >= since)
            .order_by(UserReadRow.read_at.desc())
            .limit(SCAN_LIMIT)
        )
    ).all()

    buckets: dict[str, list[tuple]] = {}
    for read, article in rows:
        host = by_article.get(article.id)
        if host is not None and _in_window(host, read.read_at):
            if read.saved:
                host.saved_article_count += 1
            host.touch(read.read_at)
            continue
        buckets.setdefault(read.read_at.date().isoformat(), []).append((read, article))

    out: list[Activity] = []
    for day, entries in buckets.items():
        latest_read, latest_article = max(entries, key=lambda e: e[0].read_at)
        saved = sum(1 for r, _ in entries if r.saved)
        papers = sum(1 for _, a in entries if a.kind == "paper")
        # 그날 더 많이 읽은 쪽을 대표 유형으로 — 배지가 실제와 어긋나지 않게
        kind = TYPE_PAPER if papers * 2 > len(entries) else TYPE_ARTICLE
        head = titles.shorten(latest_article.title)
        title = (
            f"{head} 외 {len(entries) - 1}건 읽기" if len(entries) > 1 else f"{head} 읽기"
        )
        out.append(
            Activity(
                key=f"read:{day}",
                title=titles.shorten(title, titles.TITLE_MAX),
                generated_title=True,
                primary_type=kind,
                updated_at=latest_read.read_at,
                created_at=min(r.read_at for r, _ in entries),
                context_types=[kind],
                # 이어서 물을 때 붙일 문맥은 그날 마지막으로 본 글 하나면 된다
                contexts=[
                    {"type": "article", "id": latest_article.id, "label": latest_article.title}
                ],
                article=(latest_article.id, latest_article.title),
                route="S41",
                saved_article_count=saved,
                read_count=len(entries),
                search_hint=" ".join(a.title for _, a in entries),
            )
        )
    return out


async def _feedback_activities(
    db: AsyncSession, user_id: str, since: datetime, by_comment: dict[str, Activity]
) -> list[Activity]:
    rows = (
        await db.execute(
            select(CommentRow)
            .where(CommentRow.user_id == user_id, CommentRow.created_at >= since)
            .order_by(CommentRow.created_at.desc())
            .limit(SCAN_LIMIT)
        )
    ).scalars().all()

    out: list[Activity] = []
    for c in rows:
        host = by_comment.get(c.id)
        if host is not None and _in_window(host, c.created_at):
            if c.replied:
                host.resolved_comment_count += 1
            host.touch(c.created_at)
            continue
        target = c.target or "전체 그래프"
        out.append(
            Activity(
                key=f"comment:{c.id}",
                title=titles.shorten(f"‘{titles.shorten(target)}’ 멘토 피드백", titles.TITLE_MAX),
                generated_title=True,
                primary_type=TYPE_FEEDBACK,
                updated_at=c.created_at,
                created_at=c.created_at,
                context_types=[TYPE_FEEDBACK],
                contexts=[{"type": "comment", "id": c.id, "label": f"{c.author}님의 피드백"}],
                feedback=(c.id, f"{c.author}님의 피드백"),
                route="S24",
                resolved_comment_count=1 if c.replied else 0,
                search_hint=f"{c.author} {target} {c.content[:200]}",
            )
        )
    return out


def _graph_activities(
    snapshot, graph_title: str, since: datetime, conversations: list[Activity]
) -> list[Activity]:
    """그래프 작업은 **하루 단위로 한 덩어리**다.

    노드를 하나 추가할 때마다 항목을 만들면 목록이 노드 목록이 된다. 같은 날
    그래프를 문맥으로 쓴 대화가 있으면 그쪽에 노드 수를 접어 넣는다.
    """
    if not snapshot or not snapshot.nodes:
        return []

    buckets: dict[str, list] = {}
    for node in snapshot.nodes:
        stamp = getattr(node, "updated_at", None) or getattr(node, "created_at", None)
        if stamp is None:
            continue
        if stamp.tzinfo is None:
            stamp = stamp.replace(tzinfo=UTC)
        if stamp < since:
            continue
        buckets.setdefault(stamp.date().isoformat(), []).append((stamp, node))

    graph_convs = [a for a in conversations if TYPE_GRAPH in a.context_types]
    out: list[Activity] = []
    for day, entries in buckets.items():
        latest = max(s for s, _ in entries)
        host = next((a for a in graph_convs if a.updated_at.date().isoformat() == day), None)
        if host is not None:
            host.added_node_count += len(entries)
            host.touch(latest)
            continue
        labels = [getattr(n, "label", "") for _, n in entries if getattr(n, "label", "")]
        out.append(
            Activity(
                key=f"graph:{day}",
                title=titles.shorten(f"‘{titles.shorten(graph_title)}’ 지식 그래프 정리", titles.TITLE_MAX),
                generated_title=True,
                primary_type=TYPE_GRAPH,
                updated_at=latest,
                created_at=min(s for s, _ in entries),
                context_types=[TYPE_GRAPH],
                contexts=[{"type": "graph", "id": None, "label": graph_title}],
                graph=(None, graph_title),
                route="S06",
                added_node_count=len(entries),
                search_hint=f"{graph_title} {' '.join(labels[:20])}",
            )
        )
    return out


async def _document_activities(db: AsyncSession, user_id: str, since: datetime) -> list[Activity]:
    sections = (
        await db.execute(
            select(DocumentSectionRow)
            .where(DocumentSectionRow.user_id == user_id, DocumentSectionRow.updated_at >= since)
            .order_by(DocumentSectionRow.updated_at.desc())
            .limit(SCAN_LIMIT)
        )
    ).scalars().all()
    forms = (
        await db.execute(
            select(FormDocRow)
            .where(FormDocRow.user_id == user_id, FormDocRow.updated_at >= since)
            .order_by(FormDocRow.updated_at.desc())
            .limit(SCAN_LIMIT)
        )
    ).scalars().all()

    out: list[Activity] = []
    for s in sections:
        out.append(
            Activity(
                key=f"doc:{s.id}",
                title=titles.shorten(f"{s.section_type} 생기부 문서 작성", titles.TITLE_MAX),
                generated_title=True,
                primary_type=TYPE_DOCUMENT,
                updated_at=s.updated_at,
                created_at=s.created_at,
                context_types=[TYPE_DOCUMENT],
                contexts=[{"type": "file", "id": s.id, "label": s.section_type}],
                route="S11",
                modified_document_count=1,
                search_hint=f"{s.section_type} {s.content[:200]}",
            )
        )
    for f in forms:
        out.append(
            Activity(
                key=f"form:{f.id}",
                title=titles.shorten(f"{titles.shorten(f.title)} 양식 작성", titles.TITLE_MAX),
                generated_title=True,
                primary_type=TYPE_FORM,
                updated_at=f.updated_at,
                created_at=f.created_at,
                context_types=[TYPE_FORM],
                contexts=[{"type": "file", "id": f.id, "label": f.title}],
                route="S20",
                modified_document_count=1,
                search_hint=f"{f.title} {f.content[:200]}",
            )
        )
    return out


async def _voice_activities(db: AsyncSession, user_id: str, since: datetime) -> list[Activity]:
    rows = (
        await db.execute(
            select(VoiceSessionRow)
            .where(VoiceSessionRow.user_id == user_id, VoiceSessionRow.updated_at >= since)
            .order_by(VoiceSessionRow.updated_at.desc())
            .limit(SCAN_LIMIT)
        )
    ).scalars().all()
    return [
        Activity(
            key=f"voice:{v.id}",
            title=titles.shorten(f"{titles.shorten(v.title)} 음성 세션", titles.TITLE_MAX),
            generated_title=True,
            primary_type=TYPE_VOICE,
            updated_at=v.updated_at,
            created_at=v.created_at,
            context_types=[TYPE_VOICE],
            contexts=[],
            route="S15",
            search_hint=f"{v.title} {v.transcript[:200]}",
        )
        for v in rows
    ]


def context_summary(activity: Activity) -> str:
    """목록 두 번째 줄. **대표 문맥 → 결과** 순으로 한 줄만 만든다."""
    parts: list[str] = []
    if activity.article:
        kind = TYPE_PAPER if activity.primary_type == TYPE_PAPER else TYPE_ARTICLE
        parts.append(f"{TYPE_LABEL[kind]} · {titles.shorten(activity.article[1], 28)}")
    elif activity.graph:
        parts.append(f"{TYPE_LABEL[TYPE_GRAPH]} · {titles.shorten(activity.graph[1], 28)}")
    elif activity.feedback:
        parts.append(f"{TYPE_LABEL[TYPE_FEEDBACK]} · {titles.shorten(activity.feedback[1], 28)}")

    results: list[str] = []
    if activity.message_count:
        results.append(f"대화 {activity.message_count}개")
    if activity.added_node_count:
        results.append(f"노드 {activity.added_node_count}개 추가")
    if activity.read_count:
        label = TYPE_LABEL[TYPE_PAPER if activity.primary_type == TYPE_PAPER else TYPE_ARTICLE]
        results.append(f"{label} {activity.read_count}건 읽음")
    if activity.saved_article_count:
        results.append(f"기사 {activity.saved_article_count}개 저장")
    if activity.resolved_comment_count:
        results.append(f"코멘트 {activity.resolved_comment_count}개 해결")
    if activity.modified_document_count and not parts:
        results.append("문서 수정")

    # 한 줄이므로 둘 다 넣지 않는다 — 결과가 있으면 결과가 더 쓸모 있다
    if results:
        return " · ".join(results[:2])
    return parts[0] if parts else ""


async def collect(db: AsyncSession, user_id: str, now: datetime) -> list[Activity]:
    """모든 출처를 훑어 하나의 목록으로. 정렬은 마지막 활동 시각 내림차순."""
    since = now - timedelta(days=LOOKBACK_DAYS)

    # 그래프는 한 번만 읽는다 — 대화 제목(그래프 이름)과 그래프 활동 양쪽이 쓴다
    try:
        snapshot = await get_graph_store().get_snapshot(user_id)
    except Exception:  # noqa: BLE001 — 그래프가 없어도 나머지 활동은 보여야 한다
        logger.warning("graph snapshot unavailable user=%s", user_id)
        snapshot = None
    root = next(
        (n for n in (snapshot.nodes if snapshot else []) if getattr(n, "type", "") == "root"),
        None,
    )
    graph_title = getattr(root, "label", "") or "내 지식 그래프"

    conversations, by_article, by_comment = await _conversation_activities(
        db, user_id, since, graph_title
    )
    articles = await _article_activities(db, user_id, since, by_article)
    feedback = await _feedback_activities(db, user_id, since, by_comment)
    graph = _graph_activities(snapshot, graph_title, since, conversations)
    documents = await _document_activities(db, user_id, since)
    voice = await _voice_activities(db, user_id, since)

    merged = conversations + articles + feedback + graph + documents + voice
    merged.sort(key=lambda a: a.updated_at, reverse=True)
    return merged
