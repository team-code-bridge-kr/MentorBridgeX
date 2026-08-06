/**
 * 그래프를 "그릴 때" 쓰는 규칙.
 *
 * 지식 그래프 화면(S06)과 대시보드 미리보기가 같은 모양으로 보여야 하므로
 * 선을 고르는 규칙을 여기 한 곳에 둔다. 한쪽만 고쳐서 두 화면이 달라지는 일을
 * 막는 것이 이 파일의 목적이다.
 */

/**
 * 화면에 그릴 선.
 *
 * 예전에는 여기서 가지를 **지어냈다.** 백엔드 선이 전부 "개념 → 생기부 문서"
 * 하나뿐이라 그대로 그리면 수십 개 선이 중앙으로 쏟아졌기 때문이다. 이제
 * 백엔드가 생기부 구획을 노드로 세우므로(`graph_structure.py`) 지어낼 것이 없다 —
 * 있는 선을 그대로 그린다.
 *
 * 다만 배치가 고른 부모로 가는 선은 **가지**로 표시한다. 굵기가 달라야 뼈대와
 * 곁가지가 구별된다.
 */
export function visualEdgesOf(nodes, edges) {
  const parentOf = new Map(nodes.filter((n) => n.parentId).map((n) => [n.id, n.parentId]));
  if (!parentOf.size) return edges;
  return edges.map((e) => (parentOf.get(e.from) === e.to ? { ...e, branch: true } : e));
}
