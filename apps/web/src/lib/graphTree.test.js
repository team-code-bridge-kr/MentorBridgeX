/**
 * 접기 셈 — 화면 없이 규칙만 확인한다.
 *
 * 여기서 지키려는 것은 계획의 불변식 둘이다.
 *   ① 접힌 것의 자손만 숨는다(자기 자신은 남아야 다시 편다)
 *   ② 접기는 `parentId`(배치 트리)를 따른다 — 개념은 부모가 둘일 수 있다
 */
import { describe, expect, it } from "vitest";
import {
  ancestorsOf, childMapOf, collapsedForDepth, descendantCount,
  hiddenBy, levelOf, sameSet, strayIdsOf,
} from "./graphTree.js";

// 백엔드 `graph_structure.py` 가 세우는 4층을 본뜬 표본.
//   doc ─ 수학 ─ 미적분 ─ 경사하강법 / 극한
//      │      └ 확률과통계 ─ 베이즈
//      └ 과학 ─ 물리학 ─ 등가원리
//   그리고 어느 가지에도 안 붙은 '외톨이'
const nodes = [
  { id: "doc",   kind: "root",  label: "내 생기부", parentId: null },
  { id: "math",  kind: "topic", label: "수학",      parentId: "doc",  familyKey: "수학" },
  { id: "sci",   kind: "topic", label: "과학",      parentId: "doc",  familyKey: "과학" },
  { id: "calc",  kind: "topic", label: "미적분",     parentId: "math", sectionId: "s1" },
  { id: "stat",  kind: "topic", label: "확률과 통계", parentId: "math", sectionId: "s2" },
  { id: "phys",  kind: "topic", label: "물리학",     parentId: "sci",  sectionId: "s3" },
  { id: "gd",    kind: "leaf",  label: "경사 하강법", parentId: "calc" },
  { id: "lim",   kind: "leaf",  label: "극한",       parentId: "calc" },
  { id: "bayes", kind: "leaf",  label: "베이즈 정리", parentId: "stat" },
  { id: "eq",    kind: "leaf",  label: "등가원리",    parentId: "phys" },
  { id: "lone",  kind: "leaf",  label: "외톨이",      parentId: null },
];
const edges = [
  { from: "math", to: "doc" }, { from: "sci", to: "doc" },
  { from: "calc", to: "math" }, { from: "stat", to: "math" }, { from: "phys", to: "sci" },
  { from: "gd", to: "calc" }, { from: "lim", to: "calc" },
  { from: "bayes", to: "stat" }, { from: "eq", to: "phys" },
  // 개념 하나가 두 구획에 걸린 경우(백엔드 MAX_PARENTS=2). 배치 부모는 calc 뿐.
  { from: "gd", to: "stat" },
];
const cm = childMapOf(nodes);
const visible = (collapsed) => {
  const h = hiddenBy(collapsed, cm);
  return nodes.filter((n) => !h.has(n.id)).map((n) => n.id);
};

describe("childMapOf", () => {
  it("부모별 자식을 모은다", () => {
    expect(cm.get("doc")).toEqual(["math", "sci"]);
    expect(cm.get("calc")).toEqual(["gd", "lim"]);
  });
  it("부모 없는 노드는 어디에도 안 담긴다", () => {
    expect(cm.has("lone")).toBe(false);
    expect(cm.has("doc")).toBe(true);   // doc 은 부모가 없지만 자식은 있다
  });
});

describe("hiddenBy", () => {
  it("접힌 노드 자신은 숨지 않는다 — 머리가 남아야 다시 편다", () => {
    const h = hiddenBy(new Set(["calc"]), cm);
    expect(h.has("calc")).toBe(false);
    expect([...h].sort()).toEqual(["gd", "lim"]);
  });

  it("자손을 끝까지 따라간다", () => {
    expect([...hiddenBy(new Set(["math"]), cm)].sort())
      .toEqual(["bayes", "calc", "gd", "lim", "stat"]);
  });

  it("두 부모를 거쳐 같은 노드에 닿아도 멈춘다", () => {
    // gd 는 calc·stat 양쪽에서 닿을 수 있다. 무한루프에 빠지면 여기서 멈춘다.
    const h = hiddenBy(new Set(["math", "sci"]), cm);
    expect(h.has("gd")).toBe(true);
    expect(h.size).toBe(7);
  });

  it("아무것도 안 접으면 아무것도 안 숨는다", () => {
    expect(hiddenBy(new Set(), cm).size).toBe(0);
    expect(hiddenBy(null, cm).size).toBe(0);
  });

  it("떠돌이 노드는 접기의 영향을 받지 않는다", () => {
    expect(visible(new Set(["doc"]))).toContain("lone");
  });
});

