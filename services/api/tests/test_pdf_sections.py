"""생기부 PDF 영역 분리 회귀 테스트.

두 가지 버그를 고정한다.

1. 영역이 한 칸씩 밀리던 문제.
   제목 위치를 공백 제거한 문자열에서 구해 원본을 잘랐다. 원본에는 공백이
   있으니 인덱스가 항상 앞으로 밀려, 각 영역이 자기 제목 앞의 내용을
   가져갔다. 실제 업로드에서 수상경력에 출결 내용이, 독서활동에 세특
   내용이 들어갔다.

2. 동아리·봉사·진로 영역이 통째로 비던 문제.
   창의적 체험활동은 표 안에서 영역이 행으로 나뉘는데 마커가 없었다.
"""

from __future__ import annotations

from app.parsers.pdf_extractor import (
    _split_major_sections,
    _split_subject_specific_blocks,
    parse_pdf_bytes,
)
from app.schemas.documents import SectionType

# NEIS 출력물과 같은 순서로 배열한 표본.
_RECORD = """출결상황
원격수업일수 75일 결석 0일

수상경력
교과성적우수상(수학) 2022.12.29. 동국대학교사범대학부

창의적 체험활동상황
자율활동
학급 회장으로서 학급 규칙을 정하고 운영함. 학급 자치 회의를 주도함.
동아리활동
(프로그래밍반) 파이썬으로 등차수열 계산기를 만들어 발표함.
봉사활동
지역 아동센터에서 학습 멘토링 20시간을 수행함.
진로활동
컴퓨터공학과 진학을 목표로 대학 전공 탐색 활동에 참여함.

독서활동상황
파이썬 프로그래밍(홍길동), 미술의 이해(임꺽정)

행동특성 및 종합의견
성실하고 책임감이 강한 학생임. 급우들과의 관계가 원만함."""


def _by_type(text: str) -> dict[SectionType, str]:
    out: dict[SectionType, str] = {}
    for section in _split_major_sections(text):
        out.setdefault(section.section_type, section.content)
    return out


def test_every_section_gets_its_own_body() -> None:
    """각 영역이 자기 제목 '뒤' 내용을 가져간다 (앞 영역의 꼬리가 아니라)."""
    got = _by_type(_RECORD)

    assert got[SectionType.AWARD].startswith("교과성적우수상")
    assert got[SectionType.AUTONOMOUS].startswith("학급 회장")
    assert got[SectionType.CLUB].startswith("(프로그래밍반)")
    assert got[SectionType.VOLUNTEER].startswith("지역 아동센터")
    assert got[SectionType.CAREER].startswith("컴퓨터공학과")
    assert got[SectionType.READING].startswith("파이썬 프로그래밍")
    assert got[SectionType.BEHAVIOR].startswith("성실하고")


def test_sections_do_not_leak_into_each_other() -> None:
    """앞 영역 내용이 뒤 영역으로 새지 않는다."""
    got = _by_type(_RECORD)

    # 실제로 났던 증상: 수상경력에 출결 내용이 들어갔다.
    assert "원격수업일수" not in got[SectionType.AWARD]
    # 독서활동에 세특/미술 내용이 들어갔다.
    assert "컴퓨터공학과" not in got[SectionType.READING]
    # 제목 자체는 본문에 남지 않는다.
    for content in got.values():
        assert not content.startswith(("수상경력", "자율활동", "동아리활동", "봉사활동"))


def test_creative_activity_subsections_are_separated() -> None:
    """동아리·봉사·진로가 자율활동에 딸려 들어가지 않는다."""
    got = _by_type(_RECORD)

    assert {SectionType.CLUB, SectionType.VOLUNTEER, SectionType.CAREER} <= set(got)
    assert "프로그래밍반" not in got[SectionType.AUTONOMOUS]
    assert "아동센터" not in got[SectionType.AUTONOMOUS]


def test_header_spacing_is_tolerated() -> None:
    """PDF 가 제목 글자 사이를 벌려 놔도 같은 제목으로 본다."""
    spaced = _RECORD.replace("행동특성 및 종합의견", "행 동 특 성 및 종 합 의 견")
    got = _by_type(spaced)

    assert got[SectionType.BEHAVIOR].startswith("성실하고")


