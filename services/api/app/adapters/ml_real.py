"""Anthropic-based ML adapter — keyword extraction, recommendations, relationship inference."""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time

from app.adapters.web_tools import build_tools as build_web_tools
from app.adapters.web_tools import downgrade as downgrade_web_tools
from app.schemas.extraction import ExtractedKeyword
from app.schemas.graph import GraphSnapshot, NodeType, RelationType
from app.schemas.pruning import (
    ACTIVITY_MAX,
    BRANCH_TYPE_ORDER,
    EXPECTED_OUTPUT_MAX,
    REASON_MAX,
    RELATED_NODES_MAX,
    SOURCES_MAX,
    TITLE_MAX,
)
from app.schemas.recommendations import SuggestedKeyword
from app.services.llm_usage import LLMUsage, usage_from_response

logger = logging.getLogger(__name__)

_VALID_RELATIONS = {r.value for r in RelationType}

# NodeType values the extractor may assign (Document is created by the service, not the LLM).
_EXTRACTABLE_NODE_TYPES = [
    NodeType.KEYWORD.value,
    NodeType.INQUIRY.value,
    NodeType.SUBJECT.value,
    NodeType.ACTIVITY.value,
    NodeType.PERIOD.value,
]

# Bounds applied to LLM output. Labels may be noun phrases ("삼투압 조절 원리"), so the
# ceiling is looser than the rule-based tokenizer's — but still blocks whole sentences.
_LABEL_MIN_LEN = 2
_LABEL_MAX_LEN = 30

# Per-request caps so one oversized PDF cannot fan out into unbounded LLM spend.
# 19쪽 표본이 (유형, 제목) 기준 48개 섹션이라 20개로는 창의적 체험활동이 통째로
# 잘렸다. 32개로 올리고 동시 실행을 6으로 늘려 왕복 횟수(≈5)는 예전과 같게 둔다.
# 한 생기부의 구획 수 상한. 32 였을 때 표본 48구획 중 **16개가 통째로 빠졌다** —
# 3학년 세특이 전부 여기서 잘렸고, 그래프에 없는 과목 12개로 나타났다.
# 구획 하나가 LLM 한 번이라 값이 클수록 느리고 비싸지만, 가져오기는 한 번뿐이다.
_MAX_SECTIONS = 80
_SECTION_CHAR_LIMIT = 4000
_LLM_CONCURRENCY = 6

