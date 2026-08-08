/**
 * 기다리는 동안 뜨는 알림 — 화면 아래에 로고 하나와 한 줄.
 *
 * 오래 걸리는 일이 몇 가지 있다. 양식을 AI 가 쓰는 데 17초, 올린 양식을 채우는
 * 데 19초, 생기부 19쪽을 읽는 데 3~4초. 그동안 화면은 아무 말도 하지 않아서
 * "눌렸나?" 싶어 한 번 더 누르게 된다.
 *
 * 화면을 덮는 큰 스피너는 쓰지 않는다. 덮으면 그동안 아무것도 못 하고, 하던
 * 일이 어디까지였는지도 잃는다. 도크와 같은 자리·같은 재질로 아래에 얹는다.
 *
 * 여러 곳에서 동시에 부를 수 있어 **세어서** 관리한다. 하나가 끝났다고 남의
 * 알림까지 지우면, 아직 도는 일이 조용히 사라진 것처럼 보인다.
 */

import { useEffect, useState } from "react";
import mbxLogo from "../assets/brand/mbx_logo.png";

const EVENT = "mbx:loading";
let pending = [];  // [{ id, message, center?, note? }]
let nextId = 1;
// 끝난 소식이 스스로 사라지기까지. 읽을 만큼은 두되, 다음 일을 가리지 않는다.
const NOTE_MS = 6000;

function publish() {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: [...pending] }));
}

/**
 * 알림을 띄운다. 돌려주는 함수를 부르면 그 알림만 내려간다.
 *
 * `center` 는 화면에 이것 말고 아무것도 없을 때만 쓴다(구글 로그인 콜백처럼
 * 스쳐 가는 자리). 평소에는 아래에 두어야 하던 일을 가리지 않는다.
 */
export function showLoading(message = "잠시만요…", { center = false } = {}) {
  const id = nextId;
  nextId += 1;
  pending.push({ id, message, center });
  publish();
  return () => {
    pending = pending.filter((p) => p.id !== id);
    publish();
  };
}

/**
 * 다 된 뒤 잠깐 알리는 한 줄.
 *
 * "층을 다시 세웠습니다 — 교과 10개…" 같은 결과를 화면 위에 따로 띠로 붙이면,
 * 같은 일의 **진행(아래 알림)과 결과(위 띠)가 서로 다른 자리**에서 나온다.
 * 눈이 두 군데를 오가야 하고 모양도 제각각이다. 같은 자리에서 이어 받는다.
 */
export function showNote(message, { ms = NOTE_MS } = {}) {
  const id = nextId;
  nextId += 1;
  pending.push({ id, message, note: true });
  publish();
  const drop = () => {
    pending = pending.filter((p) => p.id !== id);
    publish();
  };
  setTimeout(drop, ms);
  return drop;
}

/**
 * 기다리는 동안만 띄우고 알아서 내린다.
 *
 * 성공이든 실패든 반드시 내려가야 한다 — 실패했는데 "쓰는 중" 이 남아 있으면
 * 학생은 계속 기다린다.
 */
export async function withLoading(message, run, options) {
  const done = showLoading(message, options);
  try {
    return await run();
  } finally {
    done();
  }
}

/**
 * 조건이 참인 동안만 알림을 띄운다.
 *
 * 화면마다 `if (loading) return <div>불러오는 중…</div>` 을 따로 쓰면 문구도
 * 모양도 제각각이 되고, 무엇보다 그 화면이 **통째로 사라진다** — 사이드바만
 * 남은 빈 화면은 고장으로 읽힌다. 있던 것은 그대로 두고 알림만 얹는다.
 */
export function useLoading(active, message, options) {
  const center = options?.center;
  useEffect(() => {
    if (!active) return undefined;
    return showLoading(message, center ? { center } : undefined);
  }, [active, message, center]);
}

export function LoadingDock() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const onChange = (e) => setItems(e.detail || []);
    window.addEventListener(EVENT, onChange);
    // 이 컴포넌트가 늦게 붙어도 이미 도는 일을 놓치지 않는다
    setItems([...pending]);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  if (!items.length) return null;
  // 도는 일이 있으면 그것이 먼저다. 끝난 소식보다 지금 도는 것이 급하다.
  // 도는 일이 없을 때만 마지막 소식을 보여준다.
  const running = items.filter((i) => !i.note);
  const { message, center, note } = (running.length ? running : items)[
    (running.length ? running : items).length - 1
  ];

  return (
    <div className={`ldock${center ? " is-center" : ""}${note ? " is-note" : ""}`} role="status" aria-live="polite">
      <span className="ldock-logo">
        <img src={mbxLogo} alt="" />
      </span>
      <span className="ldock-text">{message}</span>
      {items.length > 1 && <span className="ldock-more">외 {items.length - 1}</span>}
    </div>
  );
}
