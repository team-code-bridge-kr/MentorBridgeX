/**
 * 상단 AI 시작 영역.
 *
 * 화면의 중심은 입력창이고, 그 **바로 위**에 지금 확인할 것 세 장이 선다.
 * 카드를 페이지 맨 위(인사말 위)에 두면 "먼저 읽어야 하는 것"이 되어 버리는데,
 * 이 화면에서 먼저 할 일은 묻는 것이다. 카드는 물을 거리를 고르는 재료다.
 *
 * 회전하는 단어는 MBX 가 탐구 하나만 다루는 도구가 아님을 문구로 보여준다.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AIComposer } from "./AIComposer.jsx";
import { RecentActivitySummary } from "./RecentActivitySummary.jsx";
import { RotatingPromptLine } from "./RotatingPromptLine.jsx";
import { buildQuickActions } from "../../lib/quickActions.js";

const ROTATING = ["탐구", "보고서", "생기부", "실험", "독서", "프로젝트"];
const ROTATE_MS = 2600;

function RotatingWord() {
  const [i, setI] = useState(0);
  const [reduce, setReduce] = useState(false);
  const [width, setWidth] = useState(null);
  const wordRef = useRef(null);

  // 단어 폭을 실측해 슬롯 폭에 넣는다. 고정 폭이면 짧은 단어에서 좌우가 뜨고,
  // 폭을 안 잡으면 문장이 덜컹 튄다. 실측 + transition 이라야 매끄럽게 늘고 준다.
  // paint 전에 잡아야 한 프레임 겹침이 없으므로 useLayoutEffect 를 쓴다.
  useLayoutEffect(() => {
    if (wordRef.current) setWidth(wordRef.current.getBoundingClientRect().width);
  }, [i]);

  useEffect(() => {
    // 접근성: 모션을 줄이도록 설정한 사용자에게는 회전시키지 않는다
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = (e) => setReduce(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduce) return undefined;
    const t = setInterval(() => setI((v) => (v + 1) % ROTATING.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [reduce]);

  // 폰트 로딩이 끝나면 글자 폭이 달라진다 — 다시 잰다
  useEffect(() => {
    document.fonts?.ready?.then(() => {
      if (wordRef.current) setWidth(wordRef.current.getBoundingClientRect().width);
    });
  }, []);

  return (
    <span
      className="hero-word-slot"
      style={width != null ? { width: `${Math.ceil(width)}px` } : undefined}
    >
      <span ref={wordRef} key={i} className={`hero-word${reduce ? " is-static" : ""}`}>
        {ROTATING[i]}
      </span>
    </span>
  );
}

export function AIWorkspaceHero({
  userName,
  isNewUser,
  summary,
  articles,
  activity,
  onOpenActivity,
  onViewAllActivity,
  contextCards,
  prompts,
  onPickPrompt,
  draft,
  onDraftChange,
  onSubmit,
  onPickAction,
  context,
  onRemoveContext,
}) {
  // 빠른 실행은 입력창 안쪽 안내문 자리에서 하나씩 돌아간다 (알약 5개를 늘어놓지 않는다)
  const actions = useMemo(
    () => buildQuickActions({ summary, articles, isNewUser }),
    [summary, articles, isNewUser]
  );

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-glow" aria-hidden="true" />

      <div className="hero-inner">
        <p className="hero-greeting">
          안녕하세요! {userName}님 <span className="hero-wave" aria-hidden="true">👋</span>
        </p>
        {/* 스크린리더에는 회전 단어 대신 고정 문장을 읽힌다 */}
        <h1 className="hero-title" id="hero-title">
          <span className="sr-only">오늘은 어떤 탐구를 이어가 볼까요?</span>
          <span aria-hidden="true">
            오늘은 어떤 <RotatingWord />를 이어가 볼까요?
          </span>
        </h1>

        {/* 지금 확인할 것 — 입력창 바로 위에 둔다 */}
        {contextCards}

        <AIComposer
          value={draft}
          onChange={onDraftChange}
          onSubmit={onSubmit}
          context={context}
          onRemoveContext={onRemoveContext}
          actions={actions}
          onPickAction={onPickAction}
          autoFocus
        />

        <RotatingPromptLine prompts={prompts} onPick={onPickPrompt} />

        {/* 사이드바의 최근 활동과 **같은 데이터**다. 여기는 요약 진입점이라
            둘만 세우고 나머지는 전체 보기로 넘긴다. */}
        <RecentActivitySummary
          items={activity.items}
          loading={activity.loading}
          error={activity.error}
          onOpen={onOpenActivity}
          onViewAll={onViewAllActivity}
          onReload={activity.reload}
        />
      </div>
    </section>
  );
}
