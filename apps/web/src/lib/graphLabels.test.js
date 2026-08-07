/**
 * 이름표 자리잡기 — 규칙을 못 박아 둔다.
 *
 * 이 화면에서 가장 미묘한 부분이다. 순위가 있고, 자리가 넷이고, 다른 노드의
 * 동그라미까지 장애물이고, 자리가 없으면 포기한다. 게다가 겹침 검사를 격자로
 * 좁혀 두었다 — **빠르게 만들면서 결과가 달라지지 않았는지**를 사람이 눈으로
 * 확인하는 것은 불가능하다. 그래서 두 가지를 시험한다.
 *
 *   ① 불변식 — 보여준 이름표는 서로 겹치지 않고 남의 동그라미도 안 덮는다
 *   ② 동치성 — 격자는 "장애물 전부 훑기"의 최적화일 뿐이다
 */
import { describe, expect, it } from "vitest";
import {
  LABEL_GAP, LABEL_H, LABEL_MARGIN, LEAF_LABEL_MIN_SCALE,
  clip, labelWidth, overlaps, placeLabels, rankOf,
} from "./graphLabels.js";

// ── 격자를 쓰지 않는 기준 구현 ────────────────────────────────
// 규칙은 placeLabels 와 **글자 하나까지 같고**, 다른 것은 "막혔나"를 장애물
// 전부를 훑어 판정한다는 점뿐이다. 격자가 최적화 이상의 일을 하면 여기서 갈린다.
function placeLabelsBruteForce({ nodes, screenOf, canvas, scale, activeId, matchedSet, connectedIds }) {
  const out = new Map();
  if (!canvas?.w || !nodes?.length) return out;
  const rank = (n) => rankOf(n, { activeId, matchedSet, connectedIds });
  const cands = nodes
    .map((n) => ({ n, s: screenOf(n), rank: rank(n) }))
    .filter(({ s }) => s.x > -80 && s.x < canvas.w + 80 && s.y > -40 && s.y < canvas.h + 40)
    .filter(({ n, rank: r }) => scale >= LEAF_LABEL_MIN_SCALE || n.kind !== "leaf" || r <= 2)
    .sort((a, b) => a.rank - b.rank || b.n.size - a.n.size);

  const blocks = cands.map(({ s }) => ({ x1: s.x - s.r, x2: s.x + s.r, y1: s.y - s.r, y2: s.y + s.r }));
  for (const { n, s, rank: r } of cands) {
    const text = clip(n.label);
    const w = labelWidth(text);
    const spots = [
      { x: s.x, y: s.y + s.r + LABEL_GAP },
      { x: s.x, y: s.y - s.r - LABEL_GAP - LABEL_H },
      { x: s.x + s.r + LABEL_GAP + w / 2, y: s.y - LABEL_H / 2 },
      { x: s.x - s.r - LABEL_GAP - w / 2, y: s.y - LABEL_H / 2 },
    ];
    const boxAt = (p) => ({ x1: p.x - w / 2, x2: p.x + w / 2, y1: p.y, y2: p.y + LABEL_H });
    let box = spots.map(boxAt).find((b) => !blocks.some((o) => overlaps(b, o)));
    if (!box && r <= 1) box = boxAt(spots[0]);
    if (!box) continue;
    blocks.push(box);
    const dim =
      (matchedSet && !matchedSet.has(n.id)) ||
      (connectedIds && n.id !== activeId && !connectedIds.has(n.id));
    out.set(n.id, { text, left: (box.x1 + box.x2) / 2, top: box.y1, dim: !!dim });
  }
  return out;
}

// ── 표본 만들기 ───────────────────────────────────────────────
// 실패했을 때 같은 씨앗으로 재현할 수 있도록 결정적 난수를 쓴다.
function makeRng(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}
const NAMES = [
  "경사 하강법", "극한", "베이즈 정리", "등가원리", "양자 얽힘", "유전자 가위",
  "표본조사", "기후 변화와 탄소중립 정책", "미분방정식", "확률분포", "단백질 접힘",
];
const KINDS = ["root", "topic", "leaf"];
const SIZES = { root: 68, topic: 46, leaf: 32 };

function makeScene(rnd, count, canvas) {
  const nodes = [];
  for (let i = 0; i < count; i += 1) {
    const kind = KINDS[Math.floor(rnd() * KINDS.length)];
    nodes.push({
      id: `n${i}`, label: NAMES[Math.floor(rnd() * NAMES.length)],
      kind, size: SIZES[kind],
      x: rnd() * canvas.w, y: rnd() * canvas.h,
    });
  }
  const screenOf = (n) => ({ x: n.x, y: n.y, r: n.size / 2 });
  return { nodes, screenOf };
}

