"""양식을 학생의 **실제 기록**으로 채운다.

여태 양식 생성은 그래프 노드 이름을 문장 틀에 끼워 넣는 것이었다.
"○○ 학생은 빅데이터를 중심으로 A, B, C에 대해 탐구하였습니다" — 누구에게나
들어맞는 문장이라 그대로 낼 수 없고, 결국 학생이 처음부터 다시 썼다.

여기서는 저장된 생기부 글을 근거로 쓴다. 두 갈래다.

1. **요약 보고서** — 세특·동아리·진로·독서·봉사 중 해당 영역의 글을 모아
   보고서 한 편으로 정리한다.
2. **올린 양식 채우기** — 학교가 준 양식 파일에서 물음 항목을 찾아내
   항목마다 답을 쓴다.

두 경우 모두 **지어내지 않는 것**이 첫 번째 규칙이다. 기록에 없는 활동·수상·
숫자를 만들어 내면 그 문서는 쓸 수 없을 뿐 아니라 위험하다. 근거가 모자라면
모자라다고 적게 한다.

**자기소개서는 없다.** 2024학년도 대입부터 폐지됐고, 남아 있더라도 남이 써 준
자기소개서를 내는 일을 거들 이유가 없다.
"""

from __future__ import annotations

import logging
import re

from app.schemas.documents import DocumentSection, SectionType

logger = logging.getLogger(__name__)

# 양식마다 근거로 삼을 생기부 영역.
SECTION_FOR_TEMPLATE: dict[str, tuple[SectionType, ...]] = {
    "setuk": (SectionType.SUBJECT_SPECIFIC,),
    "club": (SectionType.CLUB,),
    "career": (SectionType.CAREER,),
    "reading": (SectionType.READING,),
    "volunteer": (SectionType.VOLUNTEER,),
}

# 한 번에 넘길 근거 글자 수. 생기부 전체는 4만 자가 넘어서 그대로 넣으면
# 비싸고 느리며, 정작 필요한 영역이 묻힌다.
MAX_EVIDENCE = 12000
# 올린 양식에서 찾아 채울 항목 수. 이보다 많으면 양식이 아니라 문제집이다.
MAX_PROMPTS = 10
# 항목 한 줄의 길이 상한. 이보다 길면 물음이 아니라 본문이다.
PROMPT_MAX_LEN = 160

# 물음처럼 끝나는 말. 학교 양식은 거의 이 꼴이다.
_ASKS = re.compile(
    r"(하시오|하십시오|해\s*주세요|쓰시오|적으시오|서술|기술|작성|설명|소개|"
    r"이유는|무엇인가|어떻게|기재)\s*[.。]?\s*$"
)
# 번호·기호로 시작하는 항목 줄
_NUMBERED = re.compile(r"^\s*(?:[0-9]{1,2}[.)]|[가-힣][.)]|[Q□■▶●・*-])\s*\S")
# 빈칸 표시
_BLANK = re.compile(r"[_＿]{3,}|\(\s*\)|\[\s*\]")
# 글자 수 제한 — 지시에 그대로 넘긴다
_LIMIT = re.compile(r"\(?\s*(\d{2,4})\s*자\s*(이내|내외|이하|까지)?\s*\)?")


def evidence_of(
    sections: list[DocumentSection], types: tuple[SectionType, ...] | None = None
) -> str:
    """근거로 넘길 생기부 글. 영역을 정하지 않으면 전부에서 고르게 모은다."""
    wanted = [
        s for s in sections
        if s.content and s.content != "(작성 시작)" and (types is None or s.section_type in types)
    ]
    if not wanted and types is not None:
        wanted = [s for s in sections if s.content and s.content != "(작성 시작)"]

    # 영역을 돌아가며 담는다. 앞에서부터 자르면 세특 42과목이 자리를 다 먹고
    # 동아리·진로가 한 줄도 못 들어간다.
    buckets: dict[str, list[DocumentSection]] = {}
    for s in wanted:
        buckets.setdefault(str(s.section_type), []).append(s)

    out: list[str] = []
    total = 0
    while buckets and total < MAX_EVIDENCE:
        progressed = False
        for key in list(buckets):
            if not buckets[key]:
                buckets.pop(key)
                continue
            s = buckets[key].pop(0)
            head = " ".join(x for x in [s.period_id, s.subject_id] if x) or str(s.section_type)
            block = f"[{head}]\n{s.content.strip()}"
            if total + len(block) > MAX_EVIDENCE:
                buckets.pop(key)
                continue
            out.append(block)
            total += len(block)
            progressed = True
        if not progressed:
            break
    return "\n\n".join(out)


