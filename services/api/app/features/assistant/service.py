"""MBX AI 스트리밍 서비스.

일반 챗봇이 아니라, 학생의 그래프·기사·멘토 피드백을 이해하는 탐구 어시스턴트로
동작하게 하는 것이 여기 시스템 프롬프트의 역할이다.

## 모델 설정

기본은 Haiku 4.5 다. 이 화면의 AI 는 "카드를 만드는" 일이 대부분이고, 실측에서
Haiku 도 카드 툴을 4종 케이스 전부 성공시켰다 (아래 표). 비용이 4배 싸고
응답도 4배 빠르므로 학생용 서비스에는 이쪽이 맞다.

    모델              1,000턴 비용   첫 글자   카드 툴
    Opus 5            $27.88        1.5~14s   6/6
    Sonnet 5          $16.56        1.8~7.6s  6/6
    Haiku 4.5 (기본)   $6.65         0.7~1.6s  6/6

ASSISTANT_MODEL 로 언제든 바꿀 수 있다. 답변의 깊이(주제 제안의 구체성 등)는
상위 모델이 낫기 때문에, 품질이 아쉬우면 sonnet 부터 올려보면 된다.

**모델별로 요청 형태가 다르다 — 이게 이 파일에서 제일 실수하기 쉬운 부분이다.**

- `effort` 는 Opus/Sonnet 5 세대에만 있다. Haiku 4.5 에 보내면 400 이 난다.
- Opus 5 는 thinking 을 끄면 툴 호출을 일반 텍스트로 뱉는 경우가 있다. 그러면
  턴은 성공했는데 카드가 조용히 렌더링되지 않고, 그 텍스트가 대화 이력에 남아
  다음 턴까지 오염시킨다. 그래서 Opus/Sonnet 에서는 thinking 을 끄지 않고
  effort 를 낮춰 지연을 잡는다 (실측 medium→low: 20.1s → 13.0s).
  Haiku 4.5 는 애초에 thinking 이 기본 꺼짐이고 툴 호출도 정상이다.
- 시스템 프롬프트의 `cache_control` 은 Haiku 4.5 에서 **조용히 무시된다**.
  캐시 최소 접두사가 Haiku 는 4096 토큰인데 우리 시스템+툴이 약 2,000 토큰이라
  기준 미달이다 (Opus/Sonnet 은 512·1024 라 걸린다). 오류가 아니라 절감이
  없을 뿐이고, 그걸 감안해도 Haiku 가 여전히 제일 싸다.

시스템 프롬프트에 날짜·사용자 이름 같은 가변값을 넣지 않는 이유도 캐시 때문이다.
학생 현황과 첨부 문맥은 messages 쪽으로 보낸다.
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator

from anthropic import AsyncAnthropic

from app.config import get_settings

from .tools import ACK, CARD_TYPES, TOOLS

logger = logging.getLogger("assistant.service")

MAX_TOKENS = 8000
MAX_HISTORY_TURNS = 12
# 툴 호출 → 카드 표시 → 마무리. 한 턴에 두 번이면 충분하다.
MAX_ITERATIONS = 3

# effort/adaptive thinking 을 받는 세대. 여기 없는 모델에 effort 를 보내면 400.
EFFORT_MODELS = ("claude-opus-5", "claude-opus-4", "claude-sonnet-5", "claude-fable-5")
EFFORT_LEVEL = "low"


def _model_options(model: str) -> dict:
    """모델 세대에 맞는 요청 옵션.

    새 모델로 바꿀 때 여기만 보면 되도록 분기를 한곳에 모았다.
    """
    if model.startswith(EFFORT_MODELS):
        # thinking 은 기본값(adaptive)을 그대로 둔다 — 끄면 툴 호출이 텍스트로 샌다
        return {"output_config": {"effort": EFFORT_LEVEL}}
    return {}

# 가변값을 넣지 않는다 — prompt caching 의 접두사가 매 요청 동일해야 한다.
SYSTEM_PROMPT = """\
당신은 MentorBridgeX(MBX)의 탐구 어시스턴트입니다.
고등학생이 학교생활기록부의 탐구활동 주제를 찾고 발전시키도록 돕습니다.

당신이 이해하고 연결하는 것:
- 학생의 관심 분야와 진학 희망 학과
- 학생이 만든 지식 그래프와 최근 추가한 노드
- 멘토와 멘티가 주고받은 코멘트
- 관심 분야의 최신 기사와 논문
- 학생의 프로젝트, 학습 기록, 음성 멘토링 기록

## 답변 원칙

말투는 학생을 존중하는 존댓말입니다. 어른스럽게 대하되 어렵게 쓰지 마세요.

