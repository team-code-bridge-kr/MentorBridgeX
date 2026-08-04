/**
 * 활동 유형의 표시 규칙 — 한 곳에서만 정한다.
 *
 * 사이드바·대시보드·전체 보기 세 곳이 같은 목록을 그리므로, 아이콘과 이름이
 * 여기 없으면 세 벌이 조금씩 달라진다.
 *
 * **색으로 유형을 구분하지 않는다.** 유형마다 다른 색을 칠하면 목록이 알록달록해져
 * 주요 메뉴보다 강해지고, 색을 못 보는 사람에게는 아무 정보도 되지 않는다.
 * 구분은 아이콘과 글자가 한다.
 */

export const ACTIVITY_TYPES = {
  conversation: { label: "대화", icon: "comment" },
  article: { label: "기사", icon: "bookOpen" },
  paper: { label: "논문", icon: "text" },
  graph: { label: "그래프", icon: "graph" },
  feedback: { label: "피드백", icon: "comment" },
  document: { label: "문서", icon: "record" },
  form: { label: "양식", icon: "form" },
  voice: { label: "음성", icon: "voice" },
  mixed: { label: "복합", icon: "sparkle" },
};

/** 목록 위의 필터. `all` 이 기본이고 탭으로 늘어놓지 않는다. */
export const ACTIVITY_FILTERS = [
  { id: "all", label: "전체" },
  { id: "conversation", label: "AI 대화" },
  { id: "reading", label: "기사·논문" },
  { id: "graph", label: "지식 그래프" },
  { id: "feedback", label: "피드백" },
  { id: "document", label: "문서·양식" },
  { id: "voice", label: "음성 세션" },
];

export function typeMeta(type) {
  return ACTIVITY_TYPES[type] || ACTIVITY_TYPES.conversation;
}

/**
 * 배지에 세울 유형. **최대 두 개** — 복합 활동이라고 배지를 다섯 개 달면
 * 제목보다 배지가 먼저 읽힌다. 나머지는 상세(툴팁)에서 확인한다.
 */
export function badgeTypes(activity) {
  const types = activity.context_types?.length
    ? activity.context_types
    : [activity.primary_type];
  return [...new Set(types)].slice(0, 2);
}

/** 툴팁 한 줄 — 제목이 잘렸을 때와 배지가 생략됐을 때 전체를 보여준다. */
export function activityTooltip(activity) {
  const kinds = (activity.context_types || []).map((t) => typeMeta(t).label);
  const parts = [activity.title];
  if (kinds.length) parts.push(kinds.join(" · "));
  if (activity.context_summary) parts.push(activity.context_summary);
  return parts.join("\n");
}

/** "3분 전" — 목록 오른쪽 끝에 작게 붙는다. */
export function timeAgo(iso) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  if (ms < 3_600_000) return `${Math.max(1, Math.floor(ms / 60_000))}분`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}시간`;
  if (ms < 7 * 86_400_000) return `${Math.floor(ms / 86_400_000)}일`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}

/** 전체 보기 화면의 날짜 묶음. 목록이 길어지면 "언제쯤"이 있어야 찾는다. */
export function dateGroup(iso) {
  const then = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86_400_000;
  if (then.getTime() >= startOfToday) return "오늘";
  if (then.getTime() >= startOfToday - day) return "어제";
  if (then.getTime() >= startOfToday - 7 * day) return "최근 7일";
  return "이전 활동";
}

export const DATE_GROUP_ORDER = ["오늘", "어제", "최근 7일", "이전 활동"];
