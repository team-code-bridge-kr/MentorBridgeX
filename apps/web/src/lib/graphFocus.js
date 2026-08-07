/**
 * 초점 — 한 노드로 들어가 그 둘레만 본다.
 *
 * ## 왜 접기를 그만두었나
 *
 * 처음에는 가지별 접기를 넣었다. 자리를 안 바꾸는 접기라 지도 감각이 보존된다는
 * 것이 장점이었는데, **실제로 써 보니 시야가 안 걷혔다.** 한 가지를 접어도
 * 나머지 190개가 그대로 남는다. 197개짜리 그래프에서 접기로 한산해지려면 거의
 * 전부를 하나씩 접어야 했다.
 *
 * 지도 감각을 지킬 값어치는 **지도가 읽힐 때** 생긴다. 197개가 한 화면에 깔린
 * 그림은 애초에 지도가 아니라 얼룩이라, 지켜 봐야 지킬 것이 없었다.
 *
 * 그래서 한 번에 **한 층**만 본다. 초점 노드가 가운데 서고 그 자식들이 둘레에
 * 놓인다. 실측(197노드 계정)으로 문서→교과군 16개, 구획 하나당 개념 중앙값 4개다.
 * 어느 층에 있든 화면에 5~17개다.
 *
 * ## 되돌아오는 길
 *
 * 재배치는 **모드**를 만든다. 모드에는 나가는 길이 반드시 있어야 한다 — 그래서
 * `pathTo` 로 경로표시(내 생기부 › 수학 › 미적분)를 늘 띄운다. 어디에 있는지와
 * 어떻게 나가는지가 같은 줄에 있다.
 *
 * ## 자리 셈
 *
 * 좌표는 **여기서 새로 만든다**(`api/index.js` 의 전역 방사 배치를 쓰지 않는다).
 * 층마다 화면을 새로 쓰므로 전역 배치는 뜻이 없다. 순수 함수라 같은 초점이면
 * 늘 같은 그림이고, 팬·줌과 무관하다.
 */

/** 자식 고리의 반지름(%)과 고리마다 놓을 수 있는 수. 안쪽부터 채운다. */
const RINGS = [
  { r: 27, cap: 10 },
  { r: 38, cap: 15 },
  { r: 44, cap: 20 },
];
/** 손님 고리 — 자식이 쓰는 가장 바깥(44)보다 밖이라 서로 섞이지 않는다. */
const GUEST_R = 48.5;
const CENTER = { x: 50, y: 50 };

const pct = (v) => `${Math.max(4, Math.min(96, v)).toFixed(1)}%`;

/**
 * 자식들을 고리에 나눠 담는다.
 *
 * 한 고리에 다 밀어 넣으면 자식이 스물이 넘을 때 서로 붙는다. 고리마다 반 칸씩
 * 어긋나게 돌려서 안팎이 한 줄로 서지 않게 한다 — 나란히 서면 어느 것이 어느
 * 고리인지 눈으로 못 가른다.
 */
export function ringSlots(count) {
  if (count <= 0) return [];
  const rings = [];
  let left = count;
  for (const ring of RINGS) {
    if (left <= 0) break;
    const take = Math.min(left, ring.cap);
    rings.push({ ...ring, n: take });
    left -= take;
  }
  // 고리를 다 쓰고도 남으면 바깥 고리에 몰아 넣는다(그림이 빽빽해질 뿐 안 사라진다).
  if (left > 0) rings[rings.length - 1].n += left;

  const out = [];
  rings.forEach((ring, ri) => {
    const step = (Math.PI * 2) / ring.n;
    // 첫 자식을 위쪽에 두고, 안쪽 고리와 반 칸 어긋나게 한다.
    const offset = -Math.PI / 2 + (ri % 2 ? step / 2 : 0);
    for (let i = 0; i < ring.n; i += 1) {
      const a = offset + step * i;
      out.push({ x: CENTER.x + ring.r * Math.cos(a), y: CENTER.y + ring.r * Math.sin(a) });
    }
  });
  return out;
}

