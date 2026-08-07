/**
 * 초점 드릴다운 — 한 번에 한 층만 본다.
 *
 * 지키려는 것:
 *   ① 화면에는 초점과 그 **직계 자식만** 선다 (손자는 안 보인다)
 *   ② 자식이 없는 노드로는 들어가지 않는다 (빈 화면에 갇히지 않는다)
 *   ③ 나가는 길이 늘 있다 (`pathTo` 가 뿌리까지 이어진다)
 */
import { describe, expect, it } from "vitest";
import { childMapOf } from "./graphTree.js";
import {
  drillTargetOf, focusViewOf, parentOf, pathTo, ringSlots, rootIdOf,
} from "./graphFocus.js";

const nodes = [
  { id: "doc",   kind: "root",  label: "내 생기부", parentId: null },
  { id: "math",  kind: "topic", label: "수학",      parentId: "doc" },
  { id: "sci",   kind: "topic", label: "과학",      parentId: "doc" },
  { id: "calc",  kind: "topic", label: "미적분",     parentId: "math" },
  { id: "stat",  kind: "topic", label: "확률과 통계", parentId: "math" },
  { id: "phys",  kind: "topic", label: "물리학",     parentId: "sci" },
  { id: "gd",    kind: "leaf",  label: "경사 하강법", parentId: "calc" },
  { id: "lim",   kind: "leaf",  label: "극한",       parentId: "calc" },
  { id: "bayes", kind: "leaf",  label: "베이즈 정리", parentId: "stat" },
  { id: "eq",    kind: "leaf",  label: "등가원리",    parentId: "phys" },
];
const cm = childMapOf(nodes);
const idsOf = (focusId) => {
  const v = focusViewOf(nodes, cm, focusId);
  return [v.focus.id, ...v.children.map((c) => c.id)];
};

describe("focusViewOf — 한 층만", () => {
  it("뿌리에서는 문서와 교과군만 보인다", () => {
    expect(idsOf("doc").sort()).toEqual(["doc", "math", "sci"]);
  });

  it("손자는 안 보인다 — 이게 시야가 걷히는 까닭이다", () => {
    const shown = idsOf("doc");
    for (const grandchild of ["calc", "stat", "phys", "gd", "lim"]) {
      expect(shown, `${grandchild} 가 보인다`).not.toContain(grandchild);
    }
  });

  it("교과군으로 들어가면 그 구획들만", () => {
    expect(idsOf("math").sort()).toEqual(["calc", "math", "stat"]);
    expect(idsOf("math")).not.toContain("phys");   // 남의 가지
  });

  it("구획으로 들어가면 그 개념들만", () => {
    expect(idsOf("calc").sort()).toEqual(["calc", "gd", "lim"]);
  });

  it("초점 노드는 언제나 화면 한가운데", () => {
    for (const id of ["doc", "math", "calc"]) {
      expect(focusViewOf(nodes, cm, id).positions.get(id)).toEqual({ x: "50.0%", y: "50.0%" });
    }
  });

  it("자식마다 자리가 하나씩 있고 서로 다르다", () => {
    const v = focusViewOf(nodes, cm, "doc");
    const seen = new Set();
    for (const c of v.children) {
      const p = v.positions.get(c.id);
      expect(p, `${c.id} 자리 없음`).toBeTruthy();
      seen.add(`${p.x},${p.y}`);
    }
    expect(seen.size).toBe(v.children.length);
  });

  it("없는 초점이면 missing 을 알린다 — 화면이 뿌리로 되돌아갈 수 있게", () => {
    const v = focusViewOf(nodes, cm, "사라진id");
    expect(v.missing).toBe(true);
    expect(v.focus).toBe(null);
  });

  it("자식 없는 노드를 초점으로 두면 저 혼자 선다", () => {
    const v = focusViewOf(nodes, cm, "gd");
    expect(v.children).toEqual([]);
    expect(v.positions.size).toBe(1);
  });
});

describe("손님 — 다른 층에서 잠시 데려오기", () => {
  it("딴 층 노드를 이 화면에 세운다", () => {
    const v = focusViewOf(nodes, cm, "math", new Set(["eq"]));   // eq 는 과학 쪽
    expect(v.guests.map((g) => g.id)).toEqual(["eq"]);
    expect(v.positions.has("eq")).toBe(true);
  });

  it("이미 이 층에 있는 노드는 손님이 아니다", () => {
    const v = focusViewOf(nodes, cm, "math", new Set(["calc", "math"]));
    expect(v.guests).toEqual([]);
  });

  it("손님은 자식들 **뒤** 자리를 받는다 — 바깥에 서서 식구와 구별된다", () => {
    const withGuest = focusViewOf(nodes, cm, "math", new Set(["eq"]));
    const without = focusViewOf(nodes, cm, "math");
    // 자식 자리는 손님이 와도 그대로여야 한다(손님 때문에 식구가 움직이면 안 된다).
    for (const c of without.children) {
      expect(withGuest.positions.get(c.id)).toEqual(without.positions.get(c.id));
    }
  });

  it("손님 자리도 다른 것과 겹치지 않는다", () => {
    const v = focusViewOf(nodes, cm, "math", new Set(["eq", "phys", "doc"]));
    const seen = new Set([...v.positions.values()].map((p) => `${p.x},${p.y}`));
    expect(seen.size).toBe(v.positions.size);
  });

  it("없는 id 는 조용히 무시한다", () => {
    expect(focusViewOf(nodes, cm, "math", new Set(["사라진id"])).guests).toEqual([]);
  });

  it("손님을 안 주면 예전과 같다", () => {
    expect(focusViewOf(nodes, cm, "math").guests).toEqual([]);
  });
});

