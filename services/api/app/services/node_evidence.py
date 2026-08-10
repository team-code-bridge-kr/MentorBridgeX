"""노드가 생기부의 **어느 문장**에서 나왔는지 되찾는다.

그래프 노드는 AI 가 생기부에서 뽑는다. 그런데 화면에 남는 건 낱말 하나뿐이라,
학생은 "왜 이게 내 그래프에 있지?" 를 알 수 없다. 잘못 뽑힌 노드인지 아닌지도
판단할 수 없으니 고치지도 지우지도 못한다. 그래서 **그 낱말이 실제로 적혀 있던
문장**을 찾아 함께 보여준다.

문장을 노드에 저장해 두지 않고 **찾을 때마다 원문에서 다시 찾는다.** 이유:

  1. 이미 만들어진 노드에도 출처가 붙는다. 저장 방식이면 오늘부터 만든 노드만
     출처를 갖고, 그 전 것은 영영 빈칸이다.
  2. 생기부를 고치면 출처도 따라 바뀐다. 복사해 둔 문장은 원문과 어긋난다.
  3. 같은 문장을 두 벌 갖고 있지 않게 된다 — 민감한 개인정보다.

찾기는 공백을 무시한다. PDF 에서 뽑은 글은 낱말 중간에 줄바꿈·공백이 끼어 있는
일이 흔해서("정 의 란 무 엇 인 가"), 그대로 비교하면 대부분 못 찾는다.
"""

from __future__ import annotations

import re

from app.schemas.documents import DocumentSection, SectionType
from app.schemas.graph import GraphNode, NodeEvidence, NodeEvidenceQuote

# 몇 문장까지 보여줄지. 전부 늘어놓으면 원문을 옮겨 적은 것과 다를 바 없고,
# 화면에서도 노드 정보가 아니라 문서가 되어 버린다. 나머지는 개수로만 알린다.
# 한 노드에 돌려줄 문장 수. 화면은 이 중 앞의 몇 개만 세우고 나머지는 접어
# 둔다 — "전부 보기" 를 누를 때 서버를 다시 부르지 않게 여기서 넉넉히 준다.
# 문장은 앞뒤를 잘라 낸 조각이라(≈120자) 서른이어도 4KB 안팎이다.
QUOTE_LIMIT = 30

# 한 문장이 이보다 길면 낱말 둘레만 잘라서 보여준다.
SNIPPET_MAX = 150
LEAD = 40  # 잘라 낼 때 낱말 앞에 남길 글자 수

# 문장 끝은 마침표·물음표·느낌표로만 판단한다. 줄바꿈은 경계로 보지 않는다 —
# PDF 에서 뽑은 글은 한 문장이 여러 줄에 걸쳐 있는 게 보통이라, 줄로 끊으면
# 문장이 토막 나고 그 틈에 걸친 낱말은 영영 못 찾는다.
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")

SECTION_LABELS: dict[SectionType, str] = {
    SectionType.SUBJECT_SPECIFIC: "교과 세부능력 및 특기사항",
    SectionType.AUTONOMOUS: "자율활동",
    SectionType.CLUB: "동아리활동",
    SectionType.VOLUNTEER: "봉사활동",
    SectionType.CAREER: "진로활동",
    SectionType.BEHAVIOR: "행동특성 및 종합의견",
    SectionType.READING: "독서활동상황",
    SectionType.AWARD: "수상경력",
}

# 노드에 붙어 있는 과목·영역 이름(external_refs.section)을 항목 종류로 되돌린다.
# 맞으면 그 항목을 먼저 뒤진다 — 같은 낱말이 여러 곳에 있을 때, 노드가 나온
# 자리의 문장을 첫 번째로 보여주기 위해서다.
_SECTION_HINTS: list[tuple[str, SectionType]] = [
    ("교과학습발달상황", SectionType.SUBJECT_SPECIFIC),
    ("세부능력및특기사항", SectionType.SUBJECT_SPECIFIC),
    ("창의적체험활동상황", SectionType.AUTONOMOUS),
    ("자율활동", SectionType.AUTONOMOUS),
    ("동아리활동", SectionType.CLUB),
    ("봉사활동", SectionType.VOLUNTEER),
    ("진로활동", SectionType.CAREER),
    ("행동특성및종합의견", SectionType.BEHAVIOR),
    ("독서활동", SectionType.READING),
    ("수상경력", SectionType.AWARD),
]

