from app.adapters.protocols import MLAdapter
from app.schemas.graph import GraphSnapshot, NodeType
from app.schemas.recommendations import SuggestedKeyword

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
