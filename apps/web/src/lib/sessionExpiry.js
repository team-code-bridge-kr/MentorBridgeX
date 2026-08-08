/**
 * 로그인 시간이 다 되면 스스로 나가게 한다.
 *
 * 토큰은 12시간짜리다. 여태 화면은 그 사실을 몰라서, 시간이 지나면 무엇을 눌러도
 * "유효하지 않은 토큰입니다" 만 뜨고 **로그인한 것처럼 보이는 채로 아무것도 안
 * 됐다.** 학생은 왜 안 되는지 알 수 없고, 로그아웃을 직접 찾아 눌러야 했다.
 *
 * 두 갈래로 잡는다.
 *
 * 1. **미리** — 토큰 안에 만료 시각이 적혀 있다. 열 때 지났으면 바로 내보내고,
 *    안 지났으면 그 시각에 맞춰 알람을 걸어 둔다. 가만히 있어도 때가 되면 나간다.
 * 2. **뒤늦게** — 그래도 401 이 오면(서버에서 지웠거나 시계가 어긋났거나) 그때
 *    내보낸다. 미리 재는 것만 믿으면 서버가 먼저 끊은 경우를 놓친다.
 *
 * 나갈 때는 **왜 나갔는지** 를 남긴다. 아무 말 없이 로그인 화면이 뜨면 고장으로
 * 읽힌다.
 */

const REASON_KEY = "mbx_signed_out_reason";
export const SESSION_EXPIRED = "mbx:session-expired";

// 만료 몇 초 전에 미리 내보낼지. 딱 맞춰 두면 마지막 요청이 반쯤 실패한다.
const LEAD_SEC = 10;
// setTimeout 이 견디는 한계(약 24.8일)를 넘으면 즉시 실행돼 버린다.
const MAX_TIMEOUT = 2 ** 31 - 1;

let timer = null;
let fired = false;

/** JWT 의 만료 시각(초). 못 읽으면 null — 못 읽는다고 내보내지는 않는다. */
export function expiryOf(token) {
  try {
    const part = String(token || "").split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const exp = JSON.parse(json)?.exp;
    return typeof exp === "number" ? exp : null;
  } catch {
    return null;
  }
}

/** 로그인 화면에서 한 번 읽고 지운다. 다음에 또 뜨면 거짓말이 된다. */
export function takeSignOutReason() {
  try {
    const reason = sessionStorage.getItem(REASON_KEY);
    if (reason) sessionStorage.removeItem(REASON_KEY);
    return reason;
  } catch {
    return null;
  }
}

/**
 * 세션을 끝낸다. 여러 요청이 한꺼번에 401 을 받아도 한 번만 돈다.
 */
export function expireSession(reason = "로그인 시간이 지났습니다. 다시 로그인해 주세요.") {
  if (fired) return;
  fired = true;
  clearTimer();
  try { sessionStorage.setItem(REASON_KEY, reason); } catch { /* 사생활 보호 모드 */ }
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED, { detail: { reason } }));
}

export function clearTimer() {
  if (timer) { clearTimeout(timer); timer = null; }
}

/**
 * 토큰의 만료 시각에 맞춰 알람을 건다.
 *
 * 이미 지났으면 곧바로 내보낸다 — 새로고침해서 들어온 경우가 여기다.
 * 돌려주는 값은 "지금 쓸 수 있는 토큰인가".
 */
export function armExpiry(token) {
  clearTimer();
  fired = false;
  const exp = expiryOf(token);
  if (exp === null) return true;  // 만료 시각이 없는 토큰(개발용 등)은 건드리지 않는다

  const ms = (exp - LEAD_SEC) * 1000 - Date.now();
  if (ms <= 0) {
    expireSession();
    return false;
  }
  if (ms < MAX_TIMEOUT) {
    timer = setTimeout(() => expireSession(), ms);
  }
  return true;
}
