/**
 * 그래프를 **가지별로 접고 펴기** 위한 셈.
 *
 * 여기 함수는 전부 순수하다 — 같은 입력이면 같은 결과다. 접기는 화면에서 가장
 * 자주 일어나는 일이라(누를 때마다, 그리고 팬·줌 때마다 다시 그려진다) 셈이
 * 화면 그리기와 섞이면 어디서 느려지는지 알 수 없게 된다.
 *
 * ## 왜 `parentId` 를 따라가고 엣지를 따라가지 않는가
 *
 * 개념은 부모가 둘일 수 있다(백엔드 `graph_structure.py` 의 `MAX_PARENTS = 2`).
 * 엣지를 따라 접으면 한 노드가 **두 곳에 접혀서**, 한쪽을 펴도 다른 쪽이 접고
 * 있으니 안 나타나는 일이 생긴다. `parentId` 는 배치를 정할 때 이미 고른 "이
 * 노드가 서 있는 자리"이므로, 그것을 따라 접어야 화면에서 보이는 가지와 접히는
 * 가지가 같아진다. 두 번째 부모로 가는 선은 자식이 숨으면 함께 사라진다
 * (S06 의 edges 필터가 양 끝이 살아 있을 때만 그린다).
 *
 * ## 접어도 자리는 그대로다
 *
 * 여기에는 좌표를 다시 계산하는 함수가 없다. **일부러 없다.** 배치는
 * `api/index.js` 의 `computeLayout` 이 미리 정해 둔 값이고, 접었다고 다시
 * 계산하면 남아 있는 노드가 움직여서 방금 보던 자리를 잃는다(Gephi·yEd 가 접을
 * 때마다 지도가 뒤바뀌는 이유다). 접힌 자리에 남는 빈 부채꼴은 결함이 아니라
 * "여기 뭔가 접혀 있다"는 표시이고, 다시 펴면 정확히 그대로 돌아온다.
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
 * 접힌 노드들 **아래**에 있어서 숨겨야 하는 노드 전부.
 *
 * 접힌 노드 자신은 들어가지 않는다 — 접힌 가지도 그 머리는 보여야 `+N` 을 달고
 * 다시 펼 수 있다.
 */
export function hiddenBy(collapsed, childMap) {
  const hidden = new Set();
  if (!collapsed?.size) return hidden;
  const stack = [];
  for (const id of collapsed) {
    for (const c of childMap.get(id) || []) stack.push(c);
  }
  while (stack.length) {
    const id = stack.pop();
    if (hidden.has(id)) continue;   // 두 부모를 거쳐 같은 노드에 닿을 수 있다
    hidden.add(id);
    for (const c of childMap.get(id) || []) stack.push(c);
  }
  return hidden;
}

/** 이 노드 아래에 달린 모든 자손의 수. 접힌 노드에 붙이는 `+N` 이다. */
export function descendantCount(id, childMap) {
  let n = 0;
  const seen = new Set();
  const stack = [...(childMap.get(id) || [])];
  while (stack.length) {
    const cur = stack.pop();
    if (seen.has(cur)) continue;
    seen.add(cur);
    n += 1;
    for (const c of childMap.get(cur) || []) stack.push(c);
  }
  return n;
}

/**
 * 노드의 층. 문서 0 · 교과군 1 · 생기부 구획 2 · 개념 3.
 *
 * 층은 이제 **무엇이 보이는지를 정하지 않는다**(그건 `collapsed` 가 한다).
 * 깊이 알약이 "이만큼 접어라"를 셈할 때만 쓴다.
 */
export function levelOf(n) {
  if (n.kind === "root") return 0;
  if (n.familyKey) return 1;
  if (n.sectionId) return 2;
  return 3;
}

/**
 * 「교과 / 과목 / 개념」 알약이 만드는 접힘 상태.
 *
 * 알약은 **모드가 아니라 명령**이다. 누르면 이 집합을 `collapsed` 에 써넣고
 * 물러난다. 그래서 그 뒤에 학생이 가지 하나를 손으로 펴도 다투는 일이 없다 —
 * 진리는 언제나 `collapsed` 하나뿐이다.
 *
 * `level` 보다 깊은 것을 감추려면 **`level` 층의 노드를 접으면 된다.**
 *
 * 자식이 있는 노드만 담는다. 개념(3층)은 아래가 없어서 접어 봐야 화면이 그대로인데,
 * 담아 두면 「개념」 알약이 만든 상태가 "아무것도 안 접힘"과 달라 보여서 알약에
 * 불이 안 켜지고, 저장해 둘 값만 커진다.
 */
export function collapsedForDepth(nodes, level, childMap) {
  const kids = childMap || childMapOf(nodes);
  const out = new Set();
  for (const n of nodes) {
    if (levelOf(n) === level && (kids.get(n.id)?.length ?? 0) > 0) out.add(n.id);
  }
  return out;
}

/** 두 집합이 같은가. 알약에 불을 켤지 정할 때 쓴다. */
export function sameSet(a, b) {
  if (a === b) return true;
  if (!a || !b || a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/**
 * 이 노드의 조상들(가까운 쪽부터). 접힌 가지 안의 노드를 골랐을 때 그 위를
 * 펴 주기 위한 값이다 — 검색에 걸렸는데 아무 일도 안 일어나면 검색이 고장 난
 * 것으로 보인다.
 */
export function ancestorsOf(id, nodes) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = [];
  const seen = new Set([id]);
  let cur = byId.get(id)?.parentId;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    out.push(cur);
    cur = byId.get(cur)?.parentId;
  }
  return out;
}

/** 선이 하나도 없는 노드. 어느 가지에도 속하지 않아 접기의 대상이 아니다. */
export function strayIdsOf(nodes, edges) {
  const linked = new Set();
  for (const e of edges) { linked.add(e.from); linked.add(e.to); }
  const out = new Set();
  for (const n of nodes) if (!linked.has(n.id)) out.add(n.id);
  return out;
}
