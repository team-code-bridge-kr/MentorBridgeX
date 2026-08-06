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

# 세특은 "<과목명>: <내용>" 이 줄 첫머리에 오는 형태다. 과목명을 목록으로 박아두면
# 학년이 올라가며 나오는 세부 과목("화법과 작문", "영어 독해와 작문", "확률과 통계",
# "인공지능과 미래사회" …)을 못 잡는다. 실제 표본 19쪽에서 37개 과목 중 13개만
# 잡혔고, 못 잡은 구간은 통째로 앞 과목(미술) 블록에 딸려 들어갔다.
# 학기 접두사가 붙기도 한다: "(1학기)통합과학:", "(2학기)미술:".
_SUBJECT_HEADER = re.compile(
    r"(?m)^(?:\(\s*\d\s*학기\s*\)\s*)?"
    r"(?P<name>[가-힣A-Za-zⅠ-Ⅹ][가-힣A-Za-zⅠ-Ⅹ0-9 ·・]{0,18}?)\s*:\s*(?=\S)"
)

# 성적표에서 그 줄만 봐도 표라고 알 수 있는 것들.
# 원점수/과목평균(표준편차), 성취도(수강자수), 성취도만 있는 <체육ㆍ예술> 표까지 포함한다.
_TABLE_STRONG = re.compile(
    r"^(?:"
    r"\d+/\d+\.\d+\(\d+\.\d+\)"
    # 성취도 분포는 한 줄에 여러 칸이 붙어 나온다: "A(78.7) B(8.0) C(13.3)".
    # 한 칸짜리만 보면 이 줄이 표로 안 잡혀서 표 덩어리가 두 토막 나고,
    # 그 사이에 낀 성적표가 앞 과목 세특 끝에 그대로 딸려 들어갔다.
    r"|(?:[A-E]\(\d+(?:\.\d+)?\)\s*){1,8}"
    r"|[A-E]|P"
    r"|이수단위\s*합계.*|분포비율|해당\s*사항\s*없음"
    r"|\(표준편차\)|\(수강자수\)"
    r"|원점수/?\s*과목평균.*|성취도|석차등급|단위수|학기|교과|비고"
    r"|<[^>]{1,12}>"
    r"|기술・가정/제2외|국어/한문/교양"
    r")$"
)
# 표 칸에 과목명만 홀로 놓인 줄("문학", "중국어Ⅰ")을 함께 걷어내기 위한 길이 기준.
_TABLE_STRAY_LEN = 12
# 표로 인정할 최소 연속 줄 수와, 그 안에 있어야 하는 확실한 표 줄 수.
# 세특 본문은 줄이 길어서 짧은 줄이 이만큼 연달아 나오면 사실상 표다.
_MIN_TABLE_RUN = 4
_MIN_TABLE_STRONG = 2

# 제목만 있고 내용이 없는 칸을 걸러내는 최소 길이.
# 30자로 두면 "지역 아동센터에서 학습 멘토링 20시간을 수행함."(27자) 같은
# 짧지만 멀쩡한 봉사활동 기록이 통째로 버려진다.
_MIN_SECTION_CHARS = 20


# 줄바꿈으로 끊긴 낱말을 도로 붙인다.
#
# PDF 의 한 줄은 오른쪽 끝에서 낱말 한가운데를 자른다. 그 줄바꿈을 공백으로
# 바꾸면 "도\n움을" 이 "도 움을" 이 된다 — 화면에도 그렇게 보이고, 키워드도
# "도움" 을 못 뽑는다.
#
# 그런데 낱말 경계에서 끊긴 줄도 똑같이 생겼다(PDF 는 줄 끝 공백을 남기지 않는다).
# 그래서 붙일지 말지를 두 가지로 판단한다:
#
#   1. 붙였을 때 만들어지는 낱말이 **이 문서 어딘가에 낱말로 실제 있는가**
#      (문서 자신이 사전이다. 표본 19쪽에서 80곳을 고쳤고 틀린 곳은 없었다.)
#   2. 왼쪽 조각이 한 글자인가 — 한 글자짜리 낱말이 줄 끝에 오는 일은 드물다.
#      단, 홀로 쓰이는 한 글자 말은 빼 둔다("및", "잘", "수 있다"의 "수" …).
_STANDALONE_ONE = {"및", "잘", "더", "못", "안", "수", "것", "될", "등", "후", "때", "뿐", "중", "시"}
_WRAP_BREAK = re.compile(r"(?<=[가-힣])\n(?=[가-힣])")


def _doc_words(text: str) -> set[str]:
    """이 문서에 띄어쓰기로 구분돼 나온 낱말들 — 붙일지 판단할 사전."""
    return set(re.findall(r"[가-힣]{2,}", text.replace("\n", " ")))


