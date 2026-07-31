"""가지치기 추천의 완료 조건을 코드로 고정한다.

- 1단계 요청에는 web_search / web_fetch 가 등록되지 않는다.
- 임베딩 벡터·전체 그래프가 Claude 요청 본문에 실리지 않는다.
- 추천은 정확히 3개만 반환된다.
- 웹 검색은 2단계에서만 실행되고, 호출 상한이 지켜진다.
- 동일 요청은 캐시에서 반환된다.
"""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from app.adapters.ml_real import AnthropicMLAdapter
from app.schemas.pruning import BranchType, PruningRecommendation
from app.services.pruning_service import (
    MAX_ACTIVITIES,
    MAX_CANDIDATES,
    MAX_NEIGHBORS,
    MAX_SUBJECTS,
    PruningService,
)


def _block(text: str) -> SimpleNamespace:
    return SimpleNamespace(type="text", text=text)


def _response(payload: dict, *, stop_reason: str = "end_turn") -> SimpleNamespace:
    return SimpleNamespace(
        content=[_block(json.dumps(payload, ensure_ascii=False))],
        stop_reason=stop_reason,
        usage=SimpleNamespace(
            input_tokens=100,
            output_tokens=200,
            cache_read_input_tokens=0,
            cache_creation_input_tokens=0,
        ),
    )


_THREE = {
    "recommendations": [
        {
            "type": "DEPTH",
            "title": "사료 비교",
            "reason": "심화",
            "activity": "사료 2개 비교",
            "expectedOutput": "보고서",
            "relatedNodes": ["사료 분석"],
            "needsWebResearch": True,
        },
        {
            "type": "FUSION",
            "title": "문학 연계",
            "reason": "융합",
            "activity": "문학 텍스트 연결",
            "expectedOutput": "개요서",
            "relatedNodes": ["관점 비교"],
            "needsWebResearch": True,
        },
        {
            "type": "ACTIVITY",
            "title": "토론 준비",
            "reason": "활동",
            "activity": "5분 발표 구성",
            "expectedOutput": "발표 자료",
            "relatedNodes": [],
            "needsWebResearch": True,
        },
    ]
}


class _RecordingClient:
    """messages.create 호출 인자를 그대로 붙잡아 두는 스텁."""

    def __init__(self, responses: list[SimpleNamespace]) -> None:
        self.calls: list[dict] = []
        self._responses = responses
        self.messages = SimpleNamespace(create=self._create)

    async def _create(self, **kwargs):
        self.calls.append(kwargs)
        return self._responses[min(len(self.calls) - 1, len(self._responses) - 1)]


def _adapter(responses: list[SimpleNamespace]) -> tuple[AnthropicMLAdapter, _RecordingClient]:
    adapter = AnthropicMLAdapter.__new__(AnthropicMLAdapter)  # __init__ 은 SDK 를 부른다
    client = _RecordingClient(responses)
    adapter._client = client
    adapter._model = "claude-haiku-4-5-20251001"
    return adapter, client


_CONTEXT = {
    "grade": "고등학교 1학년",
    "selectedNode": {"id": "n1", "title": "한국사 사료 분석", "type": "Keyword"},
    "neighborNodes": ["한국사", "토론"],
    "candidateNodes": ["사료 분석", "관점 비교"],
    "existingActivities": ["역사 토론 활동"],
    "relatedSubjects": ["한국사"],
}


@pytest.mark.asyncio
async def test_stage1_registers_no_web_tools() -> None:
    """일반 추천 요청에는 웹 도구가 등록되지 않는다."""
    adapter, client = _adapter([_response(_THREE)])
    await adapter.recommend_pruning(context=_CONTEXT)

    assert len(client.calls) == 1
    assert "tools" not in client.calls[0]


@pytest.mark.asyncio
async def test_stage1_output_token_cap() -> None:
    """출력 토큰 상한은 700 이하로 유지한다."""
    adapter, client = _adapter([_response(_THREE)])
    await adapter.recommend_pruning(context=_CONTEXT)

    assert client.calls[0]["max_tokens"] <= 700


