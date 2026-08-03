"""어시스턴트 결과 카드 툴.

AI 가 텍스트만 길게 출력하지 않게 하는 장치다. 실행 가능한 제안은 툴 호출로
받아 프론트에서 **행동 버튼이 달린 카드**로 렌더링한다.

이 툴들은 서버에서 아무것도 실행하지 않는다 — 렌더링 지시일 뿐이라, 호출되면
"표시했다"는 tool_result 를 즉시 돌려주고 모델이 짧게 마무리하게 한다.
실제 행동(노드 생성, 기사 저장)은 사용자가 카드의 버튼을 눌렀을 때 기존
graph/research API 로 수행된다.
"""

from __future__ import annotations

CARD_GRAPH_NODES = "propose_graph_nodes"
CARD_INQUIRY = "propose_inquiry_topics"
CARD_FEEDBACK = "propose_feedback_plan"

TOOLS = [
    {
        "name": CARD_GRAPH_NODES,
        "description": (
            "지식 그래프에 추가할 노드를 제안할 때 호출한다. "
            "사용자가 그래프 확장·부족한 영역·연결할 개념을 물으면 반드시 이 툴로 답한다. "
            "설명을 길게 쓰지 말고 이 툴을 호출해 카드로 보여줄 것."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "nodes": {
                    "type": "array",
                    "description": "제안 노드 3~6개",
                    "items": {
                        "type": "object",
                        "properties": {
                            "label": {"type": "string", "description": "노드 이름 (2~20자)"},
                            "kind": {
                                "type": "string",
                                "enum": ["root", "topic", "leaf"],
                                "description": "핵심/연결/말단 노드",
                            },
                            "reason": {
                                "type": "string",
                                "description": "왜 이 노드인지 한 문장",
                            },
                            "connect_to": {
                                "type": "string",
                                "description": "연결할 기존 노드 이름 (없으면 생략)",
                            },
                        },
                        "required": ["label", "kind", "reason"],
                    },
                },
            },
            "required": ["nodes"],
        },
    },
    {
        "name": CARD_INQUIRY,
        "description": (
            "탐구 주제나 생기부 활동 주제를 제안할 때 호출한다. "
            "'새로운 탐구 주제', '생기부 주제로 발전' 요청은 반드시 이 툴로 답한다."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "topics": {
                    "type": "array",
                    "description": "주제 2~4개",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string", "description": "탐구 주제 제목"},
                            "subject": {"type": "string", "description": "관련 교과나 분야"},
                            "rationale": {
                                "type": "string",
                                "description": "이 학생에게 왜 맞는지 한두 문장",
                            },
                            "first_step": {
                                "type": "string",
                                "description": "제일 먼저 할 일 한 가지",
                            },
                        },
                        "required": ["title", "rationale"],
                    },
                },
            },
            "required": ["topics"],
        },
    },
    {
        "name": CARD_FEEDBACK,
        "description": (
            "멘토 코멘트를 반영하는 방법을 제시할 때 호출한다. "
            "코멘트 문맥이 붙은 질문에는 반드시 이 툴로 체크리스트를 만들어 답한다."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "summary": {"type": "string", "description": "피드백 핵심 한 문장"},
                "steps": {
                    "type": "array",
                    "description": "실행 단계 2~5개",
                    "items": {
                        "type": "object",
                        "properties": {
                            "action": {"type": "string", "description": "할 일"},
                            "detail": {"type": "string", "description": "구체적으로 무엇을"},
                        },
                        "required": ["action"],
                    },
                },
                "reply_draft": {
                    "type": "string",
                    "description": "멘토에게 보낼 답글 초안 (2~3문장)",
                },
            },
            "required": ["summary", "steps"],
        },
    },
]

# 툴 이름 → 프론트 카드 타입
CARD_TYPES = {
    CARD_GRAPH_NODES: "graph_nodes",
    CARD_INQUIRY: "inquiry_topics",
    CARD_FEEDBACK: "feedback_plan",
}

ACK = "카드를 사용자 화면에 표시했습니다. 한두 문장으로만 짧게 마무리하세요."
