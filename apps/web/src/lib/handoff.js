/**
 * 다른 화면에서 대시보드로 넘기는 "이걸 물어봐 줘" 요청.
 *
 * 예전에는 `window.dispatchEvent` 만 썼는데, 탐구 피드에서 누르면 **이벤트가
 * 먼저 날아가고 대시보드가 그 다음에 그려져서** 아무 일도 일어나지 않았다
 * (아직 붙지 않은 리스너에게 소리친 셈이다).
 *
 * 그래서 값을 여기 잠깐 놔두고, 대시보드가 뜰 때 가져가게 한다. 한 번 가져가면
 * 비운다 — 다음에 대시보드에 들어올 때 옛날 질문이 다시 튀어나오면 안 된다.
 * 새로고침을 건너 살아남을 필요는 없으므로 저장소가 아니라 메모리에 둔다.
 */

let pending = null;

export function queueAsk(payload) {
  pending = payload;
  // 대시보드가 이미 떠 있으면 곧바로 반응하게 신호도 함께 보낸다
  window.dispatchEvent(new CustomEvent("mbx:ask-article", { detail: payload }));
}

export function takeAsk() {
  const value = pending;
  pending = null;
  return value;
}
