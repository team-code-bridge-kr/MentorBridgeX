"""Anthropic 서버 도구(web_search / web_fetch) 버전 선택.

버전 문자열을 코드에 적어두지 않는다. 설치된 anthropic SDK 가 export 하는
`WebSearchTool<날짜>Param` / `WebFetchTool<날짜>Param` TypedDict 의 `type` 리터럴을
읽어와 최신순으로 정렬하고, 모델이 거부하면 한 단계씩 내려간다.

거부 사유는 모델 등급에 달려 있다. 최신 변형(dynamic filtering)은 내부적으로
code execution 을 쓰기 때문에 Haiku 4.5 같은 모델에서는
"does not support programmatic tool calling" 400 이 난다. 이 경우 그 모델에 대해
한 단계 낮은 버전을 기억해두고 다음 요청부터 바로 사용한다.
"""

from __future__ import annotations

import logging
import re
import typing

logger = logging.getLogger(__name__)

_SEARCH_PATTERN = re.compile(r"^WebSearchTool(\d{8})Param$")
_FETCH_PATTERN = re.compile(r"^WebFetchTool(\d{8})Param$")

# 모델이 특정 버전을 거부했을 때 남기는 표식. (model, kind) -> 사용할 인덱스
_downgraded: dict[tuple[str, str], int] = {}

# 400 메시지에 이게 들어 있으면 "이 모델에는 너무 최신 버전"이라는 뜻이다.
_UNSUPPORTED_MARKERS = (
    "programmatic tool calling",
    "does not support",
    "not supported",
    "unsupported",
)


def _literal_value(annotation: object) -> str | None:
    """Required[Literal["web_search_20250305"]] 에서 문자열을 꺼낸다."""
    args = typing.get_args(annotation)
    while args and not isinstance(args[0], str):
        args = typing.get_args(args[0])
    return args[0] if args and isinstance(args[0], str) else None


def _discover(pattern: re.Pattern[str]) -> list[str]:
    """설치된 SDK 에서 해당 도구의 type 리터럴을 최신순으로 반환."""
    import anthropic.types as anthropic_types  # noqa: PLC0415

    found: list[tuple[str, str]] = []
    for name in dir(anthropic_types):
        match = pattern.match(name)
        if not match:
            continue
        cls = getattr(anthropic_types, name)
        try:
            hints = typing.get_type_hints(cls, include_extras=True)
        except Exception:  # pragma: no cover - SDK 내부 구조가 바뀐 경우
            continue
        value = _literal_value(hints.get("type"))
        if value:
            found.append((match.group(1), value))
    found.sort(key=lambda item: item[0], reverse=True)
    return [value for _, value in found]


_SEARCH_VERSIONS: list[str] | None = None
_FETCH_VERSIONS: list[str] | None = None


def _versions(kind: str) -> list[str]:
    global _SEARCH_VERSIONS, _FETCH_VERSIONS
    if kind == "web_search":
        if _SEARCH_VERSIONS is None:
            _SEARCH_VERSIONS = _discover(_SEARCH_PATTERN)
        return _SEARCH_VERSIONS
    if _FETCH_VERSIONS is None:
        _FETCH_VERSIONS = _discover(_FETCH_PATTERN)
    return _FETCH_VERSIONS


def _index(model: str, kind: str) -> int:
    return _downgraded.get((model, kind), 0)


def tool_type(model: str, kind: str) -> str | None:
    """이 모델에서 현재 사용할 도구 type 문자열. SDK 에 없으면 None."""
    versions = _versions(kind)
    if not versions:
        return None
    return versions[min(_index(model, kind), len(versions) - 1)]


def build_tools(
    model: str,
    *,
    search_max_uses: int,
    fetch_max_uses: int,
    fetch_max_content_tokens: int,
    allowed_domains: list[str] | None = None,
) -> list[dict]:
    """2단계 요청에만 붙일 웹 도구 정의를 만든다."""
    tools: list[dict] = []

    search_type = tool_type(model, "web_search")
    if search_type:
        search: dict = {
            "type": search_type,
            "name": "web_search",
            "max_uses": search_max_uses,
        }
        if allowed_domains:
            search["allowed_domains"] = allowed_domains
        tools.append(search)

    fetch_type = tool_type(model, "web_fetch")
    if fetch_type:
        fetch: dict = {
            "type": fetch_type,
            "name": "web_fetch",
            "max_uses": fetch_max_uses,
            "max_content_tokens": fetch_max_content_tokens,
        }
        if allowed_domains:
            fetch["allowed_domains"] = allowed_domains
        tools.append(fetch)

    return tools


def downgrade(model: str, message: str) -> bool:
    """모델이 현재 버전을 거부했으면 한 단계 낮춘다. 더 낮출 수 없으면 False."""
    lowered = message.lower()
    if not any(marker in lowered for marker in _UNSUPPORTED_MARKERS):
        return False

    changed = False
    for kind in ("web_search", "web_fetch"):
        versions = _versions(kind)
        current = _index(model, kind)
        if current + 1 < len(versions):
            _downgraded[(model, kind)] = current + 1
            logger.info(
                "%s: %s 를 거부해 %s 로 낮춤",
                model,
                versions[current],
                versions[current + 1],
            )
            changed = True
    return changed
