"""가지치기 추천 (2단계) 스키마.

1단계: 온톨로지 기반 탐구 방향 추천 3개 — 웹 도구를 쓰지 않는다.
2단계: 학생이 특정 추천의 '관련 자료 찾기'를 눌렀을 때만 웹 검색을 실행한다.

JSON 은 프런트엔드 규격에 맞춰 camelCase 로 직렬화하고, 파이썬 쪽은
프로젝트 관례대로 snake_case 를 유지한다 (FastAPI 는 기본적으로 alias 로 직렬화).
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

# 각 필드 상한 — 프롬프트로 지시하고, 모델이 넘기면 서버에서 잘라낸다.
# (Structured Outputs 의 JSON Schema 는 maxLength/maxItems 를 지원하지 않는다.)
TITLE_MAX = 35
REASON_MAX = 100
ACTIVITY_MAX = 150
EXPECTED_OUTPUT_MAX = 50
RELATED_NODES_MAX = 3

# 2단계 참고자료 상한.
SOURCES_MAX = 3
RESEARCH_QUESTIONS_MAX = 4


class BranchType(StrEnum):
    """추천 유형 — 심화 / 융합 / 활동 각각 1개씩."""

    DEPTH = "DEPTH"
    FUSION = "FUSION"
    ACTIVITY = "ACTIVITY"


BRANCH_TYPE_ORDER: tuple[BranchType, ...] = (
    BranchType.DEPTH,
    BranchType.FUSION,
    BranchType.ACTIVITY,
)


class _CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class PruningRecommendation(_CamelModel):
    """추천 카드 1개."""

    id: str
    type: BranchType
    title: str = Field(max_length=TITLE_MAX)
    reason: str = Field(max_length=REASON_MAX)
    activity: str = Field(max_length=ACTIVITY_MAX)
    expected_output: str = Field(
        default="", max_length=EXPECTED_OUTPUT_MAX, serialization_alias="expectedOutput"
    )
    related_nodes: list[str] = Field(default_factory=list, serialization_alias="relatedNodes")
    needs_web_research: bool = Field(default=False, serialization_alias="needsWebResearch")


class PruningRequest(BaseModel):
    node_id: str = Field(..., min_length=1, max_length=64)
    # 학년은 사용자 레코드에 없다. 클라이언트가 주면 쓰고, 없으면 그래프의 Period 노드로 추정한다.
    grade: str | None = Field(default=None, max_length=32)


class PruningResponse(_CamelModel):
    node_id: str = Field(serialization_alias="nodeId")
    recommendations: list[PruningRecommendation]
    cached: bool = False
    # 추천을 만든 주체 ("claude:<model>" 또는 "rule_fallback") — 디버깅용.
    generator: str = ""


class ResearchSource(_CamelModel):
    title: str = Field(max_length=120)
    url: str = Field(max_length=500)
    reason: str = Field(max_length=200)


class ResearchRequest(BaseModel):
    node_id: str = Field(..., min_length=1, max_length=64)
    grade: str | None = Field(default=None, max_length=32)


class ResearchResponse(_CamelModel):
    recommendation_id: str = Field(serialization_alias="recommendationId")
    refined_topic: str = Field(default="", max_length=120, serialization_alias="refinedTopic")
    research_questions: list[str] = Field(
        default_factory=list, serialization_alias="researchQuestions"
    )
    method: str = Field(default="", max_length=300)
    sources: list[ResearchSource] = Field(default_factory=list)
    cached: bool = False


class ExpandRequest(BaseModel):
    node_id: str = Field(..., min_length=1, max_length=64)
    grade: str | None = Field(default=None, max_length=32)
