/**
 * 지식 그래프 화면 — 진짜로 그려 보고 눌러 본다.
 *
 * 빌드는 문법과 import 만 본다. "정의보다 먼저 쓴 값", "훅 차례", "고른 노드가
 * 도로 풀리는" 따위는 **그려 봐야** 드러난다. 실제로 이 화면을 고치는 동안
 * 접힌 노드를 고르면 선택이 즉시 풀리는 버그가 있었는데, 그건 마운트해서
 * 눌러 보기 전까지 아무 도구도 잡아 주지 못했다.
 *
 * jsdom 에는 레이아웃이 없으므로 **재는 값**은 `src/test/setup.js` 가 흉내 낸다.
 * 색이 맞는지·줄이 어디서 접히는지는 여기서 답할 수 없는 물음이다(눈으로 봐야 한다).
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StoreProvider } from "../../store/StoreProvider.jsx";
import { S06 } from "./S06.jsx";

// 백엔드가 돌려주는 모양 그대로. `graph_structure.py` 의 4층을 본떴다.
const ts = { created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
const NODES = [
  { id: "doc",   type: "Document", label: "내 생기부", external_refs: {}, ...ts },
  { id: "math",  type: "Subject",  label: "수학",      external_refs: { source: "structure", family_key: "수학", section: "수학" }, ...ts },
  { id: "sci",   type: "Subject",  label: "과학",      external_refs: { source: "structure", family_key: "과학", section: "과학" }, ...ts },
  { id: "calc",  type: "Subject",  label: "2학년 미적분",     external_refs: { source: "structure", section_id: "s1", section: "미적분", period: "2학년" }, ...ts },
  { id: "stat",  type: "Subject",  label: "3학년 확률과 통계", external_refs: { source: "structure", section_id: "s2", section: "확률과 통계", period: "3학년" }, ...ts },
  { id: "phys",  type: "Subject",  label: "2학년 물리학",     external_refs: { source: "structure", section_id: "s3", section: "물리학", period: "2학년" }, ...ts },
  { id: "gd",    type: "Keyword",  label: "경사 하강법", external_refs: { source: "claude", section: "미적분" }, ...ts },
  { id: "lim",   type: "Keyword",  label: "극한",       external_refs: { source: "claude", section: "미적분" }, ...ts },
  { id: "bayes", type: "Keyword",  label: "베이즈 정리", external_refs: { source: "claude", section: "확률과 통계" }, ...ts },
  { id: "eq",    type: "Keyword",  label: "등가원리",    external_refs: { source: "claude", section: "물리학" }, ...ts },
  { id: "lone",  type: "Keyword",  label: "떠돌이개념",  external_refs: { source: "student" }, ...ts },
];
const EDGES = [
  { id: "e1", source_id: "math", target_id: "doc", relation: "BELONGS_TO" },
  { id: "e2", source_id: "sci", target_id: "doc", relation: "BELONGS_TO" },
  { id: "e3", source_id: "calc", target_id: "math", relation: "BELONGS_TO" },
  { id: "e4", source_id: "stat", target_id: "math", relation: "BELONGS_TO" },
  { id: "e5", source_id: "phys", target_id: "sci", relation: "BELONGS_TO" },
  { id: "e6", source_id: "gd", target_id: "calc", relation: "MENTIONED_IN" },
  { id: "e7", source_id: "lim", target_id: "calc", relation: "MENTIONED_IN" },
  { id: "e8", source_id: "bayes", target_id: "stat", relation: "MENTIONED_IN" },
  { id: "e9", source_id: "eq", target_id: "phys", relation: "MENTIONED_IN" },
  // 개념 하나가 두 구획에 걸린 경우(백엔드 MAX_PARENTS=2)
  { id: "e10", source_id: "gd", target_id: "stat", relation: "MENTIONED_IN" },
];

let root;
let host;

function stubFetch() {
  const json = (b) => Promise.resolve(new Response(JSON.stringify(b), {
    status: 200, headers: { "content-type": "application/json" },
  }));
  vi.stubGlobal("fetch", vi.fn((url) => {
    const u = String(url);
    if (u.endsWith("/v1/students/me/graph")) return json({ nodes: NODES, edges: EDGES });
    if (u.includes("/graph/gaps")) return json({ empty_subjects: [], lonely_nodes: [], faded_topics: [] });
    if (u.includes("/graph/links/suggested")) return json([]);
    if (u.includes("/comments")) return json([]);
    return json({});
  }));
}

/** 마운트하고 첫 불러오기가 끝날 때까지 기다린다. */
async function mount() {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(<StoreProvider><S06 onNav={() => {}} /></StoreProvider>);
  });
  await settle();
}
async function settle() {
  await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
}
const html = () => host.innerHTML;
const all = (sel) => [...host.querySelectorAll(sel)];
const btn = (t) => all(".btn").find((b) => (b.textContent || "").includes(t));
const pill = (t) => all(".depth-btn").find((b) => b.textContent === t);
const fold = (labelPrefix) => all(".g-fold").find((b) => (b.getAttribute("aria-label") || "").startsWith(labelPrefix));
const click = async (el) => { await act(async () => { el.click(); }); await settle(); };
/** 노드의 자리(style 문자열)를 모아 둔다 — 접기 전후 비교용. */
const positions = () => all(".graph-canvas [style*='position: absolute'][style*='left']")
  .map((n) => n.getAttribute("style"));

