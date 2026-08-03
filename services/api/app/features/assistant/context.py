"""문맥 칩 → 프롬프트 텍스트.

대시보드 카드의 액션(기사 "AI에게 질문", 그래프 "AI 확장 추천", 코멘트 "해결 방법
묻기")은 모두 여기를 거쳐 챗봇 문맥이 된다. 프론트는 `{type, id}` 만 보내고,
실제 내용은 서버가 DB 에서 다시 읽는다 — 클라이언트가 보낸 본문을 그대로 믿으면
사용자가 임의 문맥을 주입할 수 있다.
"""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import CommentRow
from app.features.research.models import ArticleRow

from .models import CTX_ARTICLE, CTX_COMMENT, CTX_GRAPH, CTX_NODE

logger = logging.getLogger("assistant.context")

MAX_CONTEXT_ITEMS = 8
SUMMARY_CHARS = 400


async def resolve_context(
    session: AsyncSession,
    user_id: str,
    items: list[dict],
    *,
    graph_snapshot=None,
) -> tuple[str, list[dict]]:
    """문맥 칩 목록 → (프롬프트 블록, 정규화된 칩 목록).

    소유자가 아닌 리소스는 조용히 건너뛴다.
    """
    blocks: list[str] = []
    resolved: list[dict] = []

    for item in items[:MAX_CONTEXT_ITEMS]:
        kind = (item or {}).get("type")
        ref = (item or {}).get("id")
        if not kind:
            continue

        if kind == CTX_ARTICLE and ref:
            article = await session.get(ArticleRow, ref)
            if article is None:
                continue
            blocks.append(
                f"[기사] {article.title}\n"
                f"  출처: {article.outlet} / 발행: "
                f"{article.published_at.date() if article.published_at else '미상'}\n"
                f"  요약: {article.summary[:SUMMARY_CHARS]}\n"
                f"  원문: {article.url}"
            )
            resolved.append({"type": kind, "id": ref, "label": article.title[:60]})

        elif kind == CTX_COMMENT and ref:
            comment = await session.get(CommentRow, ref)
            if comment is None or comment.user_id != user_id:
                continue
            blocks.append(
                f"[멘토 코멘트] {comment.author} ({comment.type})\n"
                f"  대상: {comment.target}\n"
                f"  내용: {comment.content[:SUMMARY_CHARS]}"
            )
            resolved.append({"type": kind, "id": ref, "label": f"{comment.author}님의 피드백"})

        elif kind in (CTX_GRAPH, CTX_NODE):
            block, label = _graph_block(graph_snapshot, kind, ref)
            if not block:
                continue
            blocks.append(block)
            resolved.append({"type": kind, "id": ref, "label": label})

    return ("\n\n".join(blocks), resolved)


def _graph_block(snapshot, kind: str, ref: str | None) -> tuple[str, str]:
    """지식 그래프 스냅샷에서 문맥 블록을 만든다."""
    if snapshot is None:
        return ("", "")
    nodes = list(getattr(snapshot, "nodes", []) or [])
    edges = list(getattr(snapshot, "edges", []) or [])
    if not nodes:
        return ("", "")

    if kind == CTX_NODE and ref:
        node = next((n for n in nodes if getattr(n, "id", None) == ref), None)
        if node is None:
            return ("", "")
        label = getattr(node, "label", "노드")
        # 이 노드에 직접 연결된 이웃만 — 그래프 전체를 넣으면 프롬프트가 폭발한다
        neighbors = [
            _label_of(nodes, e.target_id if e.source_id == ref else e.source_id)
            for e in edges
            if ref in (getattr(e, "source_id", None), getattr(e, "target_id", None))
        ]
        neighbors = [n for n in neighbors if n][:12]
        return (
            f"[그래프 노드] {label}\n  연결된 노드: {', '.join(neighbors) or '없음'}",
            label,
        )

    labels = [getattr(n, "label", "") for n in nodes][:40]
    return (
        f"[지식 그래프] 노드 {len(nodes)}개 / 연결 {len(edges)}개\n"
        f"  주요 노드: {', '.join(x for x in labels if x)}",
        "내 지식 그래프",
    )


def _label_of(nodes, node_id: str | None) -> str:
    if not node_id:
        return ""
    node = next((n for n in nodes if getattr(n, "id", None) == node_id), None)
    return getattr(node, "label", "") if node else ""