# 노드를 누가 만들었는지. 출처 문장을 못 찾았을 때 "왜 없는지" 를 말하려면
# 이게 필요하다 — 직접 만든 노드에 출처가 없는 건 오류가 아니다.
_ORIGINS = {
    "student": "student",
    "pruning": "branch",
    "text_sync": "document",
    "pdf_tokens": "document",
}


def hinted_type(hint: str) -> SectionType | None:
    """노드에 적힌 과목·영역 이름(external_refs.section)을 항목 종류로 되돌린다.

    추출기가 "이 구획을 읽다가 뽑았다"고 적어 둔 값이다. 이름이 지금 구획과
    똑같지는 않아서("창의적체험활동상황" → 자율활동) 이 표로 옮긴다.
    """
    packed = (hint or "").replace(" ", "")
    if not packed:
        return None
    for needle, section_type in _SECTION_HINTS:
        if needle in packed or packed in needle:
            return section_type
    return None


def origin_of(node: GraphNode) -> str:
    """`student`(직접 만듦) · `branch`(가지치기) · `document`(생기부) 중 하나."""
    refs = node.external_refs or {}
    source = str(refs.get("source") or "")
    if source in _ORIGINS:
        return _ORIGINS[source]
    # source 가 없는 노드는 시드이거나 초기 데이터다. 생기부에서 찾아볼 가치는
    # 있으므로 document 로 본다(못 찾으면 "찾지 못했다" 로 끝난다).
    return "document"


def _hint_type(section_title: str | None) -> SectionType | None:
    if not section_title:
        return None
    packed = re.sub(r"\s+", "", section_title)
    for marker, stype in _SECTION_HINTS:
        if marker in packed:
            return stype
    return None


def _label(section: DocumentSection) -> str:
    """인용 위에 붙일 출처 이름.

    세특은 과목마다 항목이 따로 있으므로 "교과 세부능력 및 특기사항" 대신
    "국어 세특" 이라고 말한다 — 46과목 중 어디인지가 사실상의 출처다.
    """
    if section.subject_id:
        grade = f"{section.period_id} " if section.period_id else ""
        return f"{grade}{section.subject_id} 세특"
    return SECTION_LABELS.get(section.section_type, str(section.section_type))


def _pattern(label: str) -> re.Pattern[str] | None:
    """낱말 사이에 공백·줄바꿈이 끼어 있어도 찾도록 만든 정규식."""
    chars = [re.escape(c) for c in label.strip() if not c.isspace()]
    if len(chars) < 2:  # 한 글자짜리는 아무 데나 걸린다. 찾지 않는다.
        return None
    return re.compile(r"\s*".join(chars))


# 노드 하나를 부르는 이름은 여럿일 수 있다.
#
# 생기부에는 "인공지능" 이라고 적혀 있는데 노드 이름은 "AI" 인 일이 흔하다.
# 그러면 출처 문장도 못 찾고 관계도 못 찾는다 — **그 노드만 조용히 빠진다.**
# 그래서 별칭을 함께 둔다: 무엇으로 적혀 있든 같은 개념으로 본다.
#
# 저장 자리는 `external_refs.aliases` 다. 새 표를 만들지 않는 이유는 별칭이
# 노드에 딸린 값이라 노드를 지우면 함께 사라져야 하기 때문이다.
ALIAS_MAX = 8
ALIAS_LEN_MAX = 40


def aliases_of(node: GraphNode) -> list[str]:
    """이 노드의 별칭들. 이름과 겹치거나 빈 것은 뺀다."""
    raw = (node.external_refs or {}).get("aliases")
    if not isinstance(raw, list):
        return []
    seen = {" ".join(node.label.split())}
    out: list[str] = []
    for item in raw:
        name = " ".join(str(item).split())[:ALIAS_LEN_MAX]
        if not name or name in seen:
            continue
        seen.add(name)
        out.append(name)
        if len(out) >= ALIAS_MAX:
            break
    return out


