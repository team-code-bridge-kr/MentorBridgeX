from app.schemas.graph import GraphSnapshot, NodeType
from app.schemas.pruning import BranchType
from app.schemas.recommendations import SuggestedKeyword
from app.services.llm_usage import LLMUsage

_BRANCH_MAP: dict[str, list[tuple[str, float, str]]] = {
    "양자컴퓨팅": [
        ("큐비트", 0.92, "양자컴퓨팅의 기본 단위"),
        ("양자 알고리즘", 0.88, "계산 모델 확장"),
        ("쇼어 알고리즘", 0.81, "암호학 연계"),
        ("암호학", 0.75, "응용 분야"),
    ],
    "환경공학": [
        ("탄소중립", 0.9, "기후 대응"),
        ("수질 관리", 0.84, "환경 인프라"),
        ("생태계 복원", 0.8, "현장 적용"),
    ],
}

_DEFAULT_SUGGESTIONS = [
    ("탐구 설계", 0.7, "활동 구조화"),
    ("데이터 분석", 0.68, "정량적 근거"),
    ("발표 및 토론", 0.65, "의사소통 역량"),
]


class MockMLAdapter:
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
        seen: set[str] = set()
        out: list[SuggestedKeyword] = []

        seed_text = " ".join(seeds).strip()
        for seed in seeds:
            for label, conf, rationale in _BRANCH_MAP.get(seed, []):
                if label in seen:
                    continue
                seen.add(label)
                out.append(
                    SuggestedKeyword(label=label, confidence=conf, rationale=rationale)
                )

        if not out and seed_text:
            for label, conf, rationale in _DEFAULT_SUGGESTIONS:
                if label in seen:
                    continue
                seen.add(label)
                out.append(
                    SuggestedKeyword(label=label, confidence=conf, rationale=rationale)
                )

        return out[:max_results]

    async def extract_keywords_from_text(
        self,
        *,
        user_id: str,
        text: str,
    ) -> list[tuple[str, NodeType]]:
        del user_id
        keywords = []
        for token in ["탐구", "실험", "발표", "분석", "프로젝트"]:
            if token in text:
                keywords.append((token, NodeType.KEYWORD))
        if not keywords:
            keywords.append(("핵심 활동", NodeType.KEYWORD))
        return keywords

    # ── 가지치기 추천 ─────────────────────────────────────────────────────────

    @property
    def model(self) -> str:
        return "mock"

    async def recommend_pruning(self, *, context: dict) -> tuple[list[dict], LLMUsage]:
        """Claude 없이도 3개 구조가 유지되도록 하는 결정적 스텁."""
        title = str(context.get("selectedNode", {}).get("title", "선택한 주제"))
        candidates = [str(c) for c in context.get("candidateNodes", [])][:2]
        neighbors = [str(n) for n in context.get("neighborNodes", [])][:2]
        related = candidates or neighbors

        items = [
            {
                "type": BranchType.DEPTH.value,
                "title": f"{title} 심화 자료 비교"[:35],
                "reason": "기존 활동을 자료 비교로 한 단계 깊게 확장할 수 있습니다.",
                "activity": "같은 주제를 다룬 자료 2개를 비교하고 관점 차이를 표로 정리합니다.",
                "expectedOutput": "비교 탐구 보고서",
                "relatedNodes": related[:3],
                "needsWebResearch": True,
            },
            {
                "type": BranchType.FUSION.value,
                "title": f"{title} 교과 융합 탐구"[:35],
                "reason": "다른 교과의 개념을 붙이면 탐구 범위를 넓힐 수 있습니다.",
                "activity": "관련 교과 개념 1개를 골라 주제와 연결되는 지점을 정리합니다.",
                "expectedOutput": "융합 탐구 개요서",
                "relatedNodes": related[:3],
                "needsWebResearch": True,
            },
            {
                "type": BranchType.ACTIVITY.value,
                "title": f"{title} 발표·토론 확장"[:35],
                "reason": "정리한 내용을 실제 활동으로 옮기면 근거가 남습니다.",
                "activity": "탐구 결과를 5분 발표로 구성하고 반론 1개를 준비합니다.",
                "expectedOutput": "발표 자료와 토론 메모",
                "relatedNodes": related[:3],
                "needsWebResearch": False,
            },
        ]
        return items, LLMUsage(stage="pruning", model="mock")

    async def find_research_sources(
        self,
        *,
        grade: str,
        topic: str,
        activity: str,
        subjects: list[str],
    ) -> tuple[dict, LLMUsage]:
        del grade, activity, subjects
        return (
            {
                "refinedTopic": topic[:120],
                "researchQuestions": [
                    f"{topic} 의 핵심 쟁점은 무엇인가?",
                    f"{topic} 을 뒷받침할 자료는 어디서 확인할 수 있는가?",
                ],
                "method": "자료를 모아 공통점과 차이점을 표로 정리합니다.",
                "sources": [],
            },
            LLMUsage(stage="research", model="mock"),
        )
