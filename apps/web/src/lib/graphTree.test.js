/**
 * 부모–자식 셈.
 *
 * 층을 오가는 규칙은 `graphFocus.test.js` 에 있다. 여기서는 그 바탕이 되는
 * 관계 셈만 본다 — 특히 **개념이 부모를 둘 가질 수 있다**는 사실 때문에
 * 자손을 셀 때 같은 노드를 두 번 세거나 무한히 도는 일이 없어야 한다.
 */
import { describe, expect, it } from "vitest";
import { childMapOf, descendantCount, strayIdsOf } from "./graphTree.js";

// 백엔드 `graph_structure.py` 가 세우는 4층을 본뜬 표본.
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

describe("childMapOf", () => {
  it("부모별 자식을 모은다", () => {
    expect(cm.get("doc")).toEqual(["math", "sci"]);
    expect(cm.get("calc")).toEqual(["gd", "lim"]);
  });

  it("부모 없는 노드는 어디에도 안 담긴다", () => {
    expect(cm.has("lone")).toBe(false);
    expect(cm.has("doc")).toBe(true);   // doc 은 부모가 없지만 자식은 있다
  });

  it("엣지가 아니라 parentId 를 따른다", () => {
    // gd 는 stat 으로도 선이 있지만(MAX_PARENTS=2) 배치 부모는 calc 하나다.
    expect(cm.get("stat")).toEqual(["bayes"]);
    expect(cm.get("stat")).not.toContain("gd");
  });
});

describe("descendantCount — 안에 N개 더", () => {
  it("직계가 아니라 자손 전부를 센다", () => {
    expect(descendantCount("calc", cm)).toBe(2);
    expect(descendantCount("math", cm)).toBe(5);   // calc·stat·gd·lim·bayes
    expect(descendantCount("doc", cm)).toBe(9);    // lone 만 빠진다
  });

  it("말단은 0", () => {
    expect(descendantCount("gd", cm)).toBe(0);
    expect(descendantCount("없는id", cm)).toBe(0);
  });

  it("고리가 있어도 멈추고 두 번 세지 않는다", () => {
    const cyc = childMapOf([
      { id: "a", parentId: "b" }, { id: "b", parentId: "a" }, { id: "c", parentId: "a" },
    ]);
    expect(descendantCount("a", cyc)).toBe(2);
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
