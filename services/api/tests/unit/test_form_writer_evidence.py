"""근거 구획 고르기 — 화면의 "무엇을 근거로 썼나" 가 이 값을 그대로 보여준다.

여태는 그래프 노드 앞 열두 개를 집어 보여 주고 있었다. 보고서 내용과 아무
상관 없는 목록이라 학생 눈에는 지어낸 값이었다. 여기서 나오는 이름은
실제로 프롬프트에 들어간 구획이어야 한다.
"""

from datetime import UTC, datetime

from app.schemas.documents import DocumentSection, SectionType
from app.services import form_writer

_T = datetime(2026, 8, 9, tzinfo=UTC)


def sec(stype, content, period=None, subject=None, sid="x"):
    return DocumentSection(
        id=sid,
        section_type=stype,
        content=content,
        period_id=period,
        subject_id=subject,
        created_at=_T,
        updated_at=_T,
    )


def test_학년과_과목이_있으면_그대로_이름이_된다():
    blocks = form_writer.evidence_blocks(
        [sec(SectionType.SUBJECT_SPECIFIC, "미적분을 파이썬으로 구현했다.", "2학년", "수학Ⅱ")]
    )
    assert form_writer.evidence_sources(blocks) == ["2학년 수학Ⅱ"]


def test_학년이_없으면_영역_이름을_한국어로_쓴다():
    # `str(section_type)` 을 쓰면 `[club]` 이 화면에도 프롬프트에도 그대로 나갔다.
    blocks = form_writer.evidence_blocks([sec(SectionType.CLUB, "동아리에서 로봇을 만들었다.")])
    assert form_writer.evidence_sources(blocks) == ["동아리활동"]


def test_비어_있거나_작성_시작인_구획은_근거가_아니다():
    blocks = form_writer.evidence_blocks(
        [
            sec(SectionType.CLUB, "", sid="a"),
            sec(SectionType.CAREER, "(작성 시작)", sid="b"),
            sec(SectionType.READING, "책을 읽었다.", sid="c"),
        ]
    )
    assert form_writer.evidence_sources(blocks) == ["독서활동상황"]


def test_영역을_정하면_그_영역만_쓴다():
    sections = [
        sec(SectionType.SUBJECT_SPECIFIC, "세특 내용", "1학년", "국어", sid="a"),
        sec(SectionType.CLUB, "동아리 내용", sid="b"),
    ]
    blocks = form_writer.evidence_blocks(sections, (SectionType.SUBJECT_SPECIFIC,))
    assert form_writer.evidence_sources(blocks) == ["1학년 국어"]


def test_정한_영역이_비면_있는_것을_쓴다():
    # 동아리 보고서를 쓰려는데 동아리 기록이 없다고 빈손으로 보내면, 학생은
    # 왜 안 되는지 모른 채 다시 누르기만 한다.
    sections = [sec(SectionType.SUBJECT_SPECIFIC, "세특 내용", "1학년", "국어")]
    blocks = form_writer.evidence_blocks(sections, (SectionType.CLUB,))
    assert form_writer.evidence_sources(blocks) == ["1학년 국어"]


def test_이름이_돌려주는_글과_짝이_맞는다():
    # 이름만 맞고 글이 안 들어가면 "근거로 썼다" 가 거짓말이 된다.
    sections = [
        sec(SectionType.SUBJECT_SPECIFIC, "세특 내용", "1학년", "국어", sid="a"),
        sec(SectionType.CLUB, "동아리 내용", sid="b"),
    ]
    blocks = form_writer.evidence_blocks(sections)
    text = form_writer.evidence_text(blocks)
    for name in form_writer.evidence_sources(blocks):
        assert f"[{name}]" in text


def test_글자_수에_걸려_잘린_구획은_이름에도_없다():
    long_one = "가" * (form_writer.MAX_EVIDENCE - 10)
    sections = [
        sec(SectionType.SUBJECT_SPECIFIC, long_one, "1학년", "국어", sid="a"),
        sec(SectionType.SUBJECT_SPECIFIC, "나" * 500, "2학년", "수학", sid="b"),
    ]
    blocks = form_writer.evidence_blocks(sections)
    names = form_writer.evidence_sources(blocks)
    assert names == ["1학년 국어"]


def test_같은_이름이_두_번_나오면_한_번만_남는다():
    sections = [
        sec(SectionType.AUTONOMOUS, "자율 하나", sid="a"),
        sec(SectionType.AUTONOMOUS, "자율 둘", sid="b"),
    ]
    assert form_writer.evidence_sources(form_writer.evidence_blocks(sections)) == ["자율활동"]


def test_근거가_없으면_빈_목록():
    assert form_writer.evidence_sources(form_writer.evidence_blocks([])) == []
