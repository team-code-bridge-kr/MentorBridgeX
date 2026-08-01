/** 그래프 노드 kind → 아이콘/라벨/링 색 */
/* 색은 tier 척도(순서 있는 3단계)를 쓴다: 중심 -> 가지 -> 말단. */
export const KIND_META = {
  root:  { icon: "core",   label: "핵심 노드", color: "#0969da", ring: "rgba(9,105,218,.28)" },
  topic: { icon: "branch", label: "연결 노드", color: "#0ea5e9", ring: "rgba(14,165,233,.24)" },
  leaf:  { icon: "leaf",   label: "말단 노드", color: "#16a34a", ring: "rgba(22,163,74,.22)" },
};

/**
 * 그래프 캔버스(어두운 판) 색.
 * 노드 색이 잘 튀어 보이도록 배경은 채도를 낮춘 남색 계열로 둔다.
 */
export const GRAPH_CANVAS = {
  bg: "#0d1117",       // GitHub 다크. 밝은 페이지에 어두운 판 하나 — 이 대비가 인상의 핵심
  bgCenter: "#161b22", // 중앙만 살짝 밝게 — 문서 노드가 놓이는 자리
  dot: "#30363d",
  border: "rgba(255,255,255,.10)",
};

/** 어두운 캔버스 위에서 쓰는 글자색 계층. */
/* 어두운 판 위에서는 MD3 토큰을 쓰지 않는다. 회색 스케일 + white/N 이 규칙이다. */
export const OVERLAY_TEXT = {
  primary: "#ffffff",
  secondary: "#9ca3af", // gray-400
  tertiary: "#6b7280",  // gray-500
  accent: "#58a6ff",    // 어두운 배경 위 강조 = secondary-container
};

/**
 * 그래프 위에 떠 있는 정보 카드의 공통 표면.
 * 범례 / 통계 / 선택 라벨이 같은 재질로 보이도록 한 곳에서 관리한다.
 * 배경 그래프가 비쳐 글자가 묻히지 않도록 불투명도를 충분히 준다.
 */
export const OVERLAY_SURFACE = {
  background: "rgba(22,27,34,.90)",
  border: "1px solid rgba(255,255,255,.10)",
  borderRadius: 16,
  boxShadow: "0 8px 24px rgba(0,0,0,.50)",
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