const CANVAS = { w: 1100, h: 700 };
const base = (over = {}) => ({
  canvas: CANVAS, scale: 1, activeId: null, matchedSet: null, connectedIds: null, ...over,
});

describe("불변식 — 보여준 이름표는 읽을 수 있어야 한다", () => {
  it("이름표끼리 겹치지 않는다", () => {
    const rnd = makeRng(20260807);
    for (let iter = 0; iter < 60; iter += 1) {
      const { nodes, screenOf } = makeScene(rnd, 10 + Math.floor(rnd() * 140), CANVAS);
      const shown = placeLabels({ nodes, screenOf, ...base() });
      const boxes = [...shown].map(([id, l]) => {
        const w = labelWidth(l.text);
        return { id, x1: l.left - w / 2, x2: l.left + w / 2, y1: l.top, y2: l.top + LABEL_H };
      });
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          // 자리를 못 찾고도 억지로 놓는 것은 순위 0·1 뿐이라, 그 둘만 예외다.
          const forced = boxes[i].id === base().activeId || boxes[j].id === base().activeId;
          if (!forced && overlaps(boxes[i], boxes[j])) {
            throw new Error(`iter=${iter} 이름표 ${boxes[i].id}·${boxes[j].id} 가 겹친다`);
          }
        }
      }
    }
  });

  it("남의 동그라미를 덮지 않는다 — 덮으면 그 노드가 없는 것처럼 보인다", () => {
    const rnd = makeRng(4242);
    for (let iter = 0; iter < 60; iter += 1) {
      const { nodes, screenOf } = makeScene(rnd, 10 + Math.floor(rnd() * 120), CANVAS);
      const shown = placeLabels({ nodes, screenOf, ...base() });
      for (const [id, l] of shown) {
        const w = labelWidth(l.text);
        const box = { x1: l.left - w / 2, x2: l.left + w / 2, y1: l.top, y2: l.top + LABEL_H };
        for (const n of nodes) {
          const s = screenOf(n);
          const circle = { x1: s.x - s.r, x2: s.x + s.r, y1: s.y - s.r, y2: s.y + s.r };
          if (overlaps(box, circle)) {
            throw new Error(`iter=${iter} ${id} 의 이름표가 ${n.id} 의 동그라미를 덮는다`);
          }
        }
      }
    }
  });

  it("자리가 모자라도 고른 노드의 이름은 반드시 보여준다", () => {
    // 한 점에 노드를 스무 개 겹쳐 놓아 자리를 없앤다.
    const nodes = Array.from({ length: 20 }, (_, i) => ({
      id: `n${i}`, label: "빽빽한 이름", kind: "leaf", size: 32,
    }));
    const screenOf = () => ({ x: 550, y: 350, r: 16 });
    const shown = placeLabels({ nodes, screenOf, ...base({ activeId: "n7" }) });
    expect(shown.has("n7")).toBe(true);
    expect(shown.size).toBeLessThan(nodes.length);   // 나머지는 포기한다
  });

  it("검색에 걸린 이름도 자리가 없어도 보여준다", () => {
    const nodes = Array.from({ length: 20 }, (_, i) => ({
      id: `n${i}`, label: "빽빽한 이름", kind: "leaf", size: 32,
    }));
    const screenOf = () => ({ x: 550, y: 350, r: 16 });
    const shown = placeLabels({ nodes, screenOf, ...base({ matchedSet: new Set(["n3"]) }) });
    expect(shown.has("n3")).toBe(true);
  });
});

