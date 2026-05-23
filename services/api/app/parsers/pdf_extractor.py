"""PDF text extraction via PyMuPDF (fitz) — not ML."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

import fitz

from app.parsers.token_extractor import extract_token_frequencies
from app.schemas.documents import SectionType

# Repeated header/footer lines in NEIS-style PDF exports.
_HEADER_FOOTER = re.compile(
    r"^동국대학교.*$|^/\s*\d+\s*$|^\d{4}년\s+\d+월\s+\d+일$",
    re.MULTILINE,
)

_SECTION_MARKERS: list[tuple[str, SectionType]] = [
    ("세부능력및특기사항", SectionType.SUBJECT_SPECIFIC),
    ("세부 능력 및 특 기 사항", SectionType.SUBJECT_SPECIFIC),
    ("창의적체험활동", SectionType.AUTONOMOUS),
    ("창의적 체험활동", SectionType.AUTONOMOUS),
    ("행동특성및종합의견", SectionType.BEHAVIOR),
    ("행동특성 및 종합의견", SectionType.BEHAVIOR),
    ("독서활동상황", SectionType.READING),
    ("독서활동", SectionType.READING),
    ("수상경력", SectionType.AWARD),
]

_SUBJECT_LINE = re.compile(
    r"^(국어|수학|영어|한국사|통합사회|통합과학|과학|미술|음악|체육|기술|정보|"
    r"사회|물리|화학|생명|지구|윤리|철학|한문|중국어|일본어|독일어|"
    r"과학탐구실험|사회문제탐구|수학과제탐구)\s*:\s*(.+)$",
    re.MULTILINE | re.DOTALL,
)


def _normalize_header(text: str) -> str:
    return re.sub(r"\s+", "", text)


def _strip_noise(text: str) -> str:
    cleaned = _HEADER_FOOTER.sub("", text)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def extract_text_from_pdf_bytes(data: bytes) -> str:
    if not data:
        return ""
    with fitz.open(stream=data, filetype="pdf") as doc:
        pages = [page.get_text("text") for page in doc]
    return _strip_noise("\n".join(pages))


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


def _split_subject_specific_blocks(text: str) -> list[ParsedSection]:
    norm = _normalize_header(text)
    if "세부능력및특기사항" not in norm and "세부능력" not in norm:
        return []

    blocks: list[ParsedSection] = []
    for match in _SUBJECT_LINE.finditer(text):
        subject = match.group(1).strip()
        body = re.sub(r"\s+", " ", match.group(2)).strip()
        if len(body) < 20:
            continue
        blocks.append(
            ParsedSection(
                section_type=SectionType.SUBJECT_SPECIFIC,
                title=subject,
                content=body,
            )
        )
    return blocks


def _fallback_section(full_text: str) -> ParsedSection:
    return ParsedSection(
        section_type=SectionType.SUBJECT_SPECIFIC,
        title="PDF 전체",
        content=full_text[:50000],
    )


def parse_pdf_bytes(
    data: bytes,
    *,
    keyword_top_n: int = 30,
) -> ParsedPdf:
    with fitz.open(stream=data, filetype="pdf") as doc:
        page_count = doc.page_count
        raw = "\n".join(page.get_text("text") for page in doc)

    full_text = _strip_noise(raw)
    sections = _split_subject_specific_blocks(full_text)

    if not sections and full_text:
        sections = [_fallback_section(full_text)]

    frequencies = extract_token_frequencies(full_text, top_n=keyword_top_n)

    return ParsedPdf(
        full_text=full_text,
        sections=sections,
        token_frequencies=frequencies,
        page_count=page_count,
    )
