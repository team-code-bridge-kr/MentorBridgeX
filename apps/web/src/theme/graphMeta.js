/** 그래프 노드 kind → 아이콘/라벨/링 색 */
export const KIND_META = {
  root:  { icon: "core",   label: "핵심 노드", ring: "rgba(49,130,246,.25)" },
  topic: { icon: "branch", label: "연결 노드", ring: "rgba(69,147,252,.22)" },
  leaf:  { icon: "leaf",   label: "말단 노드", ring: "rgba(34,197,94,.22)" },
};

/**
 * 그래프 위에 떠 있는 정보 카드의 공통 표면.
 * 범례 / 통계 / 선택 라벨이 같은 재질로 보이도록 한 곳에서 관리한다.
 * 배경 그래프가 비쳐 글자가 묻히지 않도록 불투명도를 충분히 준다.
 */
export const OVERLAY_SURFACE = {
  background: "rgba(255,255,255,.92)",
  border: "1px solid rgba(0,0,0,.07)",
  borderRadius: 16,
  boxShadow: "0 6px 24px rgba(15,23,42,.10), 0 1px 3px rgba(15,23,42,.06)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
};

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
