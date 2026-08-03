/**
 * 상단 AI 시작 영역.
 *
 * 화면의 65~70%를 차지하되, 하단 카드의 윗부분이 살짝 보이도록 높이를 잡는다
 * (CSS 의 --hero-h). AI 입력창이 화면을 다 덮으면 MBX 가 단순 챗봇처럼 보인다.
 */

import { AIComposer } from "./AIComposer.jsx";
import { QuickActionList } from "./QuickActionList.jsx";
import { RecentConversationList } from "./RecentConversationList.jsx";

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
        <p className="hero-greeting">안녕하세요, {userName}님</p>
        <h1 className="hero-title" id="hero-title">오늘은 어떤 탐구를 이어가 볼까요?</h1>
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
