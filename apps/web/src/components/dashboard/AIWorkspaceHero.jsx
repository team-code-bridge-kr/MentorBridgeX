/**
 * 상단 AI 시작 영역.
 *
 * 화면의 중심은 입력창이고, 그 **바로 위**에 지금 확인할 것 세 장이 선다.
 * 카드를 페이지 맨 위(인사말 위)에 두면 "먼저 읽어야 하는 것"이 되어 버리는데,
 * 이 화면에서 먼저 할 일은 묻는 것이다. 카드는 물을 거리를 고르는 재료다.
 *
 * 회전하는 단어는 MBX 가 탐구 하나만 다루는 도구가 아님을 문구로 보여준다.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AIComposer } from "./AIComposer.jsx";
import { RecentActivitySummary } from "./RecentActivitySummary.jsx";
import { RotatingPromptLine } from "./RotatingPromptLine.jsx";
import { buildQuickActions } from "../../lib/quickActions.js";
import { BrandWord } from "../BrandWord.jsx";

// 로그인 화면과 **같은 부품**을 쓴다(components/BrandWord.jsx).
const ROTATING = ["탐구", "보고서", "생기부", "실험", "독서", "프로젝트"];

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
            오늘은 어떤 <BrandWord words={ROTATING} />를 이어가 볼까요?
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
