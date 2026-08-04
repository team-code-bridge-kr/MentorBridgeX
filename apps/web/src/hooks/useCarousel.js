/**
 * 한 번에 하나씩 보여주는 회전 목록.
 *
 * 대시보드에 회전하는 자리가 둘(관심 기사, 추천 질문)이라 로직을 화면에 직접
 * 쓰면 두 벌이 조금씩 달라진다. 여기 한 벌만 둔다.
 *
 * **자동 회전은 사람이 보고 있지 않을 때만 돈다.** 마우스를 올렸거나, 안에
 * 포커스가 있거나, 탭이 뒤로 갔으면 멈춘다. 읽는 중에 글이 바뀌면 회전이
 * 아니라 방해다.
 *
 * 모션을 줄이도록 설정한 사용자에게는 **멈추는 게 아니라 움직임만 없앤다**
 * (`reduce` 를 내려보내고 화면 쪽에서 전환 애니메이션을 끈다). 예전에는 회전
 * 자체를 멈췄는데, 그러면 그 설정을 켠 사람은 추천이 하나로 굳어 다른 문장을
 * 영영 못 본다 — 줄여 달라고 한 것은 움직임이지 내용이 아니다.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export function useCarousel(count, { auto = false, intervalMs = 8000 } = {}) {
  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(() => !document.hidden);
  const [reduce, setReduce] = useState(false);
  // 사용자가 직접 넘기면 타이머를 처음부터 다시 센다 — 방금 넘긴 화면이
  // 0.5초 만에 또 바뀌면 누른 보람이 없다.
  const [tick, setTick] = useState(0);
  const total = Math.max(0, count);
  const lastTotal = useRef(total);

  // 목록이 줄어 현재 위치가 범위를 벗어나면 되돌린다
  if (lastTotal.current !== total) {
    lastTotal.current = total;
    if (index >= total) setIndex(0);
  }

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = (e) => setReduce(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const go = useCallback(
    (next) => {
      if (total <= 0) return;
      setIndex(((next % total) + total) % total);
      setTick((t) => t + 1);
    },
    [total]
  );

  const next = useCallback(() => go(index + 1), [go, index]);
  const prev = useCallback(() => go(index - 1), [go, index]);

  const running = auto && total > 1 && !hovering && !focused && visible;

  useEffect(() => {
    if (!running) return undefined;
    const t = setTimeout(() => setIndex((i) => (i + 1) % total), intervalMs);
    return () => clearTimeout(t);
    // tick 이 바뀌면(수동 이동) 타이머를 다시 건다
  }, [running, total, intervalMs, index, tick]);

  /** 회전 영역에 그대로 펼쳐 넣는다 — 정지 조건을 화면마다 다시 쓰지 않게. */
  const pauseProps = {
    onMouseEnter: () => setHovering(true),
    onMouseLeave: () => setHovering(false),
    onFocusCapture: () => setFocused(true),
    onBlurCapture: () => setFocused(false),
  };

  return {
    index: total ? Math.min(index, total - 1) : 0,
    total,
    go,
    next,
    prev,
    running,
    reduce,
    pauseProps,
  };
}
