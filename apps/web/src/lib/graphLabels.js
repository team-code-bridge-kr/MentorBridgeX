/**
 * 이름표 자리잡기.
 *
 * 이름표를 노드 안에 같이 그리면 두 가지가 망가진다. 확대할 때 글자까지 같이
 * 커져서 아무리 확대해도 빽빽함이 그대로고, 이웃 노드의 이름표끼리 겹쳐 무엇도
 * 읽히지 않는다(126개 노드에서 실제로 그랬다).
 *
 * 그래서 이름표는 **줌 바깥의 화면 좌표**에 그리고, 자리가 겹치면 덜 중요한 쪽을
 * 지운다. 확대하면 노드 사이가 벌어지므로 자연스럽게 더 많은 이름이 드러난다 —
 * "확대하면 글자가 나온다"는 게 따로 만든 기능이 아니라 이 규칙의 결과다.
 *
 * ## 왜 화면 코드에서 떼어 냈는가
 *
 * 이 규칙은 이 화면에서 가장 미묘한 부분인데(순위·네 자리·장애물·포기), S06 안에
 * 묻혀 있는 동안에는 **한 줄도 시험해 볼 수 없었다.** 실제로 성능을 고치면서
 * 겹침 검사를 격자로 바꿨을 때, 결과가 같은지 확인할 방법이 눈으로 보는 것밖에
 * 없었다. 순수 함수로 빼면 규칙 자체를 못 박아 둘 수 있다.
 */

// 이름표가 지나치게 길어지지 않도록 자르는 기준(전체 문구는 title 로 노출).
export const LABEL_MAX = 14;
export const LABEL_FONT = 11.5;   // 확대해도 이 크기 그대로다
export const LABEL_H = 19;
export const LABEL_GAP = 5;       // 노드 아래 띄우는 거리
export const LABEL_MARGIN = 3;    // 이름표끼리 최소로 벌리는 거리

/** 이보다 축소하면 말단 노드의 이름은 다투게 두지 않는다(지도가 흐려진다). */
export const LEAF_LABEL_MIN_SCALE = 0.85;

/** 화면 밖 여백 — 이만큼 밖은 계산에서 뺀다. */
const CULL_X = 80;
const CULL_Y = 40;

export const overlaps = (a, b) =>
  a.x1 < b.x2 + LABEL_MARGIN && a.x2 + LABEL_MARGIN > b.x1 &&
  a.y1 < b.y2 + LABEL_MARGIN && a.y2 + LABEL_MARGIN > b.y1;

/**
 * 이름표의 중요도. **작을수록 먼저 자리를 잡는다.**
 * 고른 것 → 검색에 걸린 것 → 이어진 것 → 핵심 → 과목 → 말단.
 */
export function rankOf(n, { activeId, matchedSet, connectedIds }) {
  if (n.id === activeId) return 0;
  if (matchedSet?.has(n.id)) return 1;
  if (connectedIds?.has(n.id)) return 2;
  if (n.kind === "root") return 3;
  if (n.kind === "topic") return 4;
  return 5;
}

/**
 * 장애물 격자.
 *
 * 후보마다 장애물 **전부**를 훑으면 200노드에서 프레임당 16만 번을 센다. 그런데
 * 겹칠 수 있는 것은 가까이 있는 것뿐이다. 칸에 나눠 담고 후보가 걸치는 칸만 본다.
 * 겹침 판정이 LABEL_MARGIN 만큼 부풀려 보므로 칸을 고를 때도 그만큼 넓게 잡는다 —
 * 그래야 옆 칸에 있는 짝을 놓치지 않는다.
 */
function makeGrid(cell = 64) {
  const grid = new Map();
  const eachCell = (b, fn) => {
    const cx0 = Math.floor((b.x1 - LABEL_MARGIN) / cell), cx1 = Math.floor((b.x2 + LABEL_MARGIN) / cell);
    const cy0 = Math.floor((b.y1 - LABEL_MARGIN) / cell), cy1 = Math.floor((b.y2 + LABEL_MARGIN) / cell);
    for (let cx = cx0; cx <= cx1; cx += 1) for (let cy = cy0; cy <= cy1; cy += 1) {
      if (fn(`${cx},${cy}`)) return true;
    }
    return false;
  };
  return {
    add(b) { eachCell(b, (k) => { const a = grid.get(k); if (a) a.push(b); else grid.set(k, [b]); return false; }); },
    blocked(b) { return eachCell(b, (k) => { const a = grid.get(k); return !!a && a.some((o) => overlaps(b, o)); }); },
  };
}

