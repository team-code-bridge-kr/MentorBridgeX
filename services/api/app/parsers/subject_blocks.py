"""세특 본문을 과목 단위로 가른다.

세부능력 및 특기사항은 생기부에서 가장 긴 영역이다. 표본 한 건이 46과목 21,000자였다.
이걸 한 덩어리로 두면 세 가지가 망가진다.

  1. 화면 — 편집 상자 하나에 21,000자가 들어간다. 원하는 과목을 찾으려면 스크롤로
     뒤져야 하고, 한 과목을 고치려다 다른 과목을 건드리기 쉽다.
  2. 출처 — 노드가 어느 과목에서 나왔는지 말할 수 없다. "세부능력 및 특기사항"
     이라고만 하면 46과목 중 어디인지 알 수 없다.
  3. 그래프 — 과목이 노드의 자리(과목·분야)를 정하는데, 덩어리에는 과목이 없다.

파싱 단계에서는 과목 제목을 알고 있지만(`ParsedSection.title`), 지금까지는 저장할 때
`[과목] 본문` 꼴로 앞에 붙여 하나로 이어 붙였다. 그래서 이미 저장된 생기부에서도
그 표시를 되짚어 다시 가를 수 있다 — 이 모듈이 그 두 가지를 다 맡는다.
"""

from __future__ import annotations

import re

# `[국어]`, `[인공지능과 피지컬컴퓨팅]` 처럼 줄 첫머리에 오는 과목 표시.
# 줄 첫머리로 못박는 이유: 본문 가운데 대괄호가 나오는 일이 있는데(인용·기호),
# 그것까지 과목으로 보면 한 과목이 여러 조각으로 부서진다.
_MARKER = re.compile(r"(?:\A|\n)[ \t]*\[([^\[\]\n]{1,30})\][ \t]*")

# 과목 이름이 아닌 것을 걸러낸다 — 숫자만 있거나 문장이 통째로 들어온 경우.
_NOT_SUBJECT = re.compile(r"^\d+$|[.!?]")

MIN_BLOCKS = 2  # 하나뿐이면 가를 것이 없다.


def _looks_like_subject(name: str) -> bool:
    return bool(name) and not _NOT_SUBJECT.search(name)


def split_subject_blocks(content: str) -> list[tuple[str, str]]:
    """`[과목] 본문` 으로 이어 붙은 글을 `(과목, 본문)` 목록으로 가른다.

    같은 과목이 여러 번 나오면(학년이 다른 미술 3개처럼) 하나로 합친다. 과목마다
    카드 하나가 되어야지, 같은 과목이 세 장으로 늘어서면 목록이 학년표가 된다.

    표시가 없거나 하나뿐이면 빈 목록을 돌려준다 — 가를 이유가 없다는 뜻이다.
    """
    text = content or ""
    marks = [m for m in _MARKER.finditer(text) if _looks_like_subject(m.group(1).strip())]
    if len(marks) < MIN_BLOCKS:
        return []

    blocks: dict[str, list[str]] = {}
    order: list[str] = []

    # 첫 표시 앞에 글이 있으면 과목을 모르는 채로 남긴다. 버리지 않는다 —
    # 학생이 쓴 글을 정리한다는 이유로 없애면 안 된다.
    head = text[: marks[0].start()].strip()
    if head:
        order.append("")
        blocks[""] = [head]

    for i, mark in enumerate(marks):
        name = " ".join(mark.group(1).split())
        end = marks[i + 1].start() if i + 1 < len(marks) else len(text)
        body = text[mark.end() : end].strip()
        if not body:
            continue
        if name not in blocks:
            blocks[name] = []
            order.append(name)
        blocks[name].append(body)

    return [(name, "\n\n".join(blocks[name])) for name in order if blocks[name]]


def has_subject_blocks(content: str) -> bool:
    """가를 수 있는 덩어리인지."""
    return len(split_subject_blocks(content)) >= MIN_BLOCKS
