"""PDF text extraction via PyMuPDF (fitz) — not ML."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

import fitz

from app.parsers.token_extractor import extract_token_frequencies
from app.schemas.documents import SectionType

_SUBJECT_NAMES = (
    "국어|수학|영어|한국사|통합사회|통합과학|과학|미술|음악|체육|기술|정보|"
    "사회|물리|화학|생명|지구|윤리|철학|한문|중국어|일본어|독일어|"
    "과학탐구실험|사회문제탐구|수학과제탐구"
)

# NEIS PDF repeated layout lines (school-agnostic patterns).
_PAGE_NOISE_LINE = re.compile(
    r"^(?:"
    r".*고등학교.*|"
    r".*중학교.*|"
    r".*\d{4}\.\d{2}\.\d{2}.*\d{2}:\d{2}.*|"  # export watermark
    r"\d{4}년\s*\d{1,2}월\s*\d{1,2}일\s*|"
    r"/\s*\d+\s*|"
    r"^\d{1,2}\s*반\s*$|"
    r"^(?:반|번호|성명|담임|학년|과목)\s*$|"
    r"^\d{1,3}\s*$|"  # lone page/class numbers
    r"과목\s*세\s*부\s*능\s*력\s*및\s*특\s*기\s*사\s*항\s*|"
    r"학\s*교\s*생\s*활\s*세\s*부\s*사\s*항\s*기\s*록\s*부.*"
    r")$",
    re.MULTILINE,
)

_SECTION_MARKERS: list[tuple[str, SectionType]] = [
    ("교과학습발달상황", SectionType.SUBJECT_SPECIFIC),
    ("세부능력및특기사항", SectionType.SUBJECT_SPECIFIC),
    ("세부 능력 및 특 기 사항", SectionType.SUBJECT_SPECIFIC),
    ("창의적체험활동상황", SectionType.AUTONOMOUS),
    ("창의적 체험활동", SectionType.AUTONOMOUS),
    ("창의적체험활동", SectionType.AUTONOMOUS),
    ("행동특성및종합의견", SectionType.BEHAVIOR),
    ("행동특성 및 종합의견", SectionType.BEHAVIOR),
    ("독서활동상황", SectionType.READING),
    ("독서활동", SectionType.READING),
    ("수상경력", SectionType.AWARD),
]

_SUBJECT_SPLIT = re.compile(rf"(?=({_SUBJECT_NAMES})\s*:)")


def _normalize_header(text: str) -> str:
    return re.sub(r"\s+", "", text)


def _strip_page_noise(text: str) -> str:
    lines = [_PAGE_NOISE_LINE.sub("", line).strip() for line in text.splitlines()]
    lines = [line for line in lines if line]
    cleaned = "\n".join(lines)
    return re.sub(r"\n{3,}", "\n\n", cleaned).strip()


def extract_text_from_pdf_bytes(data: bytes) -> str:
    if not data:
        return ""
    with fitz.open(stream=data, filetype="pdf") as doc:
        pages = [page.get_text("text") for page in doc]
    return _strip_page_noise("\n".join(pages))


@dataclass
class ParsedSection:
    section_type: SectionType
    title: str
    content: str


@dataclass
class ParsedPdf:
    full_text: str
    sections: list[ParsedSection] = field(default_factory=list)
    token_frequencies: list[tuple[str, int]] = field(default_factory=list)
    page_count: int = 0

    @property
    def token_count(self) -> int:
        return sum(count for _, count in self.token_frequencies)

    @property
    def unique_token_count(self) -> int:
        return len(self.token_frequencies)


def _find_marker_positions(text: str) -> list[tuple[int, str, SectionType]]:
    norm = _normalize_header(text)
    found: list[tuple[int, str, SectionType]] = []
    seen_norm: set[str] = set()
    for marker, section_type in _SECTION_MARKERS:
        norm_marker = _normalize_header(marker)
        if norm_marker in seen_norm:
            continue
        idx = norm.find(norm_marker)
        if idx >= 0:
            seen_norm.add(norm_marker)
            found.append((idx, marker, section_type))
    found.sort(key=lambda item: item[0])
    return found


def _slice_section_text(text: str, start: int, end: int) -> str:
    chunk = text[start:end]
    return re.sub(r"\s+", " ", chunk).strip()


def _split_major_sections(text: str) -> list[ParsedSection]:
    """Split PDF body into major 생기부 sections using markers."""
    markers = _find_marker_positions(text)
    if not markers:
        return []

    sections: list[ParsedSection] = []
    for i, (pos, marker, section_type) in enumerate(markers):
        end = markers[i + 1][0] if i + 1 < len(markers) else len(text)
        body = _slice_section_text(text, pos, end)
        if len(body) < 30:
            continue
        sections.append(
            ParsedSection(
                section_type=section_type,
                title=marker,
                content=body[:50000],
            )
        )
    return sections


def _split_subject_specific_blocks(text: str) -> list[ParsedSection]:
    cleaned = _strip_page_noise(text)
    parts = _SUBJECT_SPLIT.split(cleaned)
    blocks: list[ParsedSection] = []

    for part in parts:
        part = part.strip()
        if not part:
            continue
        match = re.match(rf"^({_SUBJECT_NAMES})\s*:\s*(.*)$", part, re.DOTALL)
        if not match:
            continue
        subject = match.group(1).strip()
        body = re.sub(r"\s+", " ", match.group(2)).strip()
        if len(body) < 20:
            continue
        blocks.append(
            ParsedSection(
                section_type=SectionType.SUBJECT_SPECIFIC,
                title=subject,
                content=body[:50000],
            )
        )
    return blocks


def _fallback_section(full_text: str) -> ParsedSection:
    return ParsedSection(
        section_type=SectionType.SUBJECT_SPECIFIC,
        title="PDF 전체",
        content=full_text[:50000],
    )


def _merge_sections(text: str) -> list[ParsedSection]:
    subject_blocks = _split_subject_specific_blocks(text)
    major_sections = _split_major_sections(text)

    if subject_blocks:
        # Prefer per-subject 세특 blocks; add non-subject major sections.
        subject_types = {SectionType.SUBJECT_SPECIFIC}
        extras = [s for s in major_sections if s.section_type not in subject_types]
        return subject_blocks + extras

    if major_sections:
        return major_sections

    if text.strip():
        return [_fallback_section(text)]
    return []


def parse_pdf_bytes(data: bytes) -> ParsedPdf:
    with fitz.open(stream=data, filetype="pdf") as doc:
        page_count = doc.page_count
        raw = "\n".join(page.get_text("text") for page in doc)

    full_text = _strip_page_noise(raw)
    sections = _merge_sections(full_text)
    # All unique tokens — no top_n limit.
    frequencies = extract_token_frequencies(full_text)

    return ParsedPdf(
        full_text=full_text,
        sections=sections,
        token_frequencies=frequencies,
        page_count=page_count,
    )
