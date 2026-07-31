"""Shared keyword extraction: Claude when configured, rule-based tokens otherwise.

Both entry points into the graph — PDF import (document_service) and incremental
text sync (sync_service) — go through here so the LLM path and the rule-based
fallback stay identical in both, and an LLM failure never fails the caller.
"""

from __future__ import annotations

import logging

from app.adapters.factory import get_graph_analyze_adapter
from app.parsers.keyword_classifier import classify_node_type
from app.schemas.extraction import ExtractedKeyword

logger = logging.getLogger(__name__)

RULE_EXTRACTOR = "rule_tokens"


def rule_based_keywords(
    token_freqs: list[tuple[str, int]],
    *,
    limit: int,
    source: str = "rule_tokens",
) -> list[ExtractedKeyword]:
    """Top-N rule-based tokens, typed by the keyword classifier."""
    return [
        ExtractedKeyword(
            label=label,
            node_type=classify_node_type(label),
            frequency=freq,
            source=source,
        )
        for label, freq in token_freqs[:limit]
    ]


async def extract_keywords(
    *,
    sections: list[tuple[str, str]],
    token_freqs: list[tuple[str, int]],
    limit: int,
    rule_source: str = "rule_tokens",
) -> tuple[list[ExtractedKeyword], str]:
    """Extract keywords for graph nodes.

    Returns (keywords, extractor) where extractor is ``"rule_tokens"`` or
    ``"claude:<model>"``. Falls back to rule-based tokens when the LLM is not
    configured, raises, or returns nothing — callers never see an exception.
    """
    adapter = get_graph_analyze_adapter()
    if adapter is not None:
        try:
            extracted = await adapter.extract_document_keywords(
                sections=sections,
                max_keywords=limit,
            )
        except Exception as exc:  # noqa: BLE001 — never fail a caller on the LLM
            logger.warning("LLM keyword extraction failed, using rule tokens: %s", exc)
        else:
            if extracted:
                return extracted, f"claude:{adapter.model}"
            logger.warning("LLM keyword extraction returned nothing, using rule tokens")

    return rule_based_keywords(token_freqs, limit=limit, source=rule_source), RULE_EXTRACTOR
