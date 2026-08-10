"""모델이 돌려준 글에서 JSON 을 읽어 내기.

「다음 탐구」가 **늘 빈손**이었던 자리다. 모델은 제대로 답하는데 토큰 한계
(512)에서 문장이 끊겨 JSON 이 깨졌고, 깨진 것은 통째로 버려서 화면에는 늘
아무것도 안 갔다 — 눌러 놓고 기다렸는데 아무 일도 안 일어나는 자리.

한계를 늘렸지만 그래도 넘길 수 있다. 넘겼을 때 **받아 놓은 만큼은 건지는**
것이 여기 테스트의 요점이다.
"""

from app.adapters.ml_real import _parse_json


def test_그냥_JSON():
    assert _parse_json('{"suggestions": [{"label": "큐비트"}]}')["suggestions"][0]["label"] == "큐비트"


def test_마크다운_울타리를_벗긴다():
    text = '```json\n{"suggestions": [{"label": "탄소중립"}]}\n```'
    assert _parse_json(text)["suggestions"][0]["label"] == "탄소중립"


def test_앞뒤에_말이_붙어_있어도_읽는다():
    text = '알겠습니다.\n{"suggestions": [{"label": "수질 관리"}]}\n도움이 되었길 바랍니다.'
    assert _parse_json(text)["suggestions"][0]["label"] == "수질 관리"


def test_중간에_끊겨도_온전한_것은_건진다():
    # 실제로 났던 모양: 셋째 항목의 rationale 을 쓰다가 잘렸다.
    text = (
        '```json\n{\n "suggestions": [\n'
        '  {"label": "미세플라스틱 수처리", "confidence": 0.95, "rationale": "수질오염 해결"},\n'
        '  {"label": "탄소중립 건축자재", "confidence": 0.92, "rationale": "탄소배출 감축"},\n'
        '  {"label": "토양오염 복원", "confidence": 0.9, "rationale": "산업폐기물로 인한'
    )
    got = _parse_json(text)["suggestions"]
    assert [s["label"] for s in got] == ["미세플라스틱 수처리", "탄소중립 건축자재"]


def test_따옴표_안의_중괄호에_속지_않는다():
    text = '{"suggestions": [{"label": "표기 {중괄호} 실험", "rationale": "가"}]}'
    assert _parse_json(text)["suggestions"][0]["label"] == "표기 {중괄호} 실험"


def test_건질_것이_없으면_빈_사전():
    # label 이 없는 조각은 항목이 아니다 — 껍데기를 항목으로 착각하면 안 된다.
    assert _parse_json("죄송합니다. 추천할 수 없습니다.") == {}
    assert _parse_json('{"suggestions": [') == {}