def terms_of(node: GraphNode) -> list[str]:
    """이 노드를 가리키는 모든 이름 — 본 이름 + 별칭."""
    return [node.label, *aliases_of(node)]


def patterns_of(node: GraphNode) -> list[tuple[str, re.Pattern[str]]]:
    """이름마다 정규식 하나. 어느 이름으로 걸렸는지 알아야 그 자리를 강조한다."""
    out = []
    for term in terms_of(node):
        pattern = _pattern(term)
        if pattern is not None:
            out.append((term, pattern))
    return out


def _sentences(content: str) -> list[str]:
    """줄바꿈·중복 공백을 한 칸으로 눌러 놓고 문장으로 자른다.

    눌러 놓는 이유는 두 가지다. 하나는 낱말 중간에 낀 줄바꿈 때문에 못 찾는 일을
    막기 위해서고, 다른 하나는 화면에 인용할 때 원문의 줄바꿈이 그대로 튀어나오면
    한 문장이 계단처럼 보이기 때문이다.
    """
    flat = re.sub(r"\s+", " ", content)
    return [s.strip() for s in _SENTENCE_SPLIT.split(flat) if s.strip()]


def _snippet(sentence: str, start: int, end: int) -> tuple[str, int, int]:
    """문장이 길면 낱말 둘레만 남긴다. 자른 자리는 … 로 표시한다."""
    if len(sentence) <= SNIPPET_MAX:
        return sentence, start, end

    head = max(0, start - LEAD)
    tail = min(len(sentence), head + SNIPPET_MAX)
    # 낱말이 잘려 나가지 않도록 뒤쪽을 우선 확보한다.
    if end > tail:
        tail = min(len(sentence), end + 10)
        head = max(0, tail - SNIPPET_MAX)

    text = sentence[head:tail]
    offset = -head
    if head > 0:
        text = "…" + text
        offset += 1
    if tail < len(sentence):
        text = text + "…"
    return text, start + offset, end + offset


def collect(node: GraphNode, sections: list[DocumentSection]) -> NodeEvidence:
    """노드 이름이 적힌 문장을 생기부에서 찾는다."""
    patterns = patterns_of(node)
    origin = origin_of(node)
    if not patterns or not sections:
        return NodeEvidence(node_id=node.id, label=node.label, origin=origin, quotes=[], total=0)

    # 어느 항목부터 뒤질지. 노드에 붙은 과목·영역과 같은 곳을 먼저 본다 —
    # 같은 낱말이 여러 곳에 있을 때, 그 노드가 나온 자리의 문장이 첫 줄이어야 한다.
    section_hint = " ".join(str((node.external_refs or {}).get("section") or "").split())
    hint = _hint_type(section_hint)

    def rank(s: DocumentSection) -> int:
        if section_hint and s.subject_id == section_hint:
            return 0  # 과목까지 같다(세특은 과목마다 항목이 따로 있다)
        if s.section_type == hint:
            return 1
        return 2

    ordered = sorted(sections, key=rank)

    quotes: list[NodeEvidenceQuote] = []
    seen: set[str] = set()
    total = 0

    for section in ordered:
        for sentence in _sentences(section.content):
            # 여러 이름 중 **먼저 나오는** 자리를 강조한다. 별칭으로 걸린
            # 문장도 출처로서 똑같이 값어치가 있다.
            match = None
            for _term, pattern in patterns:
                found = pattern.search(sentence)
                if found and (match is None or found.start() < match.start()):
                    match = found
            if not match:
                continue
            total += 1
            text, start, end = _snippet(sentence, match.start(), match.end())
            key = re.sub(r"\s+", "", text)
            if key in seen:
                total -= 1  # 같은 문장이 두 번 실린 것뿐이다. 개수로도 세지 않는다.
                continue
            seen.add(key)
            if len(quotes) < QUOTE_LIMIT:
                quotes.append(
                    NodeEvidenceQuote(
                        section_type=section.section_type,
                        section_label=_label(section),
                        text=text,
                        match_start=start,
                        match_end=end,
                    )
                )

    return NodeEvidence(
        node_id=node.id, label=node.label, origin=origin, quotes=quotes, total=total
    )