/** 뿌리(문서) 노드. 없으면 부모가 없는 노드 중 자식이 가장 많은 것. */
export function rootIdOf(nodes, childMap) {
  const doc = nodes.find((n) => n.kind === "root");
  if (doc) return doc.id;
  let best = null;
  let bestCount = -1;
  for (const n of nodes) {
    if (n.parentId) continue;
    const c = childMap.get(n.id)?.length ?? 0;
    if (c > bestCount) { best = n.id; bestCount = c; }
  }
  return best;
}

/** 뿌리에서 이 노드까지의 길(뿌리부터). 경로표시가 이걸 그린다. */
export function pathTo(id, nodes) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = [];
  const seen = new Set();
  let cur = id;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const n = byId.get(cur);
    if (!n) break;
    out.unshift(n);
    cur = n.parentId;
  }
  return out;
}

/**
 * 이번 화면 — 초점 노드와 그 자식들, 그리고 **불러온 손님**.
 *
 * ## 손님(`extraIds`)
 *
 * 다른 층에 있는 노드를 잠시 이 화면에 데려온다. 연결을 이을 때 쓴다 — 「연결
 * 추가」에서 고른 노드가 딴 층에 있으면, 무엇과 잇는 중인지 눈으로 볼 수 없어서
 * 이름만 보고 이어야 했다. 손님은 이 화면에만 잠깐 서는 것이고 초점을 옮기면
 * 사라진다(자리를 옮긴 것이 아니라 데려와 보여 준 것뿐이다).
 *
 * 자리는 자식들 **뒤에** 이어 붙인다. 그래야 안쪽 고리부터 자식이 차고 손님이
 * 바깥에 서서, 어느 것이 이 층의 식구인지 자리로도 구별된다.
 *
 * @returns `{ focus, children, guests, positions, missing }`
 *   - `positions` : `Map<id, {x,y}>` (백분율 문자열)
 *   - `missing`   : 초점 id 가 그래프에 없을 때 true (그래프가 바뀌면 생긴다)
 */
export function focusViewOf(nodes, childMap, focusId, extraIds) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const focus = byId.get(focusId) || null;
  if (!focus) return { focus: null, children: [], guests: [], positions: new Map(), missing: true };

  const children = (childMap.get(focusId) || []).map((id) => byId.get(id)).filter(Boolean);
  const here = new Set([focus.id, ...children.map((c) => c.id)]);
  const guests = [...(extraIds || [])]
    .filter((id) => !here.has(id))
    .map((id) => byId.get(id))
    .filter(Boolean);

  // 자식 자리는 **손님과 무관하게** 정한다. 손님 하나 데려왔다고 식구가 우르르
  // 움직이면, 무엇과 잇는 중인지 보려다 보던 그림을 잃는다.
  const positions = new Map([[focus.id, { x: pct(CENTER.x), y: pct(CENTER.y) }]]);
  ringSlots(children.length).forEach((s, i) => {
    positions.set(children[i].id, { x: pct(s.x), y: pct(s.y) });
  });
  // 손님은 자식보다 바깥 고리에 따로 선다.
  const step = (Math.PI * 2) / Math.max(guests.length, 1);
  guests.forEach((g, i) => {
    const a = -Math.PI / 2 + step * i;
    positions.set(g.id, {
      x: pct(CENTER.x + GUEST_R * Math.cos(a)),
      y: pct(CENTER.y + GUEST_R * Math.sin(a)),
    });
  });
  return { focus, children, guests, positions, missing: false };
}

/**
 * 이 노드를 눌렀을 때 들어갈 곳.
 *
 * 자식이 없으면 들어갈 데가 없다 — 그때는 초점을 옮기지 않고 고르기만 한다.
 * (개념 노드를 눌렀다고 빈 화면으로 데려가면 길을 잃는다.)
 */
export function drillTargetOf(node, childMap) {
  if (!node) return null;
  return (childMap.get(node.id)?.length ?? 0) > 0 ? node.id : null;
}

/** 한 층 위. 뿌리면 더 갈 곳이 없다. */
export function parentOf(focusId, nodes) {
  const n = nodes.find((x) => x.id === focusId);
  return n?.parentId || null;
}