/** 이름표 글상자의 너비(px). 글자 수로 어림한다 — 실제로 재면 레이아웃이 멈춘다. */
export function labelWidth(text) {
  return text.length * LABEL_FONT * 0.92 + 16;
}

/** 이름을 자른다. 자른 표시는 말줄임표 하나. */
export function clip(label) {
  return label.length > LABEL_MAX ? `${label.slice(0, LABEL_MAX)}…` : label;
}

/**
 * 이번 화면에서 이름을 보여줄 노드들 → `Map<id, {text,left,top,dim}>`.
 *
 * @param nodes    보이는 노드들
 * @param screenOf 노드 → `{x,y,r}` 화면 좌표(px)
 * @param canvas   `{w,h}` 캔버스 크기(px)
 * @param scale    지금 배율
 * @param activeId / matchedSet / connectedIds  중요도와 흐림에 쓴다
 */
export function placeLabels({ nodes, screenOf, canvas, scale, activeId, matchedSet, connectedIds }) {
  const out = new Map();
  if (!canvas?.w || !nodes?.length) return out;

  const rank = (n) => rankOf(n, { activeId, matchedSet, connectedIds });

  const cands = nodes
    .map((n) => ({ n, s: screenOf(n), rank: rank(n) }))
    // 화면 밖은 계산에서 뺀다. 안 보이는 자리를 두고 다투게 두면 정작 보이는
    // 노드의 이름이 밀려난다.
    .filter(({ s }) => s.x > -CULL_X && s.x < canvas.w + CULL_X && s.y > -CULL_Y && s.y < canvas.h + CULL_Y)
    // 다 축소한 상태에서는 말단 노드 이름까지 다투게 두지 않는다.
    .filter(({ n, rank: r }) => scale >= LEAF_LABEL_MIN_SCALE || n.kind !== "leaf" || r <= 2)
    .sort((a, b) => a.rank - b.rank || b.n.size - a.n.size);

  // 노드 동그라미부터 장애물로 깔아 둔다 — 남의 이름표가 동그라미를 덮으면
  // 그 노드가 없는 것처럼 보인다.
  const grid = makeGrid();
  for (const { s } of cands) grid.add({ x1: s.x - s.r, x2: s.x + s.r, y1: s.y - s.r, y2: s.y + s.r });

  for (const { n, s, rank: r } of cands) {
    const text = clip(n.label);
    const w = labelWidth(text);
    // 아래가 막혔으면 위·오른쪽·왼쪽 순으로 자리를 옮겨 본다. 한 자리만 보고
    // 포기하면 빽빽한 곳에서 이름이 통째로 사라진다.
    const spots = [
      { x: s.x, y: s.y + s.r + LABEL_GAP },
      { x: s.x, y: s.y - s.r - LABEL_GAP - LABEL_H },
      { x: s.x + s.r + LABEL_GAP + w / 2, y: s.y - LABEL_H / 2 },
      { x: s.x - s.r - LABEL_GAP - w / 2, y: s.y - LABEL_H / 2 },
    ];
    const boxAt = (p) => ({ x1: p.x - w / 2, x2: p.x + w / 2, y1: p.y, y2: p.y + LABEL_H });
    let box = spots.map(boxAt).find((b) => !grid.blocked(b));
    // 지금 보고 있는 노드와 검색에 걸린 노드는 자리가 없어도 반드시 보여준다.
    if (!box && r <= 1) box = boxAt(spots[0]);
    if (!box) continue;
    grid.add(box);
    // 노드가 흐려졌으면 이름표도 같이 흐려져야 한다. 안 그러면 검색해서 걸러 낸
    // 노드의 이름만 또렷하게 떠 있는다.
    const dim =
      (matchedSet && !matchedSet.has(n.id)) ||
      (connectedIds && n.id !== activeId && !connectedIds.has(n.id));
    out.set(n.id, { text, left: (box.x1 + box.x2) / 2, top: box.y1, dim: !!dim });
  }
  return out;
}