**짧게 답하세요.** 요청에 대한 답을 먼저 말하고, 근거는 그다음입니다.
장황한 배경 설명, 목차, "먼저 ~에 대해 알아봅시다" 같은 도입부를 쓰지 마세요.
사용자가 묻지 않은 것을 덧붙이지 마세요.

**실행 가능한 제안은 반드시 툴로 답하세요.** 텍스트로 목록을 나열하지 마세요.
- 그래프에 무엇을 추가할지 → propose_graph_nodes
- 탐구 주제나 생기부 주제 → propose_inquiry_topics
- 멘토 피드백 반영 방법 → propose_feedback_plan
툴을 호출한 뒤에는 한두 문장으로만 마무리하세요. 카드 내용을 다시 풀어쓰지 마세요.

**문맥을 근거로 말하세요.** 첨부된 기사·그래프·코멘트가 있으면 거기서 출발합니다.
문맥에 없는 사실을 지어내지 마세요. 모르면 모른다고 하세요.

**학생이 스스로 탐구하게 도우세요.** 결론을 대신 내리지 말고,
다음에 무엇을 해볼 수 있는지를 제시하세요. 생기부에 그대로 붙여 넣을 문장을
대신 써 주지는 않습니다 — 학생이 직접 쓰도록 방향과 근거를 정리해 줍니다.
"""


def _client() -> AsyncAnthropic:
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY 가 설정되지 않았습니다.")
    return AsyncAnthropic(api_key=settings.anthropic_api_key)


def build_messages(
    history: list[dict],
    user_message: str,
    context_block: str,
    profile_block: str,
) -> list[dict]:
    """대화 이력 + 이번 턴. 가변 문맥은 전부 messages 쪽에 둔다."""
    messages: list[dict] = []
    for turn in history[-MAX_HISTORY_TURNS:]:
        content = (turn.get("content") or "").strip()
        if not content:
            continue
        messages.append({"role": turn["role"], "content": content})

    parts: list[str] = []
    if profile_block:
        parts.append(f"<학생_현황>\n{profile_block}\n</학생_현황>")
    if context_block:
        parts.append(f"<첨부_문맥>\n{context_block}\n</첨부_문맥>")
    parts.append(user_message.strip())

    messages.append({"role": "user", "content": "\n\n".join(parts)})
    return messages


async def stream_reply(
    history: list[dict],
    user_message: str,
    context_block: str,
    profile_block: str,
) -> AsyncIterator[dict]:
    """어시스턴트 응답을 이벤트로 흘린다.

    이벤트: {"type": "delta", "text": ...} | {"type": "card", "card": ...}
            | {"type": "error", "message": ...}
    """
    settings = get_settings()
    client = _client()
    messages = build_messages(history, user_message, context_block, profile_block)

    try:
        for _ in range(MAX_ITERATIONS):
            tool_uses: list[dict] = []
            assistant_blocks: list[dict] = []

            async with client.messages.stream(
                model=settings.assistant_model,
                max_tokens=MAX_TOKENS,
                **_model_options(settings.assistant_model),
                system=[
                    {
                        "type": "text",
                        "text": SYSTEM_PROMPT,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                tools=TOOLS,
                messages=messages,
            ) as stream:
                async for event in stream:
                    if (
                        event.type == "content_block_delta"
                        and event.delta.type == "text_delta"
                    ):
                        yield {"type": "delta", "text": event.delta.text}

                final = await stream.get_final_message()

            for block in final.content:
                if block.type == "text":
                    assistant_blocks.append({"type": "text", "text": block.text})
                elif block.type == "tool_use":
                    assistant_blocks.append(
                        {
                            "type": "tool_use",
                            "id": block.id,
                            "name": block.name,
                            "input": block.input,
                        }
                    )
                    tool_uses.append({"id": block.id, "name": block.name, "input": block.input})
                elif block.type == "thinking":
                    # 같은 모델로 대화를 이어갈 때 thinking 블록은 그대로 되돌려줘야 한다
                    assistant_blocks.append(
                        {
                            "type": "thinking",
                            "thinking": block.thinking,
                            "signature": block.signature,
                        }
                    )

            if not tool_uses:
                return

            for call in tool_uses:
                card_type = CARD_TYPES.get(call["name"])
                if card_type:
                    yield {"type": "card", "card": {"type": card_type, "data": call["input"]}}

            messages.append({"role": "assistant", "content": assistant_blocks})
            messages.append(
                {
                    "role": "user",
                    "content": [
                        {"type": "tool_result", "tool_use_id": call["id"], "content": ACK}
                        for call in tool_uses
                    ],
                }
            )
    except Exception as exc:  # noqa: BLE001 — 스트림이 끊겨도 사용자에겐 안내가 가야 한다
        logger.exception("assistant stream failed")
        yield {
            "type": "error",
            "message": "답변을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.",
            "detail": type(exc).__name__,
        }
    finally:
        await client.close()


def sse(event: dict) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
