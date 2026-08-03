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
 * 백엔드 엣지는 거의 전부 "노드 → 생기부 문서"(MENTIONED_IN)라, 그대로 그리면
 * 수십 개 선이 중앙으로 쏟아져 아무것도 안 보인다. 대신 배치가 만든 가지
 * (문서 → 과목 → 그 과목의 노드)를 그리고, 문서를 거치지 않는 실제 엣지
 * (EVOLVED_FROM 등)는 그 위에 겹쳐 보여준다.
 */
export function visualEdgesOf(nodes, edges) {
  const rootId = nodes.find((n) => n.kind === "root")?.id ?? null;
  const branches = nodes
    .filter((n) => n.parentId)
    .map((n) => ({ id: `branch_${n.id}`, from: n.parentId, to: n.id, branch: true }));
  if (!branches.length) return edges;
  const cross = edges.filter((e) => e.from !== rootId && e.to !== rootId);
  return [...branches, ...cross];
}
