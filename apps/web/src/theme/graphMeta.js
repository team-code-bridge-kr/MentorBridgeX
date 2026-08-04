/** 그래프 노드 kind → 아이콘/라벨/링 색 */
/* 색은 tier 척도(순서 있는 3단계)를 쓴다: 중심 -> 가지 -> 말단. */
export const KIND_META = {
  root:  { icon: "core",   label: "핵심 노드", color: "#0969da", ring: "rgba(9,105,218,.28)" },
  topic: { icon: "branch", label: "연결 노드", color: "#0ea5e9", ring: "rgba(14,165,233,.24)" },
  leaf:  { icon: "leaf",   label: "말단 노드", color: "#16a34a", ring: "rgba(22,163,74,.22)" },
};

/**
 * 그래프 캔버스 색.
 *
 * 예전에는 어두운 판이었다. 밝은 페이지 한가운데 검은 판 하나가 강해 보였지만,
 * 그 대가로 이 화면만 다른 앱처럼 보였고 — 판 위의 글자·카드·선을 전부 따로
 * 관리해야 했다. 지금은 나머지 화면과 같은 표면을 쓴다. 노드 색이 이미 충분히
 * 진해서 밝은 바탕에서도 또렷하다.
 */
export const GRAPH_CANVAS = {
  bg: "#f7f9ff",       // 앱 배경(--bg2)과 같은 값
  bgCenter: "#ffffff", // 중앙만 살짝 밝게 — 문서 노드가 놓이는 자리
  dot: "#dde2ee",
  border: "#e2e6f0",
};

/** 캔버스 위에서 쓰는 글자색 계층. 본문 토큰과 같은 3단계를 쓴다. */
export const OVERLAY_TEXT = {
  primary: "#181c21",
  secondary: "#424753",
  tertiary: "#727785",
  accent: "#0051ae",
};

/**
 * 그래프 위에 떠 있는 정보 카드의 공통 표면.
 * 범례 / 통계 / 선택 라벨이 같은 재질로 보이도록 한 곳에서 관리한다.
 * 배경 그래프가 비쳐 글자가 묻히지 않도록 불투명도를 충분히 준다.
 */
export const OVERLAY_SURFACE = {
  background: "rgba(255,255,255,.92)",
  border: "1px solid rgba(15,23,42,.07)",
  borderRadius: 16,
  boxShadow: "0 8px 24px rgba(15,23,42,.10)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  color: OVERLAY_TEXT.primary,
};

/** 줌 한계와 한 번에 움직이는 배율. */
export const ZOOM = { min: 0.35, max: 3, step: 1.25 };

/**
 * 레이어 순서. 패널과 라벨은 항상 그래프보다 위에 있어야 한다.
 * 여기서만 고쳐서 순서가 어긋나는 일이 없게 한다.
 */
export const Z = {
  edges: 1,
  node: 2,
  nodeActive: 4,
  nodeDragging: 5,
  label: 6,        // 호버 라벨 — 잠깐 뜨는 것이라 패널 아래
  panel: 8,        // 범례 / 통계 / 줌
  loading: 9,
  // 클릭해서 고른 라벨은 사용자가 지금 읽으려는 것이므로 패널보다도 위에 둔다.
  // (좌상단 범례와 겹치는 자리의 노드를 클릭해도 가려지지 않게)
  labelPinned: 10,
};
