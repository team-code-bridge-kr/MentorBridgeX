/**
 * 추천 탐구 질문.
 *
 * 문장은 **실제 내 데이터에서 만든다.** 화면에 예시로 박아 둔 그래프 이름이
 * 남으면, 그 이름을 가진 적 없는 학생에게 남의 탐구를 권하는 꼴이 된다.
 * 그래서 재료(기사·그래프·피드백·최근 대화)가 없는 질문은 목록에서 빠진다.
 *
 * 각 질문은 카테고리(article/graph/feedback/topic)를 갖는다. 위쪽 기능 pill 이
 * "무엇을 할 것인가"를 고르면, 여기서 그에 맞는 문장만 남는다 — pill 과 추천
 * 질문이 같은 말을 두 번 하지 않도록 역할을 나눈 것이다.
 */

import { useMemo } from "react";

/**
 * 화면에 세울 분류. 앞의 셋이 기본이고, "탐구 주제 발전"은 뽑아 놓은 질문이
 * 있을 때만 나온다(pill 은 있는데 고를 문장이 없는 상태를 만들지 않는다).
 */
export const CATEGORIES = [
  { id: "article", label: "기사 탐색" },
  { id: "graph", label: "그래프 확장" },
  { id: "feedback", label: "피드백 반영" },
  { id: "topic", label: "탐구 주제 발전" },
];

/**
 * @param article  오늘의 관심 기사 중 지금 보고 있는 것 (없으면 null)
 * @param summary  대시보드 요약 (graph.recent_nodes, pending_feedback)
 * @param rootLabel 그래프 뿌리 노드 이름 = 사실상 그래프 제목 (없으면 null)
 */
export function useRecommendedPrompts({ article, summary, rootLabel, conversation }) {
  return useMemo(() => {
    const list = [];
    const graphName = rootLabel || null;
    const recentNode = summary?.graph?.recent_nodes?.[0] || null;
    const feedback = summary?.pending_feedback?.[0] || null;
    const hasGraph = (summary?.graph?.node_count ?? 0) > 0;

    if (article) {
      list.push({
        id: "article-link",
        category: "article",
        text: "이 기사를 내 그래프의 어느 노드에 연결할까요?",
        prompt: "이 기사를 읽고, 내 지식 그래프의 어느 노드에 어떻게 연결하면 좋을지 알려줘.",
        context: { type: "article", id: article.id, label: article.title },
      });
      list.push({
        id: "article-topic",
        category: "article",
        text: "이 기사에서 탐구 주제를 뽑아줘",
        prompt: "이 기사에서 고등학생이 직접 해볼 수 있는 탐구 주제를 뽑아줘.",
        context: { type: "article", id: article.id, label: article.title },
      });
    }

    if (hasGraph) {
      list.push({
        id: "graph-gap",
        category: "graph",
        text: graphName
          ? `‘${graphName}’의 부족한 영역을 찾아줘`
          : "내 그래프에서 부족한 영역을 찾아줘",
        prompt: "내 지식 그래프에서 아직 얕은 영역을 찾아, 무엇을 더 알아보면 좋을지 알려줘.",
        context: { type: "graph", id: null, label: graphName || "내 지식 그래프" },
      });
      list.push({
        id: "graph-next",
        category: "graph",
        text: recentNode
          ? `‘${recentNode}’ 다음 탐구 주제를 추천해줘`
          : "다음 탐구 주제를 추천해줘",
        prompt: recentNode
          ? `내 그래프의 ‘${recentNode}’를 출발점으로 다음 탐구 주제를 추천해줘.`
          : "내 지식 그래프를 보고 다음 탐구 주제를 추천해줘.",
        context: { type: "graph", id: null, label: graphName || "내 지식 그래프" },
      });
      list.push({
        id: "graph-record",
        category: "topic",
        text: "이 탐구를 생기부 주제로 발전시켜줘",
        prompt: "지금까지의 탐구를 생기부에 쓸 수 있는 주제로 발전시켜줘.",
        context: { type: "graph", id: null, label: graphName || "내 지식 그래프" },
      });
    }

    if (feedback) {
      list.push({
        id: "feedback-summary",
        category: "feedback",
        text: `${feedback.author}님의 피드백을 요약해줘`,
        prompt: "최근 받은 멘토 피드백을 요약하고 무엇부터 반영해야 할지 알려줘.",
        context: { type: "comment", id: feedback.id, label: `${feedback.author}님의 피드백` },
      });
      if (feedback.target) {
        list.push({
          id: "feedback-apply",
          category: "feedback",
          text: `‘${feedback.target}’를 어떻게 고칠까요?`,
          prompt: "이 피드백을 반영하려면 무엇을 어떻게 고쳐야 할지 알려줘.",
          context: { type: "comment", id: feedback.id, label: `${feedback.author}님의 피드백` },
        });
      }
    }

    if (conversation) {
      list.push({
        id: "resume",
        category: "topic",
        text: `‘${conversation.title}’ 이어서 물어보기`,
        prompt: "",
        resumeId: conversation.id,
      });
    }

    // 재료가 하나도 없는 새 사용자 — 그때만 일반 문장을 쓴다.
    // 여기서도 남의 그래프 이름을 지어내지 않는다.
    if (!list.length) {
      list.push(
        {
          id: "start-topic",
          category: "topic",
          text: "관심 분야에서 탐구 주제를 찾아줘",
          prompt: "내 관심 분야에서 고등학생이 해볼 만한 탐구 주제를 찾아줘.",
        },
        {
          id: "start-link",
          category: "article",
          text: "기사 링크를 붙여 넣으면 무엇을 해줄 수 있나요?",
          prompt: "기사 링크를 주면 무엇을 해줄 수 있는지 알려줘.",
        }
      );
    }

    return list;
  }, [article, summary, rootLabel, conversation]);
}
