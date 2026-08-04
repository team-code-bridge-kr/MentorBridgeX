/**
 * 확인할 피드백 — 가장 먼저 볼 것 하나.
 *
 * 전부 늘어놓으면 "몇 개 남았는지"만 알게 되고 무엇부터 할지는 여전히 모른다.
 * 개수는 제목 옆 숫자로 알리고, 본문에는 한 건만 둔다.
 *
 * **우선순위는 데이터가 허락하는 데까지만.** 설계안은 멘션 → 멘토 → 미답변
 * 질문 → 미해결 → 최신 순을 말하지만, 코멘트에는 멘션도, 작성자 역할 구분도,
 * 해결 여부도 없다(있는 것은 replied 뿐이고 API 가 이미 그걸로 거른다).
 * 그래서 지금은 **미답변 중 최신**이 첫 번째다. 없는 기준으로 정렬해 놓고
 * 우선순위가 있는 척하지 않는다.
 */

import { ContextButton, ContextCard, ContextEmpty, timeAgo } from "./ContextCard.jsx";

export function PendingFeedbackContextCard({ items, count, onNav, onAsk }) {
  const top = (items || [])[0];

  if (!top) {
    return (
      <ContextCard title="확인할 피드백">
        <ContextEmpty
          done
          title="모든 피드백을 확인했어요!"
          hint="새로운 코멘트가 등록되면 이곳에서 알려드릴게요."
        />
      </ContextCard>
    );
  }

  return (
    <ContextCard
      title="확인할 피드백"
      count={count}
      onViewAll={() => onNav("S24")}
      actions={
        <>
          <ContextButton onClick={() => onNav("S24")}>확인하기</ContextButton>
          <ContextButton primary onClick={() => onAsk(top)} label="이 피드백을 AI 문맥으로 첨부">
            AI에게 묻기
          </ContextButton>
        </>
      }
    >
      {/* 첫 줄은 "누가 어디에" 한 줄로 자른다 — 본문(코멘트)이 2줄을 갖는다 */}
      <p className="ctx-strong ctx-clamp-1">
        {top.target
          ? `${top.author}님이 ‘${top.target}’에 코멘트를 남겼어요.`
          : `${top.author}님이 코멘트를 남겼어요.`}
      </p>
      <p className="ctx-sub ctx-clamp-2">{top.excerpt}</p>
      <p className="ctx-sub ctx-sub-dim">{timeAgo(top.created_at)}</p>
    </ContextCard>
  );
}