describe("descendantCount — 접힌 노드에 붙는 +N", () => {
  it("자손 수를 셈한다", () => {
    expect(descendantCount("calc", cm)).toBe(2);
    expect(descendantCount("math", cm)).toBe(5);
    expect(descendantCount("gd", cm)).toBe(0);
  });
  it("+N 은 실제로 숨는 노드 수와 같아야 한다", () => {
    for (const id of ["doc", "math", "sci", "calc", "stat", "phys"]) {
      expect(descendantCount(id, cm)).toBe(hiddenBy(new Set([id]), cm).size);
    }
  });
});

describe("깊이 알약 프리셋", () => {
  it("층을 매긴다 (문서0·교과군1·구획2·개념3)", () => {
    expect(levelOf(nodes[0])).toBe(0);
    expect(levelOf(nodes[1])).toBe(1);
    expect(levelOf(nodes[3])).toBe(2);
    expect(levelOf(nodes[6])).toBe(3);
  });

  it("「교과」는 교과군을 접어 구획·개념을 감춘다", () => {
    expect(visible(collapsedForDepth(nodes, 1, cm)).sort())
      .toEqual(["doc", "lone", "math", "sci"]);
  });

  it("「과목」은 구획을 접어 개념만 감춘다", () => {
    expect(visible(collapsedForDepth(nodes, 2, cm)).sort())
      .toEqual(["calc", "doc", "lone", "math", "phys", "sci", "stat"]);
  });

  it("「개념」은 빈 집합이다 — 아래가 없어 접을 것이 없다", () => {
    // 여기가 비지 않으면 "다 펼친 상태"와 「개념」 상태가 달라 보여서
    // 알약에 불이 안 켜지고, 저장해 둘 값만 커진다.
    expect(collapsedForDepth(nodes, 3, cm).size).toBe(0);
  });

  it("자식 없는 노드는 프리셋에 담지 않는다", () => {
    const only = [{ id: "a", kind: "topic", parentId: "doc", familyKey: "빈교과" }];
    expect(collapsedForDepth(only, 1, childMapOf(only)).size).toBe(0);
  });
});

describe("sameSet — 알약에 불을 켤지", () => {
  it("차례가 달라도 같으면 같다", () => {
    expect(sameSet(new Set(["a", "b"]), new Set(["b", "a"]))).toBe(true);
  });
  it("손으로 하나 더 접으면 프리셋과 달라진다", () => {
    const preset = collapsedForDepth(nodes, 2, cm);
    expect(sameSet(new Set([...preset, "math"]), preset)).toBe(false);
  });
  it("손으로 하나 펴도 달라진다", () => {
    const preset = collapsedForDepth(nodes, 2, cm);
    const opened = new Set(preset); opened.delete("calc");
    expect(sameSet(opened, preset)).toBe(false);
  });
});

describe("ancestorsOf — 접힌 가지 안의 노드를 드러내기", () => {
  it("가까운 쪽부터 준다", () => {
    expect(ancestorsOf("gd", nodes)).toEqual(["calc", "math", "doc"]);
  });
  it("뿌리와 떠돌이는 조상이 없다", () => {
    expect(ancestorsOf("doc", nodes)).toEqual([]);
    expect(ancestorsOf("lone", nodes)).toEqual([]);
  });
  it("조상을 펴면 그 노드가 실제로 보인다", () => {
    const collapsed = new Set(["math"]);
    expect(hiddenBy(collapsed, cm).has("gd")).toBe(true);
    for (const a of ancestorsOf("gd", nodes)) collapsed.delete(a);
    expect(hiddenBy(collapsed, cm).has("gd")).toBe(false);
  });
  it("부모 고리가 순환해도 멈춘다", () => {
    const cyc = [{ id: "a", parentId: "b" }, { id: "b", parentId: "a" }];
    expect(ancestorsOf("a", cyc)).toEqual(["b"]);
  });
});

describe("strayIdsOf", () => {
  it("선이 하나도 없는 노드만 고른다", () => {
    expect([...strayIdsOf(nodes, edges)]).toEqual(["lone"]);
  });
  it("선이 없으면 전부 떠돌이다", () => {
    expect(strayIdsOf(nodes, []).size).toBe(nodes.length);
  });
});
