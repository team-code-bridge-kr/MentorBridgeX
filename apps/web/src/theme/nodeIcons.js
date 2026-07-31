/**
 * 그래프 노드 아이콘 매핑.
 *
 *   색  = 노드 유형 (핵심 / 연결 / 말단)  ← 기존 체계 그대로
 *   모양 = 과목·분야                      ← 여기서 정한다
 *
 * 규칙은 위에서부터 먼저 맞는 것을 쓴다. 순서가 의미를 가지므로 함부로 섞지 말 것.
 * 예) "인공지능과 미래사회" 는 '사회' 를 품고 있어서 AI 규칙이 사회보다 위에 있어야 하고,
 *     "수학과제 탐구" 는 수학, "사회문제 탐구" 는 사회로 가야 한다.
 *
 * 아이콘 이름은 components/NavIcon.jsx 의 NAV_ICON_PATHS 키다.
 * 새 아이콘 라이브러리를 들이지 않고 기존 인라인 SVG 세트를 확장해서 쓴다.
 */

// [정규식, 아이콘] — 과목/영역 이름에 적용한다.
const SUBJECT_RULES = [
  // 컴퓨터·AI 는 '사회', '과학' 같은 글자를 품은 과목명이 많아 가장 먼저 본다.
  [/인공지능|머신러닝|딥러닝|빅데이터|데이터\s*분석/, "cpu"],
  [/정보|컴퓨터|프로그래밍|피지컬|코딩|소프트웨어|알고리즘/, "code"],

  [/수학|미적분|확률|통계|기하|해석/, "sigma"],
  [/물리|화학|생명과학|생물|지구과학|과학/, "flask"],

  [/한국사|세계사|역사/, "hourglass"],
  // '법과' 를 그냥 쓰면 "화법과 작문" 이 걸린다. 과목명 형태로만 잡는다.
  [/사회|정치|경제|지리|법과\s*정치|정치와\s*법|윤리|철학|종교/, "landmark"],

  [/영어|중국어|일본어|한문|독일어|프랑스어|스페인어|외국어/, "language"],
  [/국어|문학|화법|작문|독서|언어와/, "bookOpen"],

  [/미술|디자인|조형|공예/, "palette"],
  [/음악|연주|합창|국악/, "music"],
  [/체육|운동|스포츠|건강/, "dumbbell"],

  // 창의적 체험활동·기타 영역
  [/진로/, "compass"],
  [/수상|대회|경력/, "trophy"],
  [/봉사/, "heart"],
  [/동아리/, "users"],
  [/자율|학급|자치/, "flag"],
  [/행동특성|종합의견/, "record"],
];

// 과목으로 못 읽었을 때, 노드 유형으로 한 번 더 시도한다.
const TYPE_ICONS = {
  document: "record",
  period: "calendar",
  activity: "users",
  inquiry: "search",
  subject: "bookOpen",
  keyword: "sparkle",
};

// 그래도 못 정하면 노드 종류별 기본값.
const KIND_FALLBACK = { root: "record", topic: "branch", leaf: "leaf" };

function matchSubject(text) {
  if (!text) return null;
  for (const [pattern, icon] of SUBJECT_RULES) {
    if (pattern.test(text)) return icon;
  }
  return null;
}

// 노드 수가 많아 매 렌더마다 정규식을 다시 돌리지 않도록 결과를 기억해 둔다.
const cache = new Map();

/**
 * 노드 하나의 아이콘 이름을 고른다.
 *
 * 우선순위
 *   1. 과목·영역(section) 이 읽히면 과목 아이콘
 *   2. 라벨에서 과목·분야가 읽히면 그 아이콘 (section 이 "기타" 인 노드 구제)
 *   3. 노드 유형(Subject/Inquiry/Activity/Period/Document)
 *   4. 노드 종류(root/topic/leaf) 기본값
 */
export function iconForNode(node) {
  const section = node?.section ?? "";
  const label = node?.label ?? "";
  const type = String(node?.type ?? "").toLowerCase();
  const kind = node?.kind ?? "leaf";

  const key = `${section}|${label}|${type}|${kind}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const icon =
    (kind === "root" ? "record" : null) ??
    matchSubject(section) ??
    matchSubject(label) ??
    TYPE_ICONS[type] ??
    KIND_FALLBACK[kind] ??
    "leaf";

  cache.set(key, icon);
  return icon;
}

/** 범례에 쓰는 과목 아이콘 예시 (아이콘이 무엇을 뜻하는지 보여주기 위함). */
export const SUBJECT_LEGEND = [
  { icon: "bookOpen", label: "국어·독서" },
  { icon: "language", label: "외국어" },
  { icon: "sigma", label: "수학" },
  { icon: "flask", label: "과학" },
  { icon: "landmark", label: "사회" },
  { icon: "hourglass", label: "역사" },
  { icon: "code", label: "정보" },
  { icon: "cpu", label: "AI·데이터" },
  { icon: "palette", label: "예술" },
  { icon: "dumbbell", label: "체육" },
  { icon: "compass", label: "진로" },
  { icon: "users", label: "동아리" },
];
