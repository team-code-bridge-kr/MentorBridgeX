/**
 * 상단 AI 시작 영역.
 *
 * 화면의 65~70%를 차지하되, 하단 카드의 윗부분이 살짝 보이도록 높이를 잡는다
 * (CSS 의 --hero-h). AI 입력창이 화면을 다 덮으면 MBX 가 단순 챗봇처럼 보인다.
 */

import { useEffect, useState } from "react";
import { AIComposer } from "./AIComposer.jsx";
import { QuickActionList } from "./QuickActionList.jsx";
import { RecentConversationList } from "./RecentConversationList.jsx";

// 돌아가는 단어 — MBX 가 탐구 하나만 다루는 도구가 아님을 문구로 보여준다
const ROTATING = ["탐구", "보고서", "생기부", "실험", "독서", "프로젝트"];
const ROTATE_MS = 2600;

function RotatingWord() {
  const [i, setI] = useState(0);
  const [reduce, setReduce] = useState(false);

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

  return (
    <span className="hero-word-slot">
      <span key={i} className={`hero-word${reduce ? " is-static" : ""}`}>
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
  conversations,
  draft,
  onDraftChange,
  onSubmit,
  onRunQuick,
  context,
  onRemoveContext,
  onAttachGraph,
  onAttachLink,
  onResume,
  onNav,
}) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-glow" aria-hidden="true" />

      <div className="hero-inner">
        <p className="hero-greeting">
          안녕하세요, {userName}님 <span className="hero-wave" aria-hidden="true">👋</span>
        </p>
        {/* 스크린리더에는 회전 단어 대신 고정 문장을 읽힌다 */}
        <h1 className="hero-title" id="hero-title">
          <span className="sr-only">오늘은 어떤 탐구를 이어가 볼까요?</span>
          <span aria-hidden="true">
            오늘은 어떤 <RotatingWord />를 이어가 볼까요?
          </span>
        </h1>
        <p className="hero-sub">
          관심 분야의 자료를 찾고, 지식 그래프를 확장하고, 멘토의 피드백을 반영해보세요.
        </p>

        <AIComposer
          value={draft}
          onChange={onDraftChange}
          onSubmit={onSubmit}
          context={context}
          onRemoveContext={onRemoveContext}
          onAttachGraph={onAttachGraph}
          onAttachLink={onAttachLink}
          autoFocus
        />

        <QuickActionList
          summary={summary}
          articles={articles}
          isNewUser={isNewUser}
          onRun={onRunQuick}
          onNav={onNav}
        />

        <RecentConversationList items={conversations} onResume={onResume} />
      </div>
    </section>
  );
}
