/**
 * 그래프의 부모–자식 관계.
 *
 * ## 왜 `parentId` 를 따라가고 엣지를 따라가지 않는가
 *
 * 개념은 부모가 둘일 수 있다(백엔드 `graph_structure.py` 의 `MAX_PARENTS = 2`).
 * 엣지를 그대로 따라가면 한 노드가 두 층에 동시에 속해서, 어느 층을 보고 있는지가
 * 흐려진다. `parentId` 는 배치를 정할 때 이미 고른 "이 노드가 서 있는 자리"이므로,
 * 그것을 따라가야 화면에서 보이는 가지와 셈이 같아진다.
 *
 * (한때 여기에 가지별 접기 셈이 있었다. 접기는 자리를 안 바꾸는 것이 장점이었지만
 * 써 보니 시야가 안 걷혀서 — 한 가지를 접어도 나머지 190개가 그대로 남는다 —
 * 초점 드릴다운(`graphFocus.js`)으로 갈아탔다.)
 */

/** 부모 → 자식 목록. `parentId` 가 없는 노드(뿌리·외톨이)는 어디에도 안 담긴다. */
export function childMapOf(nodes) {
  const kids = new Map();
  for (const n of nodes) {
    if (!n.parentId) continue;
    const cur = kids.get(n.parentId);
    if (cur) cur.push(n.id);
    else kids.set(n.parentId, [n.id]);
  }
  return kids;
}

/**
 * 이 노드 아래에 달린 모든 자손의 수 — "안에 N개 더 있음" 배지가 쓴다.
 *
 * 직계 자식이 아니라 **자손 전부**를 센다. 교과군에 구획 4개가 있고 그 아래
 * 개념이 20개면, 알고 싶은 것은 "4개"가 아니라 "24개"다.
 */
export function descendantCount(id, childMap) {
  let n = 0;
  // 자기 자신은 세지 않는다. 부모 고리가 꼬여 자기에게 되돌아오는 경우가
  // 있는데(BFS 로 만든 parentId 에는 없지만 서버가 바뀌면 생길 수 있다),
  // 그때 "안에 N개"가 자신을 포함하면 숫자가 하나 부풀려진다.
  const seen = new Set([id]);
  const stack = [...(childMap.get(id) || [])];
  while (stack.length) {
    const cur = stack.pop();
    if (seen.has(cur)) continue;   // 두 부모를 거쳐 같은 노드에 닿을 수 있다
    seen.add(cur);
    n += 1;
    for (const c of childMap.get(cur) || []) stack.push(c);
  }
  return n;
}

/** 선이 하나도 없는 노드. 어느 층에도 속하지 않아 화면에 자리가 없다. */
export function strayIdsOf(nodes, edges) {
  const linked = new Set();
  for (const e of edges) { linked.add(e.from); linked.add(e.to); }
  const out = new Set();
  for (const n of nodes) if (!linked.has(n.id)) out.add(n.id);
  return out;
}
