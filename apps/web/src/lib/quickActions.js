/**
 * 빠른 실행 — "지금 이 학생이 누를 만한 일" 목록.
 *
 * 최근 활동이 있으면 일반 문구 대신 개인화된 문구를 만든다 — "내 그래프 확장하기"
 * 보다 "‘발음 평가’ 노드의 부족한 부분 찾기"가 다음 행동을 훨씬 명확하게 한다.
 * 하드코딩된 예시가 아니라 실제 그래프·기사·피드백에서 뽑는다.
 *
 * 예전에는 입력창 아래 알약 5개를 한 줄로 늘어놓았다. 지금은 **입력창 안쪽
 * 안내문 자리에서 한 번에 하나씩** 돌아간다(ComposerHint) — 다섯 개를 한꺼번에
 * 늘어놓으면 고르는 일이 되고, 정작 눌러야 할 입력창이 뒤로 밀린다.
 */

const BASE_ACTIONS = [
  { id: "articles", label: "오늘의 기사 추천", prompt: "오늘 내 관심 분야에서 읽어볼 만한 기사를 추천해줘." },
  { id: "graph", label: "내 그래프 확장하기", prompt: "내 지식 그래프에서 부족한 부분을 찾아 추가할 노드를 추천해줘." },
  { id: "topic", label: "새로운 탐구 주제 찾기", prompt: "내 관심 분야와 그래프를 보고 새로운 탐구 주제를 제안해줘." },
  { id: "comment", label: "멘토 코멘트 요약", prompt: "최근 받은 멘토 코멘트를 요약하고 무엇부터 반영해야 할지 알려줘." },
  { id: "record", label: "생기부 주제로 발전", prompt: "지금까지의 탐구를 생기부에 쓸 수 있는 주제로 발전시켜줘." },
];

const NEW_USER_ACTIONS = [
  { id: "onboard", label: "관심 분야 등록하기", nav: "S40" },
  { id: "seed", label: "첫 그래프 만들기", nav: "S09" },
  { id: "link", label: "자료 링크로 시작하기", prompt: "관심 있는 기사 링크를 분석해서 탐구 주제를 찾고 싶어. 어떻게 시작하면 될까?" },
  { id: "tour", label: "MBX 기능 둘러보기", prompt: "MBX로 무엇을 할 수 있는지 알려줘. 처음 쓰는 학생이야." },
];

/** 실제 데이터가 있을 때만 개인화 문구로 바꾼다. */
function personalize(summary, articles) {
  const actions = [...BASE_ACTIONS];
  const recentNode = summary?.graph?.recent_nodes?.[0];
  const feedback = summary?.pending_feedback?.[0];
  const article = articles?.[0];

  if (recentNode) {
    actions[1] = {
      id: "graph",
      label: `‘${recentNode}’ 확장하기`,
      prompt: `내 그래프의 ‘${recentNode}’ 노드를 중심으로 부족한 부분과 확장할 노드를 찾아줘.`,
    };
    actions[2] = {
      id: "topic",
      label: `‘${recentNode}’ 다음 주제`,
      prompt: `‘${recentNode}’를 출발점으로 다음 탐구 주제를 추천해줘.`,
    };
  }
  if (article) {
    actions[0] = {
      id: "articles",
      label: "기사를 그래프와 연결",
      prompt: "최근 읽을 만한 기사를 내 지식 그래프와 어떻게 연결하면 좋을지 알려줘.",
      context: { type: "article", id: article.id, label: article.title },
    };
  }
  if (feedback) {
    actions[3] = {
      id: "comment",
      label: `${feedback.author}님 피드백 반영`,
      prompt: "이 멘토 피드백을 반영하려면 무엇을 수정해야 할까?",
      context: { type: "comment", id: feedback.id, label: `${feedback.author}님의 피드백` },
    };
  }
  return actions;
}

export function buildQuickActions({ summary, articles, isNewUser }) {
  return isNewUser ? NEW_USER_ACTIONS : personalize(summary, articles);
}