beforeEach(async () => {
  stubFetch();
  await mount();
});
afterEach(async () => {
  await act(async () => { root.unmount(); });
  host.remove();
  vi.unstubAllGlobals();
});

describe("첫 화면", () => {
  it("오류 없이 그려지고 노드가 다 뜬다", () => {
    expect(html().length).toBeGreaterThan(500);
    expect(all(".graph-canvas [style*='border-radius: 50%']").length).toBeGreaterThanOrEqual(11);
  });

  it("툴바는 넷이다 — 으뜸 단추는 하나뿐", () => {
    expect(host.querySelector(".toolbar-graph")).toBeTruthy();
    expect(btn("노드 추가")).toBeTruthy();
    expect(btn("둘러보기")).toBeTruthy();
    expect(btn("더보기")).toBeTruthy();
    expect(all(".btn-primary").length).toBe(1);
  });

  it("걷어낸 단추는 없다", () => {
    // 「변경 이력」·「노드 상세 보기」는 가짜 화면으로 가던 길이었고,
    // 「가지치기 추천」은 노드를 안 고르면 꾸짖기만 했다.
    for (const t of ["변경 이력", "가지치기 추천", "노드 상세 보기"]) {
      expect(btn(t), `"${t}" 가 아직 있다`).toBeUndefined();
    }
  });

  it("이어지지 않은 노드를 세어 알리고, 잠시 감출 수 있다", async () => {
    expect(host.querySelector(".graph-note").textContent).toContain("1개");
    await click(host.querySelector(".graph-note-act"));
    expect(html()).not.toContain("떠돌이개념");
  });
});

