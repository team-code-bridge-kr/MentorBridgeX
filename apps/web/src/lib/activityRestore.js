/**
 * 최근 활동 "이어서 하기".
 *
 * 목록의 한 줄은 링크가 아니라 **그때의 작업 상태**다. 눌렀을 때 화면만 바뀌고
 * 문맥이 비어 있으면, 사용자는 기사를 다시 찾아 다시 붙여야 한다 — 그러면
 * 최근 활동을 쓸 이유가 없다.
 *
 * 복원 규칙:
 * - 대화가 있으면 → 대시보드에서 그 대화를 열고, 쓰던 문맥을 다시 붙인다.
 * - 대화는 없지만 문맥이 있으면(기사·그래프·피드백) → 그 문맥을 붙인 채 새 대화.
 * - 문맥도 없으면(문서·양식·음성) → 그 화면으로 간다.
 */

import { queueRestore } from "./handoff.js";

const DASHBOARD = "S05";
// 대화로 이어가는 편이 자연스러운 유형. 문서·양식·음성은 그 화면에서 이어간다.
const CHAT_TYPES = new Set(["conversation", "mixed", "article", "paper", "graph", "feedback"]);

/**
 * 대화가 없는 활동을 열었을 때 입력창에 채워 둘 질문.
 *
 * 문맥만 조용히 붙이면 눌러도 아무 일이 없는 것처럼 보인다 — 화면은 대시보드
 * 그대로고, 작게 칩 하나가 늘어날 뿐이다. 그래서 **무엇을 물을지까지** 채워 둔다.
 * 문구는 상단 문맥 카드의 "AI에게 질문"과 같은 것을 쓴다(같은 행동은 같은 문장).
 */
const OPENERS = {
  article: "이 기사를 요약하고 내 그래프와 어떻게 연결할지 알려줘.",
  paper: "이 논문을 요약하고 내 그래프와 어떻게 연결할지 알려줘.",
  graph: "이 그래프에서 부족한 탐구 영역을 찾아줘.",
  feedback: "이 피드백을 반영하려면 무엇을 수정해야 해?",
};

export function restoreActivity(activity, onNav) {
  const target = activity?.restore_target || {};
  const contexts = target.contexts || [];

  if (target.conversation_id) {
    queueRestore({ conversationId: target.conversation_id, contexts });
    onNav(DASHBOARD);
    return;
  }
  if (contexts.length && CHAT_TYPES.has(target.type)) {
    queueRestore({
      conversationId: null,
      contexts,
      draft: OPENERS[activity.primary_type] || OPENERS[target.type] || "",
    });
    onNav(DASHBOARD);
    return;
  }
  onNav(target.route || DASHBOARD);
}

/** 활동을 원래 화면(그래프·피드·멘토링…)에서 열기 — 더보기 메뉴의 "상세 보기" */
export function activityDetailRoute(activity) {
  return activity?.restore_target?.route || null;
}
