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
let pending = [];  // [{ id, message }]
let nextId = 1;

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
  // 여럿이 겹치면 마지막에 시작한 것을 보여준다 — 방금 누른 것이 궁금하다.
  const { message, center } = items[items.length - 1];

  return (
    <div className={`ldock${center ? " is-center" : ""}`} role="status" aria-live="polite">
      <span className="ldock-logo">
        <img src={mbxLogo} alt="" />
      </span>
      <span className="ldock-text">{message}</span>
      {items.length > 1 && <span className="ldock-more">외 {items.length - 1}</span>}
    </div>
  );
}