def _join_wrapped(chunk: str, words: set[str]) -> str:
    """줄 끝에서 끊긴 낱말을 붙이고, 나머지 공백은 한 칸으로 누른다."""
    def decide(m: re.Match[str]) -> str:
        left = chunk[: m.start()]
        right = chunk[m.end() :]
        tail = re.search(r"[가-힣]+$", left)
        head = re.match(r"[가-힣]+", right)
        if not tail or not head:
            return " "
        left_word = tail.group(0)
        merged = left_word + head.group(0)
        # 붙인 결과가 사전에 있는지 볼 때는 **왼쪽 조각보다 긴** 것만 본다.
        # 그러지 않으면 "와서" + "발표함" 이 "와서"(문서에 있는 낱말)만 보고
        # 붙어 버린다 — 이미 완성된 낱말은 붙일 이유가 없다.
        lo = len(left_word) + 1
        if any(merged[:k] in words for k in range(lo, min(lo + 3, len(merged)) + 1)):
            return ""
        if len(left_word) == 1 and left_word not in _STANDALONE_ONE:
            return ""
        return " "

    joined = _WRAP_BREAK.sub(decide, chunk)
    return re.sub(r"\s+", " ", joined).strip()


def _normalize_header(text: str) -> str:
    return re.sub(r"\s+", "", text)


def _strip_page_noise(text: str) -> str:
    lines = [_PAGE_NOISE_LINE.sub("", line).strip() for line in text.splitlines()]
    lines = [line for line in lines if line]
    cleaned = "\n".join(lines)
    return re.sub(r"\n{3,}", "\n\n", cleaned).strip()


# 쪽마다 되풀이되는 짧은 줄 = 머리글·꼬리말이다.
#
# 생기부 PDF 는 쪽 아래에 "/ <학생 이름>" 이, 위에 학교명·출력일·"성명"·"반" 이
# 붙는다. 이 줄들이 본문에 섞여 들어가면 세특 끝마다 "/ 장원준" 이 붙는다.
#
# 이름과 학교는 학생마다 달라서 낱말로 못 박을 수 없다. 대신 **모든 쪽에 똑같이
# 나오는 짧은 줄**을 걷는다 — 그게 머리글·꼬리말의 정의다. 실측(19쪽)에서 이
# 규칙에 걸린 것: 학교명, 이름, "/", 출력일, "성명", "반", "번호", 쪽 번호.
# 표 머리(학년·성취도·교과 …)는 15쪽 이하에만 나와서 걸리지 않는다(그건 표
# 걷어내기가 따로 맡는다).
FURNITURE_MAX_LEN = 24
FURNITURE_MIN_PAGES = 3


def _strip_running_furniture(pages: list[str]) -> list[str]:
    """쪽마다 되풀이되는 짧은 줄을 걷어낸다."""
    if len(pages) < FURNITURE_MIN_PAGES:
        return pages
    seen: dict[str, int] = {}
    for page in pages:
        for line in {ln.strip() for ln in page.splitlines() if ln.strip()}:
            if len(line) <= FURNITURE_MAX_LEN:
                seen[line] = seen.get(line, 0) + 1
    # 거의 모든 쪽에 있어야 머리글·꼬리말이다. 한두 쪽 빠지는 경우까지 봐준다.
    need = max(FURNITURE_MIN_PAGES, round(len(pages) * 0.9))
    furniture = {line for line, count in seen.items() if count >= need}
    if not furniture:
        return pages
    return [
        "\n".join(ln for ln in page.splitlines() if ln.strip() not in furniture)
        for page in pages
    ]


def extract_text_from_pdf_bytes(data: bytes) -> str:
    if not data:
        return ""
    with fitz.open(stream=data, filetype="pdf") as doc:
        pages = [page.get_text("text") for page in doc]
    return _strip_page_noise("\n".join(_strip_running_furniture(pages)))


@dataclass
class ParsedSection:
    section_type: SectionType
    title: str
    content: str
    # 세특에만 있다. "1학년" 처럼 사람이 읽는 말로 담는다.
    # 같은 과목이 학년마다 따로 있으므로(미술 1·3학년), 학년이 없으면 두 기록이
    # 한 덩어리로 뭉쳐 어느 해 이야기인지 알 수 없게 된다.
    grade: str | None = None


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


def _slice_section_text(text: str, start: int, end: int, words: set[str]) -> str:
    return _join_wrapped(text[start:end], words)


def _split_major_sections(text: str) -> list[ParsedSection]:
    """Split PDF body into major 생기부 sections using markers."""
    markers = _find_marker_positions(text)
    if not markers:
        return []

    words = _doc_words(text)
    sections: list[ParsedSection] = []
    for i, (_start, header_end, marker, section_type) in enumerate(markers):
        end = markers[i + 1][0] if i + 1 < len(markers) else len(text)
        # 제목 자체는 빼고 그 뒤 본문만 담는다.
        body = _slice_section_text(text, header_end, end, words)
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


def _subject_region(text: str) -> str:
    """교과학습발달상황 구간만 잘라낸다.

    세특 과목 헤더는 "<이름>:" 이라는 흔한 모양이라, 문서 전체에 대고 찾으면
    창체·독서·행동특성 쪽 문장까지 과목으로 오인할 수 있다. 구간을 먼저 좁힌다.
    """
    markers = _find_marker_positions(text)
    start: int | None = None
    for i, (m_start, header_end, _marker, section_type) in enumerate(markers):
        if section_type is not SectionType.SUBJECT_SPECIFIC:
            if start is not None:
                return text[start:m_start]
            continue
        if start is None:
            start = header_end
        del i
    if start is not None:
        return text[start:]
    return text