describe("규칙", () => {
  it("중요도 차례 — 고른 것 → 검색 → 이어진 것 → 핵심 → 과목 → 말단", () => {
    const ctx = { activeId: "a", matchedSet: new Set(["b"]), connectedIds: new Set(["c"]) };
    expect(rankOf({ id: "a", kind: "leaf" }, ctx)).toBe(0);
    expect(rankOf({ id: "b", kind: "leaf" }, ctx)).toBe(1);
    expect(rankOf({ id: "c", kind: "leaf" }, ctx)).toBe(2);
    expect(rankOf({ id: "d", kind: "root" }, ctx)).toBe(3);
    expect(rankOf({ id: "e", kind: "topic" }, ctx)).toBe(4);
    expect(rankOf({ id: "f", kind: "leaf" }, ctx)).toBe(5);
  });

  it("긴 이름은 잘리고 말줄임표가 붙는다", () => {
    expect(clip("짧은 이름")).toBe("짧은 이름");
    expect(clip("기후 변화와 탄소중립 정책 실현 방안")).toBe("기후 변화와 탄소중립 정책…");
  });

  it("많이 축소하면 말단 이름은 다투게 두지 않는다", () => {
    const nodes = [
      { id: "leaf", label: "말단", kind: "leaf", size: 32 },
      { id: "topic", label: "과목", kind: "topic", size: 46 },
    ];
    const screenOf = (n) => ({ x: n.id === "leaf" ? 200 : 700, y: 350, r: n.size / 2 });
    const wide = placeLabels({ nodes, screenOf, ...base({ scale: 1 }) });
    const zoomedOut = placeLabels({ nodes, screenOf, ...base({ scale: 0.5 }) });
    expect(wide.has("leaf")).toBe(true);
    expect(zoomedOut.has("leaf")).toBe(false);
    expect(zoomedOut.has("topic")).toBe(true);   // 과목은 남는다
  });

  it("이어지지 않은 노드의 이름표는 함께 흐려진다", () => {
    const nodes = [
      { id: "on", label: "이어짐", kind: "leaf", size: 32 },
      { id: "off", label: "남", kind: "leaf", size: 32 },
    ];
    const screenOf = (n) => ({ x: n.id === "on" ? 200 : 800, y: 350, r: 16 });
    const shown = placeLabels({
      nodes, screenOf, ...base({ activeId: "on", connectedIds: new Set(["on"]) }),
    });
    expect(shown.get("on").dim).toBe(false);
    expect(shown.get("off").dim).toBe(true);
  });

  it("화면 밖은 셈하지 않는다", () => {
    const nodes = [{ id: "far", label: "멀리", kind: "topic", size: 46 }];
    const screenOf = () => ({ x: -500, y: 350, r: 23 });
    expect(placeLabels({ nodes, screenOf, ...base() }).size).toBe(0);
  });

  it("캔버스 크기를 아직 모르면 아무것도 안 그린다", () => {
    const nodes = [{ id: "a", label: "가", kind: "topic", size: 46 }];
    expect(placeLabels({ nodes, screenOf: () => ({ x: 1, y: 1, r: 1 }), ...base({ canvas: { w: 0, h: 0 } }) }).size).toBe(0);
  });
});

describe("동치성 — 격자는 최적화일 뿐이다", () => {
  it("무작위 배치 300개에서 장애물 전부 훑기와 결과가 같다", () => {
    const rnd = makeRng(777);
    for (let iter = 0; iter < 300; iter += 1) {
      const canvas = { w: 700 + rnd() * 700, h: 400 + rnd() * 500 };
      const { nodes, screenOf } = makeScene(rnd, 5 + Math.floor(rnd() * 160), canvas);
      const scale = 0.4 + rnd() * 2;
      const activeId = rnd() < 0.5 ? nodes[Math.floor(rnd() * nodes.length)].id : null;
      const args = { nodes, screenOf, canvas, scale, activeId, matchedSet: null, connectedIds: null };

      const fast = placeLabels(args);
      const slow = placeLabelsBruteForce(args);

      expect(fast.size, `iter=${iter}: 개수가 다르다`).toBe(slow.size);
      for (const [id, v] of slow) {
        expect(fast.get(id), `iter=${iter}: ${id} 가 격자 쪽에 없다`).toEqual(v);
      }
    }
  });

  it("서로 닿을락 말락 한 자리에서도 같다 (격자 경계 근처)", () => {
    // 64px 칸 경계에 딱 걸치도록 놓아 본다. 칸을 좁게 잡으면 여기서 갈린다.
    for (const gap of [0, 1, 2, LABEL_MARGIN, LABEL_MARGIN + 1, 63, 64, 65]) {
      const nodes = [
        { id: "a", label: "가", kind: "leaf", size: 32 },
        { id: "b", label: "나", kind: "leaf", size: 32 },
      ];
      const screenOf = (n) => ({ x: n.id === "a" ? 64 : 64 + gap, y: 200, r: 16 });
      const args = { nodes, screenOf, ...base() };
      expect(placeLabels(args), `gap=${gap}`).toEqual(placeLabelsBruteForce(args));
    }
  });
});