describe("ringSlots — 자리 나누기", () => {
  it("개수만큼 자리를 준다", () => {
    for (const n of [0, 1, 3, 10, 16, 40, 80]) {
      expect(ringSlots(n).length, `n=${n}`).toBe(n);
    }
  });

  it("자리가 서로 겹치지 않는다", () => {
    for (const n of [3, 10, 16, 30, 45]) {
      const slots = ringSlots(n);
      for (let i = 0; i < slots.length; i += 1) {
        for (let j = i + 1; j < slots.length; j += 1) {
          const d = Math.hypot(slots[i].x - slots[j].x, slots[i].y - slots[j].y);
          expect(d, `n=${n} 자리 ${i}·${j} 가 붙어 있다 (거리 ${d.toFixed(2)})`).toBeGreaterThan(3);
        }
      }
    }
  });

  it("가운데(초점 노드)를 침범하지 않는다", () => {
    for (const s of ringSlots(45)) {
      expect(Math.hypot(s.x - 50, s.y - 50)).toBeGreaterThan(20);
    }
  });

  it("화면 밖으로 나가지 않는다", () => {
    for (const s of ringSlots(45)) {
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThan(100);
      expect(s.y).toBeGreaterThan(0);
      expect(s.y).toBeLessThan(100);
    }
  });
});

describe("drillTargetOf — 들어갈 수 있나", () => {
  it("자식이 있으면 그 노드로 들어간다", () => {
    expect(drillTargetOf({ id: "math" }, cm)).toBe("math");
  });
  it("말단이면 들어갈 데가 없다 — 빈 화면에 갇히지 않는다", () => {
    expect(drillTargetOf({ id: "gd" }, cm)).toBe(null);
    expect(drillTargetOf(null, cm)).toBe(null);
  });
});

describe("pathTo — 나가는 길", () => {
  it("뿌리부터 지금 자리까지 이어진다", () => {
    expect(pathTo("gd", nodes).map((n) => n.label)).toEqual(["내 생기부", "수학", "미적분", "경사 하강법"]);
  });
  it("뿌리에서는 저 하나뿐", () => {
    expect(pathTo("doc", nodes).map((n) => n.id)).toEqual(["doc"]);
  });
  it("어느 노드에서든 길은 반드시 뿌리에서 시작한다", () => {
    for (const n of nodes) {
      expect(pathTo(n.id, nodes)[0].id, `${n.id} 의 길이 뿌리에서 시작하지 않는다`).toBe("doc");
    }
  });
  it("부모 고리가 순환해도 멈춘다", () => {
    const cyc = [{ id: "a", parentId: "b", label: "가" }, { id: "b", parentId: "a", label: "나" }];
    expect(pathTo("a", cyc).length).toBe(2);
  });
});

describe("parentOf / rootIdOf", () => {
  it("한 층 위를 준다", () => {
    expect(parentOf("calc", nodes)).toBe("math");
    expect(parentOf("doc", nodes)).toBe(null);   // 뿌리에서는 더 갈 곳이 없다
  });
  it("문서 노드를 뿌리로 삼는다", () => {
    expect(rootIdOf(nodes, cm)).toBe("doc");
  });
  it("문서가 없으면 자식이 가장 많은 노드를 뿌리로 삼는다", () => {
    const noDoc = [
      { id: "a", kind: "topic", parentId: null }, { id: "b", kind: "leaf", parentId: "a" },
      { id: "c", kind: "leaf", parentId: "a" }, { id: "d", kind: "topic", parentId: null },
    ];
    expect(rootIdOf(noDoc, childMapOf(noDoc))).toBe("a");
  });
});

describe("별 모양 그래프 — 층을 한 번도 안 세운 계정", () => {
  // 실측: 계정 165개 중 층이 있는 것은 17개뿐이다.
  const star = [
    { id: "doc", kind: "root", label: "내 생기부", parentId: null },
    ...Array.from({ length: 60 }, (_, i) => ({ id: `k${i}`, kind: "leaf", label: `개념${i}`, parentId: "doc" })),
  ];
  const scm = childMapOf(star);

  it("뿌리에 개념 60개가 통째로 매달린다", () => {
    expect(focusViewOf(star, scm, "doc").children.length).toBe(60);
  });
  it("어느 개념으로도 들어갈 수 없다", () => {
    expect(star.slice(1).every((n) => drillTargetOf(n, scm) === null)).toBe(true);
  });
  it("60개여도 자리가 겹치지 않는다", () => {
    const v = focusViewOf(star, scm, "doc");
    const seen = new Set([...v.positions.values()].map((p) => `${p.x},${p.y}`));
    expect(seen.size).toBe(61);
  });
});