_KEYWORD_SCHEMA = {
    "type": "object",
    "properties": {
        "keywords": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string"},
                    "node_type": {"type": "string", "enum": _EXTRACTABLE_NODE_TYPES},
                    "confidence": {"type": "number"},
                    "rationale": {"type": "string"},
                },
                "required": ["label", "node_type", "confidence", "rationale"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["keywords"],
    "additionalProperties": False,
}

_EXTRACT_SYSTEM = (
    "당신은 대한민국 고등학생 학교생활기록부(생기부) 온톨로지 분석 전문가입니다. "
    "생기부 텍스트에서 학생의 진로·탐구 활동을 대표하는 의미 있는 키워드만 선별합니다."
)

_TAXONOMY = (
    "각 키워드에 아래 기준으로 node_type 을 지정하세요.\n"
    "- Subject : 교과목명 그 자체만. (국어, 수학, 영어, 물리학, 생명과학, 한국사, 통합사회)\n"
    "            생물 종·일반 명사는 Subject 가 아닙니다. 예) '아메바' → Keyword\n"
    "- Inquiry : 학생이 수행한 탐구·연구·실험의 주제.\n"
    "            예) '삼투압 조절 원리 관찰', '합성함수 교환법칙 탐구'\n"
    "- Activity: 동아리·봉사·대회·프로젝트·발표·임원 등 활동.\n"
    "            예) '로봇 프로그래밍 동아리', '학급 회장', '설문 조사 프로젝트'\n"
    "- Period  : 학년·학기 등 기간 표현. 예) '2학년', '1학기'\n"
    "- Keyword : 위에 해당하지 않는 학문적 개념어. 예) '음운 변동', '기후변화', '재생에너지'\n"
)

_EXCLUSIONS = (
    "반드시 제외할 것:\n"
    "- 조사·어미가 붙은 서술어 조각. 예) '힘썼으며', '하였고', '보임', '키움', '수행함'\n"
    "- 행정·양식 용어. 예) 학교, 학년, 성명, 담임, 단위수, 석차등급, 특기사항, 해당없음, 비고\n"
    "- PDF 표가 붙어 깨진 문자열. 예) '질병미인정기타질병미인정기타'\n"
    "- 의미 없는 일반 동사·형용사, 잘린 영문 조각. 예) 'esis'\n"
    "- 학생 이름·학교명 등 개인 식별 정보\n"
)


# ── 가지치기 추천 (2단계) 상수 ─────────────────────────────────────────────────

# 1단계 출력 토큰 상한 — 추천 3개면 충분하다.
_PRUNING_MAX_TOKENS = 700
# 2단계 출력 토큰 상한.
_RESEARCH_MAX_TOKENS = 900

# 2단계 웹 도구 호출 상한.
_WEB_SEARCH_MAX_USES = 2
_WEB_FETCH_MAX_USES = 1
_WEB_FETCH_MAX_CONTENT_TOKENS = 4000

# 서버 도구 루프가 pause_turn 으로 끊겼을 때 이어받을 최대 횟수.
_MAX_PAUSE_RESUMES = 2

# 모델이 도구 버전을 거부할 때 낮춰볼 최대 단계 수.
_MAX_TOOL_DOWNGRADES = 3

# 신뢰 가능한 자료 도메인 — 프로젝트 과목 범위에 맞춰 여기서 관리한다.
TRUSTED_DOMAINS = [
    "go.kr",
    "re.kr",
    "ac.kr",
    "history.go.kr",
    "museum.go.kr",
    "kci.go.kr",
    "riss.kr",
]

# True 로 두면 위 도메인 밖은 아예 검색하지 않는다(allowed_domains 하드 제한).
# 기본값은 False — 프롬프트로 "우선 조회"만 지시해, 과목이 넓어져도 결과가 0건이 되지 않게 한다.
RESTRICT_TO_TRUSTED_DOMAINS = False

_PRUNING_SYSTEM = (
    "너는 고등학생의 탐구 활동 확장을 돕는 추천 AI다.\n\n"
    "제공된 학생 활동과 그래프 후보 안에서만 추천하라.\n"
    "학생이 하지 않은 활동을 이미 수행한 것처럼 표현하지 마라.\n"
    "추천은 심화, 융합, 활동 유형으로 각각 1개씩 생성하라.\n"
    "추상적인 표현보다 학생이 바로 수행할 수 있는 활동을 제시하라.\n"
    "짧고 구체적으로 작성하라."
)

_PRUNING_SCHEMA = {
    "type": "object",
    "properties": {
        "recommendations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "type": {
                        "type": "string",
                        "enum": [t.value for t in BRANCH_TYPE_ORDER],
                    },
                    "title": {"type": "string"},
                    "reason": {"type": "string"},
                    "activity": {"type": "string"},
                    "expectedOutput": {"type": "string"},
                    "relatedNodes": {"type": "array", "items": {"type": "string"}},
                    "needsWebResearch": {"type": "boolean"},
                },
                "required": [
                    "type",
                    "title",
                    "reason",
                    "activity",
                    "expectedOutput",
                    "relatedNodes",
                    "needsWebResearch",
                ],
                "additionalProperties": False,
            },
        }
    },
    "required": ["recommendations"],
    "additionalProperties": False,
}

_RESEARCH_SYSTEM = (
    "너는 고등학생의 탐구 자료 조사를 돕는 AI다.\n"
    "검색 결과는 생기부 문장을 대신 써주는 용도가 아니라, "
    "학생이 실제 탐구에 사용할 자료와 탐구 범위를 제시하는 용도로만 쓴다.\n"
    "원문을 길게 옮기지 말고, 반드시 유효한 JSON만 반환하라."
)


