"""F1-06: 그래프-텍스트 양방향 동기화 서비스.

text_to_graph: 섹션 텍스트 수정 → 토큰 diff → 신규 노드 증분 추가
graph_to_text: 노드 추가 → LLM이 삽입 문장·위치 제안 (OpenAI 전제)
"""

from __future__ import annotations

import logging

from app.config import get_settings
from app.db.factory import get_graph_store
from app.parsers.keyword_classifier import classify_node_type
from app.parsers.token_extractor import extract_token_frequencies
from app.schemas.graph import GraphNode, RelationType
from app.schemas.sync import GraphToTextResult, TextToGraphResult
from app.services.embedding_index_service import EmbeddingIndexService

logger = logging.getLogger(__name__)


class SyncService:
    def __init__(self) -> None:
        self.graph = get_graph_store()
        self.index = EmbeddingIndexService()

    # ── Text → Graph ──────────────────────────────────────────────────────────

    async def text_to_graph(
        self, user_id: str, section_title: str, text: str
    ) -> TextToGraphResult:
        """텍스트에서 새 토큰을 추출해 그래프에 증분 추가."""
        token_freqs = extract_token_frequencies(text, top_n=80, min_freq=1)
        if not token_freqs:
            return TextToGraphResult(added_nodes=[], added_count=0)

        snapshot = await self.graph.get_snapshot(user_id)
        existing_labels = {n.label for n in snapshot.nodes}

        # Document 노드 찾기 (MENTIONED_IN 엣지 연결용)
        doc_node = next((n for n in snapshot.nodes if n.type.value == "Document"), None)

        added: list[GraphNode] = []
        new_node_ids: list[str] = []

        for label, freq in token_freqs:
            if label in existing_labels:
                continue
            node_type = classify_node_type(label)
            node = await self.graph.create_node(
                user_id,
                node_type=node_type,
                label=label,
                description=f"section={section_title}",
                external_refs={"source": "text_sync", "frequency": freq},
            )
            added.append(node)
            new_node_ids.append(node.id)
            existing_labels.add(label)

            if doc_node:
                try:
                    await self.graph.create_edge(
                        user_id,
                        source_id=node.id,
                        target_id=doc_node.id,
                        relation=RelationType.MENTIONED_IN,
                    )
                except Exception:
                    pass

            if len(added) >= 30:
                break

        # 새 노드 임베딩 인덱싱
        if added:
            await self.index.index_nodes(user_id, added)

        return TextToGraphResult(added_nodes=added, added_count=len(added))

    # ── Graph → Text ──────────────────────────────────────────────────────────

    async def graph_to_text(
        self, user_id: str, node_id: str, section_title: str, section_text: str
    ) -> GraphToTextResult:
        """노드를 텍스트에 삽입할 문장과 위치를 LLM이 제안."""
        node = await self.graph.get_node(user_id, node_id)
        if not node:
            raise ValueError(f"노드를 찾을 수 없습니다: {node_id}")

        settings = get_settings()
        if not settings.anthropic_api_key:
            # LLM 미설정 시 규칙 기반 fallback
            sentence = f"{node.label}에 대해 심층적으로 탐구하며 관련 역량을 키웠다."
            return GraphToTextResult(
                node_id=node_id,
                node_label=node.label,
                suggested_sentence=sentence,
                insert_hint="마지막 문장 다음에 추가",
            )

        import json
        import re

        import anthropic  # noqa: PLC0415

        def _parse_json(text: str) -> dict:
            text = text.strip()
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                pass
            m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
            if m:
                try:
                    return json.loads(m.group(1))
                except json.JSONDecodeError:
                    pass
            m = re.search(r"\{.*\}", text, re.DOTALL)
            if m:
                try:
                    return json.loads(m.group(0))
                except json.JSONDecodeError:
                    pass
            return {}

        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        prompt = (
            f"현재 [{section_title}] 섹션 텍스트:\n{section_text[:1500]}\n\n"
            f"다음 키워드를 이 세특에 자연스럽게 추가하려 합니다:\n"
            f"- 키워드: {node.label}\n"
            f"- 타입: {node.type.value}\n\n"
            "요구사항:\n"
            "1. 이 키워드를 담은 생기부 세특 문체의 문장을 1~2개 작성하세요.\n"
            "2. 기존 텍스트의 흐름을 자연스럽게 이어야 합니다.\n"
            "3. 삽입 위치 힌트도 한 줄로 알려주세요.\n\n"
            '반환 형식(JSON만 출력): {"suggested_sentence": "...", "insert_hint": "..."}'
        )

        try:
            resp = await client.messages.create(
                model=settings.anthropic_model,
                max_tokens=300,
                system=(
                    "당신은 대한민국 고등학생 생활기록부 세특 작성 전문가입니다. "
                    "반드시 유효한 JSON만 반환하세요."
                ),
                messages=[{"role": "user", "content": prompt}],
            )
            data = _parse_json(resp.content[0].text)
            suggested = data.get("suggested_sentence", "")
            hint = data.get("insert_hint", "마지막 문장 다음에 추가")
        except Exception as exc:
            logger.warning("graph_to_text LLM 실패: %s", exc)
            suggested = f"{node.label}과(와) 관련된 활동을 통해 심화 역량을 길렀다."
            hint = "마지막 문장 다음에 추가"

        return GraphToTextResult(
            node_id=node_id,
            node_label=node.label,
            suggested_sentence=suggested,
            insert_hint=hint,
        )
