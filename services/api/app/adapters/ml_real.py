"""OpenAI-based ML adapter — Phase 2 relationship inference."""

from __future__ import annotations

import json
import logging

from app.schemas.graph import GraphSnapshot, NodeType, RelationType
from app.schemas.recommendations import SuggestedKeyword

logger = logging.getLogger(__name__)

_VALID_RELATIONS = {r.value for r in RelationType}


class OpenAIMLAdapter:
    def __init__(self, api_key: str, model: str = "gpt-4o-mini") -> None:
        from openai import AsyncOpenAI  # noqa: PLC0415
        self._client = AsyncOpenAI(api_key=api_key)
        self._model = model

    # ── MLAdapter interface (branch recommendation stays mock-level for now) ──

    async def suggest_branch_keywords(
        self,
        *,
        user_id: str,
        seeds: list[str],
        graph: GraphSnapshot,
        retrieval_labels: list[str],
        max_results: int,
    ) -> list[SuggestedKeyword]:
        del user_id, graph, retrieval_labels
        if not seeds:
            return []
        seed_str = ", ".join(seeds)
        prompt = (
            f"다음 관심 키워드와 관련된 탐구·활동 주제를 {max_results}개 이내로 추천해주세요: {seed_str}\n\n"
            '반환 형식(JSON): {"suggestions": [{"label": "...", "confidence": 0.0-1.0, "rationale": "..."}]}'
        )
        try:
            resp = await self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": "당신은 고등학생 생기부 설계 전문가입니다."},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.4,
            )
            data = json.loads(resp.choices[0].message.content)
            return [
                SuggestedKeyword(
                    label=s["label"],
                    confidence=float(s.get("confidence", 0.7)),
                    rationale=s.get("rationale"),
                )
                for s in data.get("suggestions", [])[:max_results]
            ]
        except Exception as exc:
            logger.warning("branch_recommend LLM call failed: %s", exc)
            return []

    async def extract_keywords_from_text(
        self,
        *,
        user_id: str,
        text: str,
    ) -> list[tuple[str, NodeType]]:
        del user_id, text
        return []

    # ── GraphAnalyzeAdapter interface ─────────────────────────────────────────

    async def infer_relationships(
        self,
        *,
        section_text: str,
        nodes: list[tuple[str, str, NodeType]],  # (node_id, label, type)
        max_edges: int = 20,
    ) -> list[dict]:
        """Ask LLM to infer specific relationship types between extracted nodes."""
        if not nodes or not section_text.strip():
            return []

        node_lines = "\n".join(
            f"- {label} ({node_type.value})" for _, label, node_type in nodes
        )
        prompt = (
            "다음은 학생 생기부(학교생활기록부) 텍스트와 추출된 키워드/개념 노드 목록입니다.\n\n"
            f"[생기부 텍스트]\n{section_text[:3000]}\n\n"
            f"[노드 목록]\n{node_lines}\n\n"
            "위 노드들 사이의 의미 있는 관계를 JSON으로 반환하세요.\n"
            "사용 가능한 관계 유형:\n"
            "  INFLUENCES    — A가 B에 영향을 줌 (인과, 촉진)\n"
            "  EVOLVED_FROM  — A가 B에서 발전/파생됨\n"
            "  EVIDENCED_BY  — A가 B에 의해 입증/뒷받침됨\n"
            "  CONTRADICTS   — A와 B가 상충하거나 대조됨\n"
            "  RELATES_TO    — 그 외 일반적 관련성\n\n"
            f"최대 {max_edges}개의 관계만 반환하세요. "
            "노드 목록에 없는 레이블은 사용하지 마세요.\n\n"
            '반환 형식(JSON): {"edges": [{"source_label": "...", "target_label": "...", '
            '"relation": "INFLUENCES", "confidence": 0.85}]}'
        )
        try:
            resp = await self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": "당신은 학생 생기부 온톨로지 분석 전문가입니다."},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
            )
            data = json.loads(resp.choices[0].message.content)
            edges = data.get("edges", [])
            # Validate relation types
            for e in edges:
                if e.get("relation") not in _VALID_RELATIONS:
                    e["relation"] = "RELATES_TO"
            return edges[:max_edges]
        except Exception as exc:
            logger.warning("infer_relationships LLM call failed: %s", exc)
            return []
