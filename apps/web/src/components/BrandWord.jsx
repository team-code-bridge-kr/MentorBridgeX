/**
 * 문장 안에서 돌아가는 **브랜드 물결 낱말**.
 *
 * 대시보드 히어로("오늘은 어떤 **탐구**를 이어가 볼까요?")와 로그인 화면이
 * 같은 것을 쓴다. 두 화면에서 이름이 다르게 빛나면 같은 제품으로 안 읽힌다 —
 * 색은 `--brand-wave` 하나뿐이고, 그 규칙은 `.hero-word` 에 있다.
 *
 * 낱말 폭을 **실측해서** 슬롯에 넣는다. 고정 폭이면 짧은 낱말에서 좌우가 뜨고,
 * 폭을 아예 안 잡으면 낱말이 바뀔 때마다 문장이 덜컹 튄다. 실측 + transition
 * 이라야 매끄럽게 늘고 준다. paint 전에 재야 한 프레임도 겹치지 않으므로
 * `useLayoutEffect` 를 쓴다.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export function BrandWord({ words, intervalMs = 2600 }) {
  const [i, setI] = useState(0);
  const [reduce, setReduce] = useState(false);
  const [width, setWidth] = useState(null);
  const ref = useRef(null);

  useLayoutEffect(() => {
    if (ref.current) setWidth(ref.current.getBoundingClientRect().width);
  }, [i, words]);

  useEffect(() => {
    // 움직임을 줄이도록 설정한 사람에게는 돌리지 않는다. 첫 낱말만 선다.
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = (e) => setReduce(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduce || words.length < 2) return undefined;
    const t = setInterval(() => setI((v) => (v + 1) % words.length), intervalMs);
    return () => clearInterval(t);
  }, [reduce, words, intervalMs]);

  // 폰트가 늦게 뜨면 글자 폭이 달라진다 — 그때 다시 잰다.
  useEffect(() => {
    document.fonts?.ready?.then(() => {
      if (ref.current) setWidth(ref.current.getBoundingClientRect().width);
    });
  }, []);

  return (
    <span
      className="hero-word-slot"
      style={width != null ? { width: `${Math.ceil(width)}px` } : undefined}
    >
      <span ref={ref} key={i} className={`hero-word${reduce ? " is-static" : ""}`}>
        {words[i]}
      </span>
    </span>
  );
}