# 교과학습발달상황은 학년별 표로 나뉜다: `[1학년]` `[2학년]` `[3학년]`.
# (MULTILINE 이 아니라 줄 단위로 match 해서 쓴다 — 본문 가운데의 "1학년 과정"
#  같은 말은 잡히지 않아야 한다.)
_GRADE_MARKER = re.compile(r"^\[\s*(\d)\s*학\s*년\s*\]$", re.MULTILINE)


def _is_table_line(line: str) -> bool:
    """표의 한 칸으로 보이는 줄인가."""
    stripped = line.strip()
    if not stripped:
        return True
    if _TABLE_STRONG.match(stripped):
        return True
    # 표 칸에 홀로 놓인 짧은 과목명. 문장이면(마침표·종결어미) 본문이므로 건드리지 않는다.
    if ":" in stripped:
        return False
    return len(stripped) <= _TABLE_STRAY_LEN and not stripped.endswith((".", "함", "음", "임"))


def _strip_grade_tables(text: str) -> str:
    """성적표(교과·과목·원점수·석차등급) 덩어리를 걷어낸다.

    성적표는 세특 사이사이에 끼어 있어서 그대로 두면 바로 앞 과목 블록에
    통째로 딸려 들어간다. 표본에서는 미술 블록이 8,717자까지 부풀었다.

    표 줄은 짧고 여러 줄이 연달아 나온다. 세특 본문은 문단이 접혀 들어와
    줄이 길기 때문에, "짧은 줄이 연달아 나오고 그 안에 확실한 표 줄이 섞여
    있으면" 표로 본다. 원점수가 없는 <체육ㆍ예술> 성취도 표도 이 규칙에 걸린다.
    """
    lines = text.splitlines()
    keep = [True] * len(lines)

    i = 0
    while i < len(lines):
        if not _is_table_line(lines[i]):
            i += 1
            continue
        run_end = i
        strong = 0
        while run_end < len(lines) and _is_table_line(lines[run_end]):
            if _TABLE_STRONG.match(lines[run_end].strip()):
                strong += 1
            run_end += 1
        if run_end - i >= _MIN_TABLE_RUN and strong >= _MIN_TABLE_STRONG:
            for k in range(i, run_end):
                # 학년 표시는 표 바로 앞에 붙어 있어 표와 함께 지워진다. 이 한 줄이
                # 이후 과목들이 몇 학년 것인지 알려주는 **유일한 단서**라 남긴다.
                if not _GRADE_MARKER.match(lines[k].strip()):
                    keep[k] = False
        i = run_end

    return "\n".join(line for line, kept in zip(lines, keep, strict=True) if kept)


def _split_subject_specific_blocks(text: str) -> list[ParsedSection]:
    cleaned = _strip_grade_tables(_subject_region(_strip_page_noise(text)))
    words = _doc_words(text)
    blocks: list[ParsedSection] = []

    # 학년이 바뀌는 자리. 교과학습발달상황은 [1학년] [2학년] [3학년] 순으로
    # 나뉘고, 그 사이의 과목들이 그 학년 것이다.
    grade_marks = [(m.start(), f"{m.group(1)}학년") for m in _GRADE_MARKER.finditer(cleaned)]

    def grade_at(pos: int) -> str | None:
        found = None
        for start, name in grade_marks:
            if start <= pos:
                found = name
            else:
                break
        return found

    matches = list(_SUBJECT_HEADER.finditer(cleaned))
    for i, match in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(cleaned)
        subject = match.group("name").strip()
        # 학년 표시는 자리만 알려주는 이정표다. 다음 학년 표시가 앞 과목 본문 끝에
        # 딸려 들어가지 않게 여기서 걷어낸다.
        raw = _GRADE_MARKER.sub(" ", cleaned[match.end() : end])
        # 줄 끝에서 끊긴 낱말을 도로 붙인다(제목을 다 찾은 뒤라 안전하다).
        body = _join_wrapped(raw, words)
        if len(body) < 20:
            continue
        blocks.append(
            ParsedSection(
                section_type=SectionType.SUBJECT_SPECIFIC,
                title=subject,
                content=body[:50000],
                grade=grade_at(match.start()),
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
        pages = [page.get_text("text") for page in doc]

    # 머리글·꼬리말은 **쪽 단위로** 걷어야 한다. 쪽을 다 이어 붙인 뒤에는
    # 어느 줄이 쪽마다 되풀이된 것인지 알 수 없다.
    full_text = _strip_page_noise("\n".join(_strip_running_furniture(pages)))
    sections = _merge_sections(full_text)
    # All unique tokens — no top_n limit.
    frequencies = extract_token_frequencies(full_text)

    return ParsedPdf(
        full_text=full_text,
        sections=sections,
        token_frequencies=frequencies,
        page_count=page_count,
    )
