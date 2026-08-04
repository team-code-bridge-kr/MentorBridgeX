"""활동 제목 만들기.

대화 제목은 첫 메시지를 그대로 잘라 만든다. 그래서 "하이", "이게 뭐하는거니??"
같은 것이 목록에 남는다 — 목록에서 그걸 보고 무엇을 하던 참인지 알 수가 없다.

여기서는 **무엇을 물었나(행동) + 무엇을 놓고 물었나(문맥)** 를 합쳐 제목을 만든다.
모델을 부르지 않는다. 규칙으로 만들면 같은 대화는 언제나 같은 제목이 나오고,
목록을 그릴 때마다 값이 흔들리지 않는다(그래서 따로 저장할 필요도 없다).
"""

from __future__ import annotations

import re

TITLE_MAX = 42
# 문맥 이름을 제목에 넣을 때의 길이. 논문 제목을 통째로 넣으면 한 줄을 다 먹는다.
CONTEXT_MAX = 22

# 이 정도면 "제목이 아니다"로 본다 — 인사·되묻기·한 낱말짜리 지시
_FILLER = re.compile(
    r"^(하이|하잉|안녕|안녕하세요|헬로|hi|hello|ㅎㅇ|ㅋㅋ+|ㅎㅎ+|테스트|test)\W*$",
    re.IGNORECASE,
)
_VAGUE = re.compile(
    r"(이게\s*뭐|뭐하는|무엇을\s*하는|알려줘|설명해줘|말해줘|어떻게\s*해|잘\s*모르겠)",
)

# 행동 → 제목 틀. 앞에 오는 것부터 본다(먼저 걸린 것이 이긴다).
_INTENTS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"(연결|이어붙|어느\s*노드|그래프에\s*추가)"), "{ctx} 지식 그래프에 연결"),
    (re.compile(r"(얕은|부족한|빈틈|약한\s*영역|보완)"), "{ctx}의 부족한 탐구 영역 찾기"),
    (re.compile(r"(확장|넓히|더\s*뻗)"), "{ctx} 확장하기"),
    (re.compile(r"(생기부|세특|기재)"), "{ctx}를 생기부 주제로 발전시키기"),
    (re.compile(r"(탐구\s*주제|주제를?\s*(뽑|추천|찾))"), "{ctx}에서 탐구 주제 찾기"),
    (re.compile(r"(요약|정리)"), "{ctx} 요약하기"),
    (re.compile(r"(피드백|코멘트).*(반영|수정|고치)"), "{ctx} 피드백 반영하기"),
    (re.compile(r"(비교|차이)"), "{ctx} 비교하기"),
    (re.compile(r"(실험|검증|설계)"), "{ctx} 실험 설계하기"),
]


def shorten(text: str, limit: int = CONTEXT_MAX) -> str:
    """제목에 넣을 만큼만 자른다. 자를 때는 낱말 경계를 지킨다."""
    clean = " ".join((text or "").split())
    if len(clean) <= limit:
        return clean
    cut = clean[:limit]
    # 마지막 공백에서 끊으면 낱말이 반 토막 나지 않는다. 너무 앞이면 그냥 자른다.
    space = cut.rfind(" ")
    if space > limit * 0.6:
        cut = cut[:space]
    return f"{cut}…"


def looks_meaningless(title: str) -> bool:
    """이 제목으로는 목록에서 무엇을 하던 건지 알 수 없다."""
    clean = " ".join((title or "").split())
    if len(clean) < 6:
        return True
    if _FILLER.match(clean):
        return True
    if _VAGUE.search(clean):
        return True
    # 물음표·느낌표만 남는 문장
    return not re.search(r"[가-힣A-Za-z0-9]{2,}", clean)


def compose(first_message: str, context_label: str | None) -> str | None:
    """행동 + 문맥으로 제목을 만든다. 만들 수 없으면 None."""
    if not context_label:
        return None
    ctx = shorten(context_label)
    body = " ".join((first_message or "").split())
    for pattern, template in _INTENTS:
        if pattern.search(body):
            return shorten(template.format(ctx=ctx), TITLE_MAX)
    # "이게 뭐하는거니??" 처럼 되묻는 말은 대개 그 자료를 이해하려는 것이다
    if _VAGUE.search(body) or _FILLER.match(body):
        return shorten(f"{ctx} 이해하기", TITLE_MAX)
    # 행동을 못 읽었어도 문맥은 안다 — 적어도 무엇을 놓고 이야기했는지는 남긴다
    return shorten(f"{ctx} 살펴보기", TITLE_MAX)


def resolve(
    *,
    override: str | None,
    stored_title: str | None,
    first_message: str | None,
    context_label: str | None,
) -> str:
    """제목 우선순위: 사용자가 바꾼 것 → 문맥+행동 조합 → 저장 제목 → 첫 메시지.

    **조합이 저장 제목보다 앞선다.** 대화 제목은 서버가 첫 메시지를 60자로 자른
    것이라(assistant `_title_from`), 사실상 "첫 메시지"와 같은 값이다. 그걸
    "이미 만들어진 제목"으로 대접하면 목록에 늘 첫 문장이 그대로 남는다.
    """
    if override:
        return shorten(override, TITLE_MAX)

    built = compose(first_message or stored_title, context_label)
    if built:
        return built

    stored = " ".join((stored_title or "").split())
    if stored and not looks_meaningless(stored):
        return shorten(stored, TITLE_MAX)

    # 마지막 수단. 문맥도 없고 행동도 못 읽었으면 첫 메시지라도 보여준다.
    return shorten(stored or (first_message or "새 대화"), TITLE_MAX)
