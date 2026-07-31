"""가지치기 추천 서비스.

핵심 원칙 — Claude 에는 서버가 미리 추린 소량의 값만 보낸다.

보내는 것: 학년, 선택 노드(제목/유형), 이웃 노드 최대 8, 확장 후보 최대 6,
           기존 활동 요약 최대 5, 관련 교과 최대 4.
보내지 않는 것: 임베딩 벡터, 전체 그래프, 전체 노드 목록, 생기부 원문,
           이름·학교명 등 개인정보, 이전 대화 기록, UI 상태, Neo4j 원본 응답.

임베딩은 확장 후보를 고르는 데만 서버 내부에서 쓰고 요청 본문에는 넣지 않는다.
"""

from __future__ import annotations

import hashlib
import json
import logging
import time

from app.adapters.factory import get_ml_adapter
from app.config import get_settings
from app.db.factory import get_graph_store
from app.db.redis_client import get_redis
from app.schemas.graph import GraphNode, GraphSnapshot, NodeType, RelationType
from app.schemas.pruning import (
    ACTIVITY_MAX,
    BRANCH_TYPE_ORDER,
    EXPECTED_OUTPUT_MAX,
    REASON_MAX,
    RELATED_NODES_MAX,
    RESEARCH_QUESTIONS_MAX,
    SOURCES_MAX,
    TITLE_MAX,
    BranchType,
    PruningRecommendation,
    ResearchResponse,
    ResearchSource,
)
from app.services.embedding_index_service import EmbeddingIndexService
from app.services.llm_usage import log_cache_hit, log_usage

logger = logging.getLogger(__name__)

# 프롬프트를 바꾸면 이 값을 올린다 — 캐시 키에 들어가서 옛 결과를 자동으로 무효화한다.
PROMPT_VERSION = "v1"

# Claude 로 넘기는 컨텍스트 상한.
MAX_NEIGHBORS = 8
MAX_CANDIDATES = 6
MAX_ACTIVITIES = 5
MAX_SUBJECTS = 4

# 후보를 뽑을 때 임베딩 검색에서 가져올 넉넉한 개수 (이웃·자기 자신을 걸러낸 뒤 잘라 쓴다).
_EMBEDDING_TOP_K = 24

# 활동 요약으로 볼 노드 유형.
_ACTIVITY_TYPES = (NodeType.ACTIVITY, NodeType.INQUIRY)

_GRADE_FALLBACK = "고등학생"


class PruningError(Exception):
    """라우터가 그대로 HTTP 응답으로 바꿔 내보내는 오류."""

    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


def _sha(*parts: str) -> str:
    # 구분자를 넣어야 ["ab","c"] 와 ["a","bc"] 가 같은 키로 뭉개지지 않는다.
    digest = hashlib.sha256("\x1f".join(parts).encode("utf-8"))
    return digest.hexdigest()[:16]


def _graph_revision(snapshot: GraphSnapshot) -> str:
    """그래프 상태 지문. 노드/엣지가 바뀌거나 갱신되면 값이 달라진다."""
    latest = max((n.updated_at for n in snapshot.nodes), default=None)
    return _sha(
        str(len(snapshot.nodes)),
        str(len(snapshot.edges)),
        latest.isoformat() if latest else "-",
    )


def _clip(value: object, limit: int) -> str:
    text = " ".join(str(value or "").split())
    return text[:limit]