def test_body_text_is_not_mistaken_for_a_header() -> None:
    """본문 중의 '동아리활동을 통해...' 를 제목으로 오인하지 않는다."""
    text = (
        "행동특성 및 종합의견\n"
        "동아리활동을 통해 협업 능력을 기르고 발표력을 키운 학생임. "
        "봉사활동에도 꾸준히 참여하여 성실함을 보여 줌."
    )
    got = _by_type(text)

    assert SectionType.CLUB not in got
    assert SectionType.VOLUNTEER not in got
    assert got[SectionType.BEHAVIOR].startswith("동아리활동을 통해")


def test_short_but_real_entries_survive() -> None:
    """봉사활동처럼 짧은 기록이 최소 길이 필터에 통째로 버려지지 않는다."""
    got = _by_type(_RECORD)

    assert len(got[SectionType.VOLUNTEER]) < 30  # 27자 — 예전 기준(30)에 걸리던 길이
    assert "멘토링" in got[SectionType.VOLUNTEER]


def test_empty_pdf_is_handled() -> None:
    parsed = parse_pdf_bytes(_blank_pdf())
    assert parsed.sections == [] or all(s.content for s in parsed.sections)


def _blank_pdf() -> bytes:
    import fitz  # noqa: PLC0415

    doc = fitz.open()
    doc.new_page()
    data = doc.tobytes()
    doc.close()
    return data


# ── 세특 과목 분리 ────────────────────────────────────────────────────────────

_SUBJECT_TEXT = """교과학습발달상황
학기
교과
과목
단위수
원점수/과목평균
(표준편차)
성취도
석차등급
국어
문학
89/63.7(20.9)
A(286)
수학
수학Ⅰ
54/42.2(23.3)
C(286)
이수단위 합계
화법과 작문: '일상 속 빅데이터 활용 사례'에 대해 관련 도서를 찾아 정보를 전달하는 글쓰기를 수행함.
(1학기)통합과학: 자율주행차의 미래 전망에 대해 조사한 내용을 잘 정리하여 발표함.
인공지능과 미래사회: 인공지능의 발전과정과 기술적 배경지식을 학습하고 활용 사례를 조사함.

독서활동상황
정의란 무엇인가(마이클 샌델)"""


def test_subject_headers_are_not_limited_to_a_fixed_list() -> None:
    """세부 과목명("화법과 작문", "인공지능과 미래사회")도 과목으로 잡는다.

    교과명 목록을 코드에 박아 두면 학년이 올라가며 나오는 세부 과목을 놓치고,
    놓친 구간은 통째로 앞 과목 블록에 딸려 들어간다.
    """
    titles = [s.title for s in _split_subject_specific_blocks(_SUBJECT_TEXT)]

    assert "화법과 작문" in titles
    assert "인공지능과 미래사회" in titles


def test_term_prefixed_subject_headers_are_recognized() -> None:
    """"(1학기)통합과학:" 처럼 학기가 앞에 붙어도 과목으로 잡는다."""
    blocks = {s.title: s.content for s in _split_subject_specific_blocks(_SUBJECT_TEXT)}

    assert "통합과학" in blocks
    assert blocks["통합과학"].startswith("자율주행차")


def test_grade_table_is_not_absorbed_into_a_subject() -> None:
    """성적표(원점수·성취도·석차등급)가 과목 블록에 섞이지 않는다."""
    blocks = _split_subject_specific_blocks(_SUBJECT_TEXT)

    for block in blocks:
        assert "89/63.7" not in block.content
        assert "A(286)" not in block.content
        assert "석차등급" not in block.content


def test_subject_split_stays_inside_the_grades_region() -> None:
    """독서활동 등 다른 영역 내용이 세특 과목으로 넘어오지 않는다."""
    joined = " ".join(s.content for s in _split_subject_specific_blocks(_SUBJECT_TEXT))

    assert "마이클 샌델" not in joined