# 상한(TITLE_MAX 등)은 스키마상 최대치이고, 한국어는 토큰을 많이 먹어 상한을 다 쓰면
# 700 토큰을 넘긴다. 모델에는 넉넉히 들어가는 "권장 길이"를 따로 지시한다.
_TITLE_TARGET = 20
_REASON_TARGET = 55
_ACTIVITY_TARGET = 85
_EXPECTED_OUTPUT_TARGET = 20


def _salvage_recommendations(text: str) -> list[dict]:
    """max_tokens 로 잘린 JSON 에서 온전한 객체만 건져낸다."""
    items: list[dict] = []
    depth = 0
    start = -1
    in_string = False
    escaped = False
    for index, char in enumerate(text):
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            if depth == 0:
                start = index
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0 and start >= 0:
                try:
                    obj = json.loads(text[start : index + 1])
                except json.JSONDecodeError:
                    pass
                else:
                    if isinstance(obj, dict) and "type" in obj:
                        items.append(obj)
                start = -1
    return items


def _join_text(response: object) -> str:
    """응답에서 text 블록만 이어붙인다 (서버 도구 블록은 건너뛴다)."""
    parts = [
        block.text
        for block in (getattr(response, "content", None) or [])
        if getattr(block, "type", None) == "text" and getattr(block, "text", None)
    ]
    return "\n".join(parts)


def _clean_label(raw: object) -> str | None:
    """Normalize an LLM-provided label, or None if it is unusable."""
    if not isinstance(raw, str):
        return None
    label = " ".join(raw.split()).strip(" .,·:;-—()[]{}\"'“”")
    if not (_LABEL_MIN_LEN <= len(label) <= _LABEL_MAX_LEN):
        return None
    if not any(ch.isalnum() for ch in label):
        return None
    return label


def _clamp_confidence(raw: object) -> float:
    try:
        value = float(raw)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.7
    return min(1.0, max(0.0, value))


def _parse_json(text: str) -> dict:
    """Extract JSON object from Anthropic response text (handles markdown fences)."""
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