class PruningService:
    def __init__(self) -> None:
        self.graph = get_graph_store()
        self.ml = get_ml_adapter()
        self.embeddings = EmbeddingIndexService()
        self.settings = get_settings()

    # ── 캐시 ──────────────────────────────────────────────────────────────────

    async def _cache_get(self, key: str) -> dict | None:
        try:
            client = await get_redis()
            raw = await client.get(key)
        except Exception as exc:  # Redis 가 죽어도 추천 자체는 되어야 한다.
            logger.debug("추천 캐시 조회 실패: %s", exc)
            return None
        if not raw:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return None

    async def _cache_set(self, key: str, payload: dict, ttl: int) -> None:
        try:
            client = await get_redis()
            await client.set(key, json.dumps(payload, ensure_ascii=False), ex=ttl)
        except Exception as exc:
            logger.debug("추천 캐시 저장 실패: %s", exc)

    # ── 컨텍스트 구성 (여기서 Claude 로 갈 데이터를 전부 결정한다) ──────────────

    def _infer_grade(self, snapshot: GraphSnapshot, given: str | None) -> str:
        if given:
            return _clip(given, 32)
        periods = [n.label for n in snapshot.nodes if n.type == NodeType.PERIOD]
        if periods:
            # "2학년" 같은 라벨을 그대로 쓴다. 사용자 레코드에 학년 필드가 없다.
            return _clip(f"고등학교 {sorted(periods)[-1]}", 32)
        return _GRADE_FALLBACK

    def _neighbors(self, snapshot: GraphSnapshot, node_id: str) -> list[GraphNode]:
        by_id = {n.id: n for n in snapshot.nodes}
        degree: dict[str, int] = {}
        for edge in snapshot.edges:
            degree[edge.source_id] = degree.get(edge.source_id, 0) + 1
            degree[edge.target_id] = degree.get(edge.target_id, 0) + 1

        neighbor_ids: list[str] = []
        for edge in snapshot.edges:
            if edge.source_id == node_id:
                neighbor_ids.append(edge.target_id)
            elif edge.target_id == node_id:
                neighbor_ids.append(edge.source_id)

        seen: set[str] = set()
        neighbors: list[GraphNode] = []
        for nid in neighbor_ids:
            if nid in seen or nid == node_id or nid not in by_id:
                continue
            seen.add(nid)
            neighbors.append(by_id[nid])

        # 연결이 많은 노드가 그 주제를 더 잘 대표한다.
        neighbors.sort(key=lambda n: degree.get(n.id, 0), reverse=True)
        return neighbors[:MAX_NEIGHBORS]

    async def _candidates(
        self, user_id: str, node: GraphNode, exclude: set[str]
    ) -> list[str]:
        """임베딩 유사도로 확장 후보를 서버에서 미리 계산한다.

        벡터 자체는 여기서만 쓰이고 밖으로 나가지 않는다 — 라벨만 반환한다.
        """
        hits = await self.embeddings.search(user_id, node.label, top_k=_EMBEDDING_TOP_K)
        labels: list[str] = []
        seen: set[str] = set()
        for candidate, _score in hits:
            if candidate.id in exclude or candidate.type == NodeType.DOCUMENT:
                continue
            label = candidate.label.strip()
            if not label or label in seen:
                continue
            seen.add(label)
            labels.append(label)
            if len(labels) >= MAX_CANDIDATES:
                break
        return labels

    async def build_context(
        self, user_id: str, node_id: str, grade: str | None
    ) -> tuple[dict, GraphSnapshot, GraphNode]:
        snapshot = await self.graph.get_snapshot(user_id)
        node = next((n for n in snapshot.nodes if n.id == node_id), None)
        if node is None:
            raise PruningError("선택한 노드를 찾을 수 없습니다", status_code=404)

        neighbors = self._neighbors(snapshot, node_id)
        exclude = {node.id} | {n.id for n in neighbors}
        candidates = await self._candidates(user_id, node, exclude)

        neighbor_labels = [n.label for n in neighbors]
        activities = [
            n.label
            for n in snapshot.nodes
            if n.type in _ACTIVITY_TYPES and n.id != node.id
        ][:MAX_ACTIVITIES]
        subjects = [n.label for n in snapshot.nodes if n.type == NodeType.SUBJECT][
            :MAX_SUBJECTS
        ]

        context = {
            "grade": self._infer_grade(snapshot, grade),
            "selectedNode": {
                "id": node.id,
                "title": node.label,
                "type": node.type.value,
            },
            "neighborNodes": neighbor_labels,
            "candidateNodes": candidates,
            "existingActivities": activities,
            "relatedSubjects": subjects,
        }
        return context, snapshot, node

    # ── 1단계: 추천 ───────────────────────────────────────────────────────────

    def _cache_key(self, user_id: str, node_id: str, context: dict, revision: str) -> str:
        activities_hash = _sha(*context["existingActivities"])
        return (
            "mbx:pruning:"
            + _sha(user_id, node_id, revision, activities_hash, PROMPT_VERSION)
        )

    def _normalize(
        self, raw_items: list[dict], allowed: set[str], key: str
    ) -> list[PruningRecommendation]:
        """모델 출력을 정확히 3개(심화/융합/활동)로 맞추고 길이를 강제한다."""
        by_type: dict[BranchType, dict] = {}
        for item in raw_items:
            if not isinstance(item, dict):
                continue
            try:
                branch = BranchType(str(item.get("type", "")).upper())
            except ValueError:
                continue
            by_type.setdefault(branch, item)

        out: list[PruningRecommendation] = []
        for index, branch in enumerate(BRANCH_TYPE_ORDER):
            item = by_type.get(branch)
            if item is None:
                continue
            related = [
                str(label)
                for label in (item.get("relatedNodes") or [])
                if str(label) in allowed
            ][:RELATED_NODES_MAX]
            out.append(
                PruningRecommendation(
                    id=f"rec_{key}_{index}",
                    type=branch,
                    title=_clip(item.get("title"), TITLE_MAX),
                    reason=_clip(item.get("reason"), REASON_MAX),
                    activity=_clip(item.get("activity"), ACTIVITY_MAX),
                    expected_output=_clip(item.get("expectedOutput"), EXPECTED_OUTPUT_MAX),
                    related_nodes=related,
                    needs_web_research=bool(item.get("needsWebResearch", False))
                    and branch is not BranchType.ACTIVITY,
                )
            )
        return out

    async def recommend(
        self, user_id: str, *, node_id: str, grade: str | None
    ) -> tuple[list[PruningRecommendation], bool, str]:
        started = time.perf_counter()
        context, snapshot, _node = await self.build_context(user_id, node_id, grade)
        revision = _graph_revision(snapshot)
        cache_key = self._cache_key(user_id, node_id, context, revision)

        cached = await self._cache_get(cache_key)
        if cached:
            log_cache_hit(
                "pruning",
                str(cached.get("generator", "")),
                int((time.perf_counter() - started) * 1000),
                count=len(cached.get("recommendations", [])),
            )
            items = [PruningRecommendation(**r) for r in cached["recommendations"]]
            return items, True, str(cached.get("generator", ""))

        allowed = set(context["neighborNodes"]) | set(context["candidateNodes"])
        key = cache_key.rsplit(":", 1)[-1]

        try:
            raw_items, usage = await self.ml.recommend_pruning(context=context)
        except Exception as exc:
            logger.warning("가지치기 추천 LLM 호출 실패: %s", exc)
            raise PruningError("추천 생성에 실패했습니다. 잠시 후 다시 시도해 주세요") from exc

        usage.extra["count"] = len(raw_items)
        log_usage(usage)

        recommendations = self._normalize(raw_items, allowed, key)
        if not recommendations:
            raise PruningError("추천을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요")

        generator = f"claude:{getattr(self.ml, 'model', 'unknown')}"
        ttl = self.settings.pruning_cache_ttl_seconds
        await self._cache_set(
            cache_key,
            {
                "generator": generator,
                "recommendations": [r.model_dump() for r in recommendations],
            },
            ttl,
        )
        # 2단계·확장이 id 만으로 찾을 수 있게 단건도 함께 저장한다.
        for rec in recommendations:
            await self._cache_set(
                self._rec_key(user_id, rec.id),
                {
                    "recommendation": rec.model_dump(),
                    "grade": context["grade"],
                    "relatedSubjects": context["relatedSubjects"],
                },
                ttl,
            )
        return recommendations, False, generator

    def _rec_key(self, user_id: str, recommendation_id: str) -> str:
        return "mbx:pruning:rec:" + _sha(user_id, recommendation_id)

    async def _find_recommendation(
        self, user_id: str, node_id: str, grade: str | None, recommendation_id: str
    ) -> tuple[PruningRecommendation, dict]:
        """추천 1건을 id 로 되찾는다.

        추천 단건을 따로 캐시해 두고 먼저 조회한다. 그래야 '이 주제로 확장'으로
        그래프가 바뀐 뒤에도 화면에 떠 있는 카드의 '관련 자료 찾기'가 계속 동작하고,
        2단계 요청마다 1단계를 다시 부르는 낭비도 없앤다.
        """
        cached = await self._cache_get(self._rec_key(user_id, recommendation_id))
        if cached:
            return (
                PruningRecommendation(**cached["recommendation"]),
                {
                    "grade": cached.get("grade", _GRADE_FALLBACK),
                    "relatedSubjects": cached.get("relatedSubjects", []),
                },
            )

        # 캐시가 만료됐으면 1단계를 다시 만들어 같은 id 를 찾아본다.
        recommendations, _cached, _gen = await self.recommend(
            user_id, node_id=node_id, grade=grade
        )
        match = next((r for r in recommendations if r.id == recommendation_id), None)
        if match is None:
            raise PruningError(
                "추천이 만료되었습니다. '다시 추천'을 눌러 새로 생성해 주세요",
                status_code=404,
            )
        context, _snapshot, _node = await self.build_context(user_id, node_id, grade)
        return match, context

    # ── 2단계: 관련 자료 찾기 (여기서만 웹 도구가 붙는다) ──────────────────────

    async def research(
        self, user_id: str, *, node_id: str, grade: str | None, recommendation_id: str
    ) -> ResearchResponse:
        started = time.perf_counter()
        recommendation, context = await self._find_recommendation(
            user_id, node_id, grade, recommendation_id
        )

        cache_key = "mbx:research:" + _sha(
            recommendation_id, recommendation.title, PROMPT_VERSION
        )
        cached = await self._cache_get(cache_key)
        if cached:
            log_cache_hit(
                "research",
                str(getattr(self.ml, "model", "unknown")),
                int((time.perf_counter() - started) * 1000),
                sources=len(cached.get("sources", [])),
            )
            return ResearchResponse(
                recommendation_id=recommendation_id, cached=True, **cached
            )

        try:
            data, usage = await self.ml.find_research_sources(
                grade=str(context["grade"]),
                topic=recommendation.title,
                activity=recommendation.activity,
                subjects=list(context["relatedSubjects"]),
            )
        except Exception as exc:
            logger.warning("관련 자료 찾기 LLM 호출 실패: %s", exc)
            raise PruningError("자료를 찾지 못했습니다. 잠시 후 다시 시도해 주세요") from exc

        log_usage(usage)

        sources: list[ResearchSource] = []
        seen_urls: set[str] = set()
        for item in (data.get("sources") or [])[: SOURCES_MAX * 2]:
            if not isinstance(item, dict):
                continue
            url = _clip(item.get("url"), 500)
            if not url.startswith("http") or url in seen_urls:
                continue
            seen_urls.add(url)
            sources.append(
                ResearchSource(
                    title=_clip(item.get("title"), 120) or url,
                    url=url,
                    reason=_clip(item.get("reason"), 200),
                )
            )
            if len(sources) >= SOURCES_MAX:
                break

        payload = {
            "refined_topic": _clip(data.get("refinedTopic"), 120) or recommendation.title,
            "research_questions": [
                _clip(q, 200)
                for q in (data.get("researchQuestions") or [])[:RESEARCH_QUESTIONS_MAX]
                if str(q).strip()
            ],
            "method": _clip(data.get("method"), 300),
            "sources": [s.model_dump() for s in sources],
        }
        await self._cache_set(cache_key, payload, self.settings.research_cache_ttl_seconds)
        return ResearchResponse(recommendation_id=recommendation_id, cached=False, **payload)

    # ── 추천을 실제 그래프 노드로 저장 ────────────────────────────────────────

    async def expand(
        self, user_id: str, *, node_id: str, grade: str | None, recommendation_id: str
    ) -> GraphNode:
        recommendation, _context = await self._find_recommendation(
            user_id, node_id, grade, recommendation_id
        )

        snapshot = await self.graph.get_snapshot(user_id)
        existing = next(
            (n for n in snapshot.nodes if n.label == recommendation.title), None
        )
        node = existing or await self.graph.create_node(
            user_id,
            node_type=NodeType.INQUIRY,
            label=recommendation.title,
            description=recommendation.activity,
            external_refs={
                "source": "pruning",
                "branch_type": recommendation.type.value,
                "expected_output": recommendation.expected_output,
                "recommendation_id": recommendation.id,
            },
        )

        already_linked = any(
            (e.source_id == node_id and e.target_id == node.id)
            or (e.source_id == node.id and e.target_id == node_id)
            for e in snapshot.edges
        )
        if not already_linked:
            await self.graph.create_edge(
                user_id,
                source_id=node_id,
                target_id=node.id,
                relation=RelationType.EVOLVED_FROM,
            )

        if existing is None:
            await self.embeddings.index_node(user_id, node)
        return node