def find_prompts(text: str) -> list[str]:
    """올린 양식에서 채워야 할 항목을 찾는다.

    규칙만 쓴다 — 어떤 줄이 물음인지는 눈으로 봐도 뻔하고, 여기에 LLM 을 쓰면
    양식 한 장에 두 번 부르게 된다.
    """
    found: list[str] = []
    for raw in (text or "").splitlines():
        line = raw.strip()
        if not line or len(line) > PROMPT_MAX_LEN:
            continue
        if _ASKS.search(line) or _BLANK.search(line) or (_NUMBERED.match(line) and len(line) >= 6):
            # 같은 물음이 두 번 적힌 양식이 흔하다(목차 + 본문)
            if line not in found:
                found.append(line)
        if len(found) >= MAX_PROMPTS:
            break
    return found


def _limit_of(prompt: str) -> str:
    hit = _LIMIT.search(prompt)
    return f"{hit.group(1)}자 이내" if hit else "400자 안팎"


_RULES = (
    "규칙\n"
    "- **기록에 없는 것을 지어내지 마세요.** 활동·수상·숫자·기관명을 새로 만들면 안 됩니다.\n"
    "- 근거가 모자라면 억지로 채우지 말고 '기록이 부족합니다: (무엇이 필요한지)' 라고 적으세요.\n"
    "- 생기부 문장을 그대로 옮기지 말고, 사실은 그대로 두되 문장은 새로 쓰세요.\n"
    "- 과장하지 마세요. '뛰어난', '탁월한' 같은 평가는 교사가 쓴 기록에 있을 때만 인용하세요.\n"
    "- 담백한 서술체로 쓰고, 머리말·맺음말 같은 군더더기를 넣지 마세요."
)


def report_prompt(title: str, description: str, name: str, evidence: str) -> str:
    return (
        f"아래는 {name} 학생의 생활기록부에서 뽑은 기록입니다.\n\n"
        f"{evidence}\n\n"
        f"이 기록만을 근거로 '{title}' 를 쓰세요. ({description})\n\n"
        f"{_RULES}\n"
        "- 소제목을 두어 3~4단락으로 정리하세요.\n\n"
        "본문만 출력하세요."
    )


def fill_prompt(prompts: list[str], name: str, evidence: str) -> str:
    asks = "\n".join(f"{i + 1}. {p}  (분량: {_limit_of(p)})" for i, p in enumerate(prompts))
    return (
        f"아래는 {name} 학생의 생활기록부에서 뽑은 기록입니다.\n\n"
        f"{evidence}\n\n"
        f"학교에서 받은 양식의 항목입니다. 항목마다 답을 쓰세요.\n\n{asks}\n\n"
        f"{_RULES}\n\n"
        "출력 형식: 항목마다 원래 문구를 그대로 제목으로 쓰고, 그 아래 답을 쓰세요.\n"
        "다른 설명은 붙이지 마세요."
    )


def fallback_report(title: str, name: str, evidence: str) -> str:
    """AI 를 못 쓸 때. **지어내지 않고**, 무엇을 해야 하는지만 알린다.

    예전에는 여기서 그럴듯한 문장을 만들어 냈다. 그런데 그 문장은 근거가 없어서
    학생이 그대로 낼 수 없고, 낼 수 없는 글을 만들어 주는 것은 도움이 아니다.
    """
    head = f"# {title} — {name}\n\n"
    if not evidence:
        return head + "생기부 기록이 없어 초안을 만들 수 없습니다. 먼저 생기부를 올려 주세요.\n"
    return (
        head
        + "AI 작성을 지금 쓸 수 없어 **근거 기록만 모아** 두었습니다.\n"
        "아래를 바탕으로 직접 정리하거나, 잠시 뒤 다시 생성해 보세요.\n\n"
        + evidence
    )
