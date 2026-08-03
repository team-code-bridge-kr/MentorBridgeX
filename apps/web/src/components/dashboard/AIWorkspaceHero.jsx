/**
 * AI 탐구 영역 — 이 화면의 중심.
 *
 * 상단 문맥 카드가 "지금 무엇이 있는지"를 알려주면, 여기서 그걸 가지고 실제로
 * 묻는다. 그래서 남은 화면 높이를 전부 이 영역이 가져간다(CSS 의 .hero flex:1).
 *
 * **여기서는 아무것도 저절로 움직이지 않는다.** 예전에는 제목의 단어가 계속
 * 바뀌었는데, 위쪽 기사 카드가 이미 8초마다 도는 상황에서 움직이는 자리가 둘이면
 * 글을 쓰려던 사람의 시선이 계속 끌려간다. 제목은 고정이고, 최근 탐구가 있으면
 * 그 이름을 넣는다(없으면 넣지 않는다 — 잘린 이름을 보여주지 않기 위해서다).
 */

import { AIComposer } from "./AIComposer.jsx";
import { RecommendedPromptCarousel } from "./RecommendedPromptCarousel.jsx";
import { ExplorationCategoryPills } from "./ExplorationCategoryPills.jsx";
import { RecentConversationList } from "./RecentConversationList.jsx";

export function AIWorkspaceHero({
  topic,
  draft,
  onDraftChange,
  onSubmit,
  context,
  onRemoveContext,
  prompts,
  category,
  onCategory,
  onPickPrompt,
  conversations,
  conversationsLoading,
  onResume,
}) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-glow" aria-hidden="true" />

      <div className="hero-inner">
        <h1 className="hero-title" id="hero-title">
          {topic ? (
            <>
              오늘은 <span className="hero-accent">‘{topic}’</span> 탐구를 이어가 볼까요?
            </>
          ) : (
            <>
              오늘은 어떤 <span className="hero-accent">탐구</span>를 이어가 볼까요?
            </>
          )}
        </h1>

        <AIComposer
          value={draft}
          onChange={onDraftChange}
          onSubmit={onSubmit}
          context={context}
          onRemoveContext={onRemoveContext}
          autoFocus
        />

        <RecommendedPromptCarousel prompts={prompts} onPick={onPickPrompt} />
        <ExplorationCategoryPills prompts={prompts} active={category} onSelect={onCategory} />
        <RecentConversationList
          items={conversations}
          loading={conversationsLoading}
          onResume={onResume}
        />
      </div>
    </section>
  );
}
