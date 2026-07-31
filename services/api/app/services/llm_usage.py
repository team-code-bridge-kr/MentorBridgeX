"""Claude 요청 사용량 로깅.

생기부 원문·개인정보는 절대 남기지 않는다. 토큰 수, 도구 호출 횟수,
응답 시간, 캐시 적중 여부 같은 계량값만 기록한다.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

logger = logging.getLogger("app.llm.usage")

# 앱에 전역 로깅 설정이 없어서 root 가 WARNING 이다. 사용량 로그는 요구사항이므로
# 이 로거만 INFO 로 직접 열어둔다 (다른 로거 동작은 건드리지 않는다).
if not logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(_handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False


@dataclass
class LLMUsage:
    stage: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_input_tokens: int = 0
    cache_creation_input_tokens: int = 0
    web_search_calls: int = 0
    web_fetch_calls: int = 0
    elapsed_ms: int = 0
    cache_hit: bool = False
    extra: dict[str, object] = field(default_factory=dict)


def usage_from_response(stage: str, model: str, response: object) -> LLMUsage:
    """Anthropic 응답에서 사용량과 서버 도구 호출 횟수를 집계한다."""
    usage = getattr(response, "usage", None)
    result = LLMUsage(
        stage=stage,
        model=model,
        input_tokens=int(getattr(usage, "input_tokens", 0) or 0),
        output_tokens=int(getattr(usage, "output_tokens", 0) or 0),
        cache_read_input_tokens=int(getattr(usage, "cache_read_input_tokens", 0) or 0),
        cache_creation_input_tokens=int(getattr(usage, "cache_creation_input_tokens", 0) or 0),
    )

    # 서버 도구 호출 횟수: server_tool_use 블록을 이름별로 센다.
    for block in getattr(response, "content", None) or []:
        if getattr(block, "type", None) != "server_tool_use":
            continue
        name = getattr(block, "name", "")
        if name == "web_search":
            result.web_search_calls += 1
        elif name == "web_fetch":
            result.web_fetch_calls += 1

    # SDK 가 집계해주는 경우도 함께 반영한다 (있으면 더 정확하다).
    server_usage = getattr(usage, "server_tool_use", None)
    if server_usage is not None:
        requests = getattr(server_usage, "web_search_requests", None)
        if requests:
            result.web_search_calls = max(result.web_search_calls, int(requests))
        requests = getattr(server_usage, "web_fetch_requests", None)
        if requests:
            result.web_fetch_calls = max(result.web_fetch_calls, int(requests))

    return result


def log_usage(usage: LLMUsage) -> None:
    logger.info(
        "llm_usage stage=%s model=%s cache_hit=%s elapsed_ms=%d "
        "input=%d output=%d cache_read=%d cache_create=%d "
        "web_search=%d web_fetch=%d%s",
        usage.stage,
        usage.model,
        usage.cache_hit,
        usage.elapsed_ms,
        usage.input_tokens,
        usage.output_tokens,
        usage.cache_read_input_tokens,
        usage.cache_creation_input_tokens,
        usage.web_search_calls,
        usage.web_fetch_calls,
        "".join(f" {k}={v}" for k, v in sorted(usage.extra.items())),
    )


def log_cache_hit(stage: str, model: str, elapsed_ms: int, **extra: object) -> None:
    """캐시로 돌려준 요청 — Claude 호출이 없었으므로 토큰은 전부 0."""
    log_usage(
        LLMUsage(
            stage=stage,
            model=model,
            elapsed_ms=elapsed_ms,
            cache_hit=True,
            extra=dict(extra),
        )
    )