@pytest.mark.asyncio
async def test_stage1_prompt_carries_no_vectors_or_full_graph() -> None:
    """임베딩 벡터·전체 그래프·원문이 요청 본문에 실리지 않는다."""
    adapter, client = _adapter([_response(_THREE)])
    await adapter.recommend_pruning(context=_CONTEXT)

    body = json.dumps(client.calls[0], ensure_ascii=False)
    for banned in ("embedding", "vector", "edges", "external_refs", "description"):
        assert banned not in body

    # 컨텍스트에 들어간 키는 화이트리스트 그대로여야 한다.
    prompt = client.calls[0]["messages"][0]["content"]
    payload = json.loads(prompt[prompt.index("{") : prompt.rindex("}") + 1])
    assert set(payload) == {
        "grade",
        "selectedNode",
        "neighborNodes",
        "candidateNodes",
        "existingActivities",
        "relatedSubjects",
    }


@pytest.mark.asyncio
async def test_stage2_registers_web_tools_with_caps() -> None:
    """2단계에만 web_search / web_fetch 가 붙고, 호출 상한이 지켜진다."""
    adapter, client = _adapter(
        [_response({"refinedTopic": "t", "researchQuestions": [], "method": "m", "sources": []})]
    )
    await adapter.find_research_sources(
        grade="고등학교 1학년", topic="사료 비교", activity="비교", subjects=["한국사"]
    )

    tools = {t["name"]: t for t in client.calls[0]["tools"]}
    assert set(tools) == {"web_search", "web_fetch"}
    assert tools["web_search"]["max_uses"] == 2
    assert tools["web_fetch"]["max_uses"] == 1
    assert tools["web_fetch"]["max_content_tokens"] <= 4000
    assert client.calls[0]["max_tokens"] <= 900

    # 도구 type 문자열은 설치된 SDK 가 export 하는 값이어야 한다.
    import anthropic.types as anthropic_types

    assert hasattr(anthropic_types, "WebSearchTool20250305Param")
    for tool in tools.values():
        assert tool["type"].startswith(("web_search_", "web_fetch_"))


def test_normalize_returns_exactly_three() -> None:
    """모델이 더 많이/적게 줘도 심화·융합·활동 각 1개씩만 남는다."""
    service = PruningService.__new__(PruningService)
    noisy = list(_THREE["recommendations"]) + [
        dict(_THREE["recommendations"][0], title="중복 심화"),
        {"type": "UNKNOWN", "title": "무시", "reason": "", "activity": ""},
    ]
    out = service._normalize(noisy, {"사료 분석", "관점 비교"}, "k")

    assert len(out) == 3
    assert [r.type for r in out] == [BranchType.DEPTH, BranchType.FUSION, BranchType.ACTIVITY]
    # 첫 항목이 유지되고 중복은 버려진다.
    assert out[0].title == "사료 비교"


def test_normalize_filters_related_nodes_and_activity_flag() -> None:
    """relatedNodes 는 제공한 후보 안에서만, ACTIVITY 는 웹 조사 대상이 아니다."""
    service = PruningService.__new__(PruningService)
    out = service._normalize(_THREE["recommendations"], {"사료 분석"}, "k")

    by_type = {r.type: r for r in out}
    assert by_type[BranchType.DEPTH].related_nodes == ["사료 분석"]
    assert by_type[BranchType.FUSION].related_nodes == []  # 후보 밖이라 제거
    assert by_type[BranchType.ACTIVITY].needs_web_research is False


def test_context_caps_are_within_spec() -> None:
    """Claude 로 보내는 항목 수 상한이 규격대로다."""
    assert MAX_NEIGHBORS == 8
    assert MAX_CANDIDATES == 6
    assert MAX_ACTIVITIES == 5
    assert MAX_SUBJECTS == 4


def test_recommendation_field_lengths_are_enforced() -> None:
    """길이 상한을 넘기면 스키마가 거부한다."""
    with pytest.raises(ValueError):
        PruningRecommendation(
            id="r",
            type=BranchType.DEPTH,
            title="가" * 36,
            reason="",
            activity="",
        )