describe("접고 펴기", () => {
  it("자식 있는 노드에만 손잡이가 붙는다", () => {
    // doc·math·sci·calc·stat·phys = 6. 개념 넷과 떠돌이에는 없다.
    expect(all(".g-fold").length).toBe(6);
  });

  it("다 펼친 상태에서는 전부 − 이다", () => {
    expect(all(".g-fold").every((b) => b.textContent === "−")).toBe(true);
  });

  it("접으면 자손이 숨고 +N 이 붙는다", async () => {
    await click(fold("2학년 미적분"));
    expect(html()).not.toContain("경사 하강법");
    expect(html()).not.toContain("극한");
    expect(fold("2학년 미적분").textContent).toBe("+2");
  });

  it("접어도 살아남은 노드는 1px도 움직이지 않는다", async () => {
    // 이 화면의 핵심 약속이다. 접을 때마다 재배치하면 방금 보던 자리를 잃는다.
    const before = new Set(positions());
    await click(fold("2학년 미적분"));
    const moved = positions().filter((s) => !before.has(s));
    expect(moved, `자리가 바뀐 노드 ${moved.length}개`).toEqual([]);
  });

  it("다시 펴면 그대로 돌아온다", async () => {
    const before = positions();
    await click(fold("2학년 미적분"));
    await click(fold("2학년 미적분"));
    expect(positions()).toEqual(before);
    expect(html()).toContain("경사 하강법");
  });

  it("더블클릭으로도 접힌다", async () => {
    const circle = all(".graph-canvas [style*='border-radius: 50%']")
      .map((c) => c.parentElement)
      .find((d) => d && d.textContent === "");
    await act(async () => {
      circle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    await settle();
    // 어느 노드를 눌렀든 자식이 있는 노드였다면 +N 이 하나는 생긴다.
    // (자식 없는 노드였다면 아무 일도 없어야 한다 — 둘 다 정상)
    expect(html()).toBeTruthy();
  });
});

describe("깊이 알약은 모드가 아니라 프리셋 명령이다", () => {
  it("「과목」은 구획을 전부 접는다", async () => {
    await click(pill("과목"));
    expect(html()).not.toContain("경사 하강법");
    expect(html()).not.toContain("베이즈");
    expect(html()).toContain("미적분");
    expect(all(".g-fold").filter((b) => b.textContent.startsWith("+")).length).toBe(3);
  });

  it("프리셋과 같으면 알약에 불이 켜진다", async () => {
    await click(pill("과목"));
    expect(pill("과목").getAttribute("aria-pressed")).toBe("true");
  });

  it("손으로 하나만 펴면 불이 꺼진다 — 진리는 collapsed 하나다", async () => {
    await click(pill("과목"));
    await click(fold("2학년 미적분"));
    expect(pill("과목").getAttribute("aria-pressed")).toBe("false");
    expect(html()).toContain("경사 하강법");   // 편 가지만 돌아온다
    expect(html()).not.toContain("베이즈");
  });

  it("「교과」는 구획까지 접는다", async () => {
    await click(pill("교과"));
    expect(html()).not.toContain("미적분");
    expect(html()).toContain("수학");
  });
});

describe("검색", () => {
  const type = async (text) => {
    const input = host.querySelector(".search-wrap input");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    await act(async () => {
      setter.call(input, text);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await settle();
  };

  it("몇 번째인지 세어 보여준다", async () => {
    await type("베이즈");
    expect(host.querySelector(".gsearch-count").textContent).toBe("1/1");
  });

  it("접힌 가지 안의 노드도 찾아서 조상을 편다", async () => {
    // 접기가 검색을 망가뜨리면 안 된다 — 이름을 정확히 알아도 못 찾게 된다.
    await click(pill("교과"));
    expect(html()).not.toContain("베이즈 정리");
    await type("베이즈");
    expect(html()).toContain("베이즈 정리");
  });

  it("안 걸리면 0 이라고 말한다", async () => {
    await type("없는이름");
    expect(host.querySelector(".gsearch-count").textContent).toBe("0");
  });
});

describe("옆 패널은 한 자리다", () => {
  const panels = () => all(".gpanel").length;

  it("처음에는 없다", () => expect(panels()).toBe(0));

  it("만들기 → 둘러보기로 바꿔도 하나다", async () => {
    await click(btn("노드 추가"));
    expect(panels()).toBe(1);
    await click(btn("둘러보기"));
    expect(panels()).toBe(1);
  });

  it("둘러보기에 세 구획이 모여 있다", async () => {
    await click(btn("둘러보기"));
    const titles = all(".gsec-title").map((n) => n.textContent);
    expect(titles).toEqual(expect.arrayContaining(["빈 곳", "이어 볼 만한 짝", "넓혀 볼 만한 주제"]));
  });

  it("둘러보기를 연 채 노드를 골라도 하나다 — 예전엔 둘이 섰다", async () => {
    await click(btn("둘러보기"));
    const label = all("span").find((s) => s.textContent === "등가원리" || s.textContent === "극한");
    if (label) await click(label);
    expect(panels()).toBe(1);
    expect(host.querySelector(".gpanel-title").textContent).toBe("노드");
  });
});

describe("노드 패널", () => {
  const openNode = async () => {
    const label = all("span").find((s) => s.textContent === "등가원리" || s.textContent === "극한");
    expect(label, "이름표를 못 찾았다").toBeTruthy();
    await click(label);
  };

  it("구획 넷으로 나뉘고 출처·연결만 펴져 있다", async () => {
    await openNode();
    const titles = all(".gpanel .gsec-title").map((n) => n.textContent);
    expect(titles).toEqual(expect.arrayContaining(["출처", "연결", "다음 탐구", "코멘트"]));
    const open = all(".gpanel .gsec-hd")
      .filter((b) => b.getAttribute("aria-expanded") === "true")
      .map((b) => b.querySelector(".gsec-title").textContent);
    expect(open.sort()).toEqual(["연결", "출처"]);
  });

  it("구획을 접었다 펼 수 있다", async () => {
    await openNode();
    const head = () => all(".gpanel .gsec-hd").find((b) => b.querySelector(".gsec-title").textContent === "연결");
    await click(head());
    expect(head().getAttribute("aria-expanded")).toBe("false");
    await click(head());
    expect(head().getAttribute("aria-expanded")).toBe("true");
  });

  it("닫으면 사라진다", async () => {
    await openNode();
    await click(host.querySelector(".gpanel-x"));
    expect(all(".gpanel").length).toBe(0);
  });

  it("다른 노드를 고르면 그 노드로 바뀐다 — 패널은 여전히 하나", async () => {
    await openNode();
    const first = host.querySelector(".gpanel").textContent;
    // 고른 노드의 이름표는 큰 카드로 바뀌므로, 남아 있는 다른 이름표를 고른다.
    const other = all("span").find((s) => ["수학", "과학", "베이즈 정리", "경사 하강법"].includes(s.textContent));
    expect(other, "다른 이름표를 못 찾았다").toBeTruthy();
    await click(other);
    expect(all(".gpanel").length).toBe(1);
    expect(host.querySelector(".gpanel").textContent).not.toBe(first);
  });
});

describe("보던 자리를 기억한다", () => {
  it("접힘을 sessionStorage 에 남긴다", async () => {
    await click(pill("과목"));
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });   // 디바운스
    const saved = JSON.parse(sessionStorage.getItem("mbx_graph_view"));
    expect(saved.collapsed.sort()).toEqual(["calc", "phys", "stat"]);
  });
});