class AnthropicMLAdapter:
    def __init__(self, api_key: str, model: str = "claude-haiku-4-5-20251001") -> None:
        import anthropic  # noqa: PLC0415

        self._client = anthropic.AsyncAnthropic(api_key=api_key)
        self._model = model

    @property
    def model(self) -> str:
        """Model id, surfaced so callers can record which extractor produced a result."""
        return self._model

    # ── MLAdapter interface ───────────────────────────────────────────────────

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

        prompt = (
            f"다음 관심 키워드와 관련된 탐구·활동 주제를 {max_results}개 이내로 추천해주세요: "
            f"{', '.join(seeds)}\n\n"
            '반환 형식(JSON만 출력): {"suggestions": '
            '[{"label": "...", "confidence": 0.0-1.0, "rationale": "..."}]}'
        )
        try:
            resp = await self._client.messages.create(
                model=self._model,
                max_tokens=512,
                system="당신은 고등학생 생기부 설계 전문가입니다. 반드시 유효한 JSON만 반환하세요.",
                messages=[{"role": "user", "content": prompt}],
            )
            data = _parse_json(resp.content[0].text)
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
        del user_id
        extracted = await self.extract_document_keywords(
            sections=[("", text)],
            max_keywords=30,
        )
        return [(kw.label, kw.node_type) for kw in extracted]

    # ── 글쓰기 (양식·보고서) ──────────────────────────────────────────────

    async def write_prose(self, prompt: str, *, max_tokens: int = 2000) -> str:
        """근거를 주고 산문을 받는다. JSON 이 아니라 사람이 읽을 글이다."""
        resp = await self._client.messages.create(
            model=self._model,
            max_tokens=max_tokens,
            system=(
                "당신은 고등학생의 생활기록부 기록을 바탕으로 문서를 정리하는 조력자입니다. "
                "기록에 없는 사실을 지어내지 않는 것이 가장 중요한 원칙입니다. "
                "근거가 부족하면 부족하다고 적으세요."
            ),
            messages=[{"role": "user", "content": prompt}],
        )
        return "".join(b.text for b in resp.content if getattr(b, "text", "")).strip()

    # ── Document keyword extraction ───────────────────────────────────────────

    async def extract_document_keywords(
        self,
        *,
        sections: list[tuple[str, str]],
        max_keywords: int = 60,
        per_section: int = 12,
    ) -> list[ExtractedKeyword]:
        """Extract meaningful 생기부 keywords per section, deduped and ranked.

        Sections are processed concurrently; a section that fails is skipped rather
        than failing the whole import. Returns [] if nothing usable came back, which
        signals the caller to fall back to rule-based tokens.
        """
        usable = [(title, content) for title, content in sections if content and content.strip()]
        if not usable:
            return []
        usable = usable[:_MAX_SECTIONS]

        semaphore = asyncio.Semaphore(_LLM_CONCURRENCY)

        async def run(title: str, content: str) -> list[ExtractedKeyword]:
            async with semaphore:
                return await self._extract_section_keywords(title, content, per_section)

        results = await asyncio.gather(
            *(run(title, content) for title, content in usable),
            return_exceptions=True,
        )

        # 섹션마다 신뢰도 순으로 세워 두고, 섹션을 돌아가며 한 개씩 뽑는다.
        #
        # 예전에는 전체를 신뢰도로 한 줄 세워 앞에서 잘랐다. 그러면 조각이 많은
        # 영역(세특 40개)이 후보를 독차지해서, 조각이 적은 영역(자율·동아리·봉사·
        # 진로 각 1~2개)의 키워드가 한 개도 못 들어가는 일이 생긴다. 실제로 그래프에
        # 창의적 체험활동이 통째로 빠졌다. 돌아가며 뽑으면 모든 영역이 대표를 갖는다.
        buckets: list[list[ExtractedKeyword]] = []
        for result in results:
            if isinstance(result, BaseException):
                logger.warning("extract_document_keywords: section failed: %s", result)
                continue
            buckets.append(sorted(result, key=lambda k: (-(k.confidence or 0.0), k.label)))

        picked: list[ExtractedKeyword] = []
        seen: set[str] = set()
        while len(picked) < max_keywords:
            progressed = False
            for bucket in buckets:
                if len(picked) >= max_keywords:
                    break
                while bucket:
                    keyword = bucket.pop(0)
                    key = keyword.label.replace(" ", "").lower()
                    if key in seen:
                        continue
                    seen.add(key)
                    picked.append(keyword)
                    progressed = True
                    break
            if not progressed:
                break
        return picked

    async def _extract_section_keywords(
        self, title: str, content: str, limit: int
    ) -> list[ExtractedKeyword]:
        header = f"[섹션: {title}]\n" if title else ""
        prompt = (
            f"{header}{content[:_SECTION_CHAR_LIMIT]}\n\n"
            f"위 생기부 텍스트에서 의미 있는 키워드를 최대 {limit}개 추출하세요.\n\n"
            f"{_TAXONOMY}\n"
            f"{_EXCLUSIONS}\n"
            "label 은 원문 표현을 살린 2~30자 명사구로 쓰고, 중복은 금지합니다.\n"
            "confidence 는 0.0~1.0, rationale 은 40자 이내로 이 키워드를 고른 이유를 씁니다."
        )

        try:
            resp = await self._structured_call(prompt)
        except Exception as exc:
            logger.warning("extract_section_keywords LLM call failed (%s): %s", title, exc)
            return []

        data = _parse_json(resp)
        raw_items = data.get("keywords")
        if not isinstance(raw_items, list):
            return []

        out: list[ExtractedKeyword] = []
        for item in raw_items[:limit]:
            if not isinstance(item, dict):
                continue
            label = _clean_label(item.get("label"))
            if label is None:
                continue
            try:
                node_type = NodeType(item.get("node_type"))
            except ValueError:
                node_type = NodeType.KEYWORD
            if node_type is NodeType.DOCUMENT:
                node_type = NodeType.KEYWORD
            rationale = item.get("rationale")
            out.append(
                ExtractedKeyword(
                    label=label,
                    node_type=node_type,
                    confidence=_clamp_confidence(item.get("confidence")),
                    rationale=rationale.strip() if isinstance(rationale, str) else None,
                    section_title=title or None,
                    source="claude",
                )
            )
        return out

    async def _structured_call(self, prompt: str) -> str:
        """Call the model with a JSON schema, degrading to prompt-only JSON if rejected."""
        base = {
            "model": self._model,
            "max_tokens": 2048,
            "system": _EXTRACT_SYSTEM,
        }
        try:
            resp = await self._client.messages.create(
                **base,
                messages=[{"role": "user", "content": prompt}],
                output_config={"format": {"type": "json_schema", "schema": _KEYWORD_SCHEMA}},
            )
            return resp.content[0].text
        except Exception as exc:
            # Only retry when the schema parameter itself was rejected (old SDK / model);
            # rate limits and transport errors must not be silently doubled.
            if not isinstance(exc, TypeError) and "output_config" not in str(exc):
                raise
            logger.warning("structured output unavailable, falling back to prompt JSON: %s", exc)
            resp = await self._client.messages.create(
                **base,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                        + '\n\n반환 형식(JSON만 출력): {"keywords": [{"label": "...", '
                        '"node_type": "Keyword", "confidence": 0.9, "rationale": "..."}]}',
                    }
                ],
            )
            return resp.content[0].text

    # ── GraphAnalyzeAdapter interface ─────────────────────────────────────────

    async def infer_relationships(
        self,
        *,
        section_text: str,
        nodes: list[tuple[str, str, NodeType]],
        max_edges: int = 20,
    ) -> list[dict]:
        """Infer typed relationships between nodes from section text."""
        if not nodes or not section_text.strip():
            return []

        node_lines = "\n".join(f"- {label} ({ntype.value})" for _, label, ntype in nodes)
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
            '반환 형식(JSON만 출력): {"edges": [{"source_label": "...", "target_label": "...", '
            '"relation": "INFLUENCES", "confidence": 0.85}]}'
        )
        try:
            resp = await self._client.messages.create(
                model=self._model,
                max_tokens=1024,
                system=(
                    "당신은 학생 생기부 온톨로지 분석 전문가입니다. "
                    "반드시 유효한 JSON만 반환하세요."
                ),
                messages=[{"role": "user", "content": prompt}],
            )
            data = _parse_json(resp.content[0].text)
            edges = data.get("edges", [])
            for e in edges:
                if e.get("relation") not in _VALID_RELATIONS:
                    e["relation"] = "RELATES_TO"
            return edges[:max_edges]
        except Exception as exc:
            logger.warning("infer_relationships LLM call failed: %s", exc)
            return []

    # ── 가지치기 추천 1단계 (웹 도구 없음) ─────────────────────────────────────

    async def recommend_pruning(self, *, context: dict) -> tuple[list[dict], LLMUsage]:
        """온톨로지 컨텍스트만으로 심화/융합/활동 추천 3개를 만든다.

        `context` 는 서비스가 미리 추린 소량의 값만 담고 있다 (임베딩 벡터·전체
        그래프·생기부 원문은 들어오지 않는다). 여기서는 웹 도구를 등록하지 않는다.
        """
        prompt = self._pruning_prompt(context, terse=False)

        started = time.perf_counter()
        resp = await self._pruning_call(prompt)
        usage = usage_from_response("pruning", self._model, resp)

        items = self._pruning_items(resp)

        # 700 토큰 상한에 걸려 JSON 이 잘리면 3개를 못 채운다.
        # 상한은 유지한 채, 더 짧게 쓰라고 지시해 한 번만 다시 받는다.
        if len(items) < 3 and getattr(resp, "stop_reason", None) == "max_tokens":
            logger.info("가지치기 추천 응답이 700 토큰에서 잘림 — 더 짧게 재요청")
            retry = await self._pruning_call(self._pruning_prompt(context, terse=True))
            retry_items = self._pruning_items(retry)
            retry_usage = usage_from_response("pruning", self._model, retry)
            usage.input_tokens += retry_usage.input_tokens
            usage.output_tokens += retry_usage.output_tokens
            usage.cache_read_input_tokens += retry_usage.cache_read_input_tokens
            usage.cache_creation_input_tokens += retry_usage.cache_creation_input_tokens
            usage.extra["retried"] = True
            if len(retry_items) > len(items):
                items = retry_items

        usage.elapsed_ms = int((time.perf_counter() - started) * 1000)
        return items, usage

    def _pruning_prompt(self, context: dict, *, terse: bool) -> str:
        limits = (
            f"- 글자 수: title {_TITLE_TARGET}자, reason {_REASON_TARGET}자, "
            f"activity {_ACTIVITY_TARGET}자, expectedOutput {_EXPECTED_OUTPUT_TARGET}자 "
            "이내로 짧게. (각각 최대 "
            f"{TITLE_MAX}/{REASON_MAX}/{ACTIVITY_MAX}/{EXPECTED_OUTPUT_MAX}자를 넘기면 잘린다)\n"
        )
        if terse:
            limits = (
                "- 앞선 응답이 길이 제한을 넘겨 잘렸다. 이번에는 각 항목을 절반 길이로 쓴다.\n"
                f"- title {_TITLE_TARGET // 2}자, reason {_REASON_TARGET // 2}자, "
                f"activity {_ACTIVITY_TARGET // 2}자, "
                f"expectedOutput {_EXPECTED_OUTPUT_TARGET // 2}자 이내.\n"
            )
        return (
            "아래 학생 그래프 정보를 보고 다음 탐구 방향을 추천해줘.\n\n"
            f"{json.dumps(context, ensure_ascii=False)}\n\n"
            "규칙:\n"
            "- DEPTH(심화), FUSION(융합), ACTIVITY(활동) 각각 정확히 1개씩, 총 3개.\n"
            "- relatedNodes 는 위 neighborNodes/candidateNodes 안에서만 고르고 최대 "
            f"{RELATED_NODES_MAX}개. 해당 없으면 빈 배열.\n"
            + limits
            + "- ACTIVITY 유형은 학생이 바로 수행 가능한 활동이므로 needsWebResearch 는 false.\n"
            "- DEPTH, FUSION 은 외부 자료가 도움이 되면 needsWebResearch 를 true 로."
        )

    async def _pruning_call(self, prompt: str):
        return await self._client.messages.create(
            model=self._model,
            max_tokens=_PRUNING_MAX_TOKENS,
            system=_PRUNING_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
            output_config={"format": {"type": "json_schema", "schema": _PRUNING_SCHEMA}},
        )

    @staticmethod
    def _pruning_items(resp: object) -> list[dict]:
        text = _join_text(resp)
        items = _parse_json(text).get("recommendations")
        if isinstance(items, list) and items:
            return items
        # 잘린 응답이라도 온전한 객체는 살려 쓴다.
        return _salvage_recommendations(text)

    # ── 가지치기 추천 2단계 (웹 검색 — 이 요청에만 도구를 등록) ─────────────────

    async def find_research_sources(
        self,
        *,
        grade: str,
        topic: str,
        activity: str,
        subjects: list[str],
    ) -> tuple[dict, LLMUsage]:
        """학생이 '관련 자료 찾기'를 눌렀을 때만 호출된다."""
        tools = self._web_tools()
        if not tools:
            raise RuntimeError("설치된 anthropic SDK 에서 웹 도구를 찾지 못했습니다")

        subject_line = ", ".join(subjects[:4]) or "미지정"
        prompt = (
            f"학년: {grade}\n"
            f"관련 교과: {subject_line}\n"
            f"탐구 주제: {topic}\n"
            f"계획한 활동: {activity}\n\n"
            "이 탐구에 실제로 쓸 수 있는 자료를 찾아줘.\n"
            f"- 다음 도메인을 우선 조회해: {', '.join(TRUSTED_DOMAINS)}\n"
            f"- web_search 는 최대 {_WEB_SEARCH_MAX_USES}회, "
            f"web_fetch 는 최대 {_WEB_FETCH_MAX_USES}회만 사용해.\n"
            "- 검색 결과 요약만으로 충분하면 web_fetch 는 아예 쓰지 마.\n"
            "- 같은 URL 을 두 번 읽지 마.\n"
            f"- 참고자료는 최대 {SOURCES_MAX}개, 각 reason 은 한 문장.\n"
            "- 본문이나 원문을 그대로 옮기지 마. 무엇을 확인할 수 있는지만 적어.\n"
            "- 생기부 문장을 대신 써주지 마. 탐구 범위와 자료만 제시해.\n\n"
            "반환 형식(JSON만 출력):\n"
            '{"refinedTopic": "...", "researchQuestions": ["...", "..."], '
            '"method": "...", "sources": [{"title": "...", "url": "https://...", '
            '"reason": "..."}]}'
        )

        started = time.perf_counter()
        resp = await self._web_call(prompt, tools)
        usage = usage_from_response("research", self._model, resp)
        usage.elapsed_ms = int((time.perf_counter() - started) * 1000)

        return _parse_json(_join_text(resp)), usage

    def _web_tools(self) -> list[dict]:
        return build_web_tools(
            self._model,
            search_max_uses=_WEB_SEARCH_MAX_USES,
            fetch_max_uses=_WEB_FETCH_MAX_USES,
            fetch_max_content_tokens=_WEB_FETCH_MAX_CONTENT_TOKENS,
            allowed_domains=TRUSTED_DOMAINS if RESTRICT_TO_TRUSTED_DOMAINS else None,
        )

    async def _web_call(self, prompt: str, tools: list[dict]):
        """웹 도구 요청.

        모델이 도구 버전을 거부하면 한 단계씩 낮춰가며 재시도한다. 최신 변형은
        내부적으로 code execution 을 쓰기 때문에 Haiku 급 모델에서는 두 단계를
        내려가야 하는 경우가 있어, 한 번이 아니라 후보가 떨어질 때까지 시도한다.
        선택 결과는 모듈 전역에 남으므로 다음 요청부터는 바로 맞는 버전으로 간다.
        """
        resp = None
        last_exc: Exception | None = None
        for _ in range(_MAX_TOOL_DOWNGRADES + 1):
            try:
                resp = await self._client.messages.create(
                    model=self._model,
                    max_tokens=_RESEARCH_MAX_TOKENS,
                    system=_RESEARCH_SYSTEM,
                    messages=[{"role": "user", "content": prompt}],
                    tools=tools,
                )
                break
            except Exception as exc:
                last_exc = exc
                if not downgrade_web_tools(self._model, str(exc)):
                    raise
                tools = self._web_tools()
        if resp is None:
            raise last_exc if last_exc else RuntimeError("웹 도구 요청에 실패했습니다")

        # 서버 도구 루프가 길어지면 pause_turn 으로 끊긴다 — 이어받되 횟수를 제한한다.
        messages: list[dict] = [{"role": "user", "content": prompt}]
        for _ in range(_MAX_PAUSE_RESUMES):
            if getattr(resp, "stop_reason", None) != "pause_turn":
                break
            messages.append({"role": "assistant", "content": resp.content})
            resp = await self._client.messages.create(
                model=self._model,
                max_tokens=_RESEARCH_MAX_TOKENS,
                system=_RESEARCH_SYSTEM,
                messages=messages,
                tools=tools,
            )
        return resp
