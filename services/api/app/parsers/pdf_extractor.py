"""PDF text extraction via PyMuPDF (fitz) — not ML."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import lru_cache

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

# 마커는 공백을 무시하고 찾는다("행동특성 및 종합의견", "세 부 능 력" 모두 같은 것으로 본다).
# 창의적 체험활동은 표 안에서 영역(자율/동아리/봉사/진로)이 행으로 나뉘므로 각각 따로 잡는다.
# 이걸 빼면 동아리·봉사·진로 영역이 통째로 자율활동에 딸려 들어가거나 아예 비어 버린다.
_SECTION_MARKERS: list[tuple[str, SectionType]] = [
    ("교과학습발달상황", SectionType.SUBJECT_SPECIFIC),
    ("세부능력및특기사항", SectionType.SUBJECT_SPECIFIC),
    ("창의적체험활동상황", SectionType.AUTONOMOUS),
    ("자율활동", SectionType.AUTONOMOUS),
    ("동아리활동", SectionType.CLUB),
    ("봉사활동실적", SectionType.VOLUNTEER),
    ("봉사활동", SectionType.VOLUNTEER),
    ("진로활동", SectionType.CAREER),
    ("행동특성및종합의견", SectionType.BEHAVIOR),
    ("독서활동상황", SectionType.READING),
    ("독서활동", SectionType.READING),
    ("수상경력", SectionType.AWARD),
]

_SUBJECT_SPLIT = re.compile(rf"(?=({_SUBJECT_NAMES})\s*:)")

# 제목만 있고 내용이 없는 칸을 걸러내는 최소 길이.
# 30자로 두면 "지역 아동센터에서 학습 멘토링 20시간을 수행함."(27자) 같은
# 짧지만 멀쩡한 봉사활동 기록이 통째로 버려진다.
_MIN_SECTION_CHARS = 20


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


@lru_cache(maxsize=64)
def _marker_pattern(marker: str, anchored: bool) -> re.Pattern[str]:
    """마커를 원본 텍스트에서 찾는 정규식.

    PDF 에서 뽑은 텍스트는 제목 글자 사이에 공백·줄바꿈이 섞여 나오므로
    글자 사이에 \\s* 를 넣어 허용한다. 기본은 줄 앞에 붙은 것만 제목으로 보고,
    그렇게 찾지 못하면 위치를 가리지 않고 다시 찾는다.

    제목 바로 뒤에 한글이 이어지면 제목이 아니라 본문이다. 이 조건이 없으면
    "동아리활동을 통해 협업 능력을 기르고..." 로 시작하는 행동특성 문단이
    동아리활동 제목으로 잡힌다. 덤으로 "독서활동" 이 "독서활동상황" 의 앞부분에
    걸리는 것도 막아 준다.
    """
    body = r"\s*".join(re.escape(ch) for ch in marker if not ch.isspace())
    prefix = r"(?m)^[\s.|·\-]*" if anchored else ""
    return re.compile(prefix + body + r"(?![가-힣])")


def _find_marker_positions(text: str) -> list[tuple[int, int, str, SectionType]]:
    """(제목 시작, 제목 끝, 마커, 유형) 목록. 인덱스는 **원본 텍스트 기준**이다.

    예전에는 공백을 모두 지운 문자열에서 인덱스를 구해 원본을 잘랐다. 원본에는
    공백이 있으니 인덱스가 항상 앞으로 밀려, 각 영역이 자기 제목 앞의 내용
    (= 직전 영역의 꼬리)을 가져갔다. 뒤로 갈수록 어긋남이 커져서 수상경력에
    출결 내용이, 독서활동에 세특 내용이 들어갔다.
    """
    found: list[tuple[int, int, str, SectionType]] = []
    for marker, section_type in _SECTION_MARKERS:
        matches = list(_marker_pattern(marker, True).finditer(text))
        if not matches:
            matches = list(_marker_pattern(marker, False).finditer(text))
        for m in matches:
            found.append((m.start(), m.end(), marker, section_type))

    # 앞에서부터 훑으면서 앞 제목과 겹치는 것은 버린다
    # ("독서활동상황" 과 "독서활동" 처럼 한쪽이 다른 쪽을 포함하는 경우).
    found.sort(key=lambda item: (item[0], -(item[1] - item[0])))
    deduped: list[tuple[int, int, str, SectionType]] = []
    for item in found:
        if deduped and item[0] < deduped[-1][1]:
            continue
        deduped.append(item)
    return deduped


def _slice_section_text(text: str, start: int, end: int) -> str:
    chunk = text[start:end]
    return re.sub(r"\s+", " ", chunk).strip()


def _split_major_sections(text: str) -> list[ParsedSection]:
    """Split PDF body into major 생기부 sections using markers."""
    markers = _find_marker_positions(text)
    if not markers:
        return []

    sections: list[ParsedSection] = []
    for i, (_start, header_end, marker, section_type) in enumerate(markers):
        end = markers[i + 1][0] if i + 1 < len(markers) else len(text)
        # 제목 자체는 빼고 그 뒤 본문만 담는다.
        body = _slice_section_text(text, header_end, end)
        if len(body) < _MIN_SECTION_CHARS:
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
