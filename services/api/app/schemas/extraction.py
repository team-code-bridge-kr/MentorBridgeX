"""Keyword extraction results shared by the LLM and rule-based extractors.

document_service consumes ExtractedKeyword regardless of which extractor produced
it, so the LLM path and the rule-based fallback stay interchangeable.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.schemas.graph import NodeType


@dataclass(frozen=True)
class ExtractedKeyword:
    """A single keyword/concept extracted from 생기부 text."""

    label: str
    node_type: NodeType
    confidence: float | None = None
    rationale: str | None = None
    frequency: int | None = None
    section_title: str | None = None
    source: str = "rule_tokens"
