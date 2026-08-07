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
const click = async (el) => { await act(async () => { el.click(); }); await settle(); };

beforeEach(async () => {
  stubFetch();
  await mount();
});
afterEach(async () => {
  await act(async () => { root.unmount(); });
  host.remove();
  vi.unstubAllGlobals();
});

describe("첫 화면 — 뿌리 층", () => {
  it("오류 없이 그려진다", () => {
    expect(html().length).toBeGreaterThan(500);
  });

  it("문서와 교과군만 보인다 — 손자는 안 보인다", () => {
    // 이게 시야가 걷히는 까닭이다. 197노드 계정 기준 17개만 남는다.
    expect(html()).toContain("수학");
    expect(html()).toContain("과학");
    expect(html()).not.toContain("미적분");
    expect(html()).not.toContain("경사 하강법");
  });

  it("화면에 선 노드는 문서 1 + 교과군 2 = 3개뿐", () => {
    // 동그라미로 세지 않는다 — 범례에도 색 점이 있어서 같이 걸린다.
    expect(all(".graph-canvas [style*='pointer-events: auto']")
      .map((n) => n.textContent).filter(Boolean).sort())
      .toEqual(["과학", "내 생기부", "수학"]);
  });

  it("경로표시가 지금 자리를 알려준다", () => {
    const items = all(".gcrumb-item").map((b) => b.textContent);
    expect(items).toEqual(["내 생기부"]);
    expect(host.querySelector(".gcrumb-item").className).toContain("is-here");
  });

  it("툴바는 넷이다 — 으뜸 단추는 하나뿐", () => {
    expect(host.querySelector(".toolbar-graph")).toBeTruthy();
    expect(btn("노드 추가")).toBeTruthy();
    expect(btn("둘러보기")).toBeTruthy();
    expect(btn("더보기")).toBeTruthy();
    expect(all(".btn-primary").length).toBe(1);
  });

  it("걷어낸 단추는 없다", () => {
    for (const t of ["변경 이력", "가지치기 추천", "노드 상세 보기"]) {
      expect(btn(t), `"${t}" 가 아직 있다`).toBeUndefined();
    }
    // 깊이 알약도 없앴다 — 층을 오가는 길이 둘이면 어느 쪽이 진짜인지 알 수 없다.
    expect(all(".depth-btn").length).toBe(0);
  });

  it("안에 몇 개 더 있는지 배지로 알려준다", () => {
    const badges = all(".g-fold").map((b) => b.textContent).sort();
    // 수학 아래 5개(미적분·확통·경사·극한·베이즈), 과학 아래 2개(물리·등가원리)
    expect(badges).toEqual(["2", "5"]);
  });
});

describe("들어가고 나오기", () => {
  const label = (t) => all("span").find((s) => s.textContent === t);

  it("교과군을 누르면 그 구획들로 들어간다", async () => {
    await click(label("수학"));
    expect(html()).toContain("미적분");
    expect(html()).toContain("확률과 통계");
    expect(html()).not.toContain("물리학");     // 남의 가지는 안 보인다
    expect(html()).not.toContain("경사 하강법"); // 손자도 안 보인다
  });

  it("경로표시가 따라 늘어난다", async () => {
    await click(label("수학"));
    expect(all(".gcrumb-item").map((b) => b.textContent)).toEqual(["내 생기부", "수학"]);
  });

  it("구획까지 내려가면 개념이 보인다", async () => {
    await click(label("수학"));
    await click(label("2학년 미적분"));
    expect(all(".gcrumb-item").map((b) => b.textContent)).toEqual(["내 생기부", "수학", "2학년 미적분"]);
    expect(html()).toContain("경사 하강법");
    expect(html()).toContain("극한");
  });

  it("경로표시를 누르면 그 층으로 돌아간다", async () => {
    await click(label("수학"));
    await click(label("2학년 미적분"));
    await click(all(".gcrumb-item")[0]);          // 「내 생기부」
    expect(all(".gcrumb-item").length).toBe(1);
    expect(html()).toContain("수학");
    expect(html()).not.toContain("미적분");
  });

  it("말단 개념을 누르면 고르기만 하고 들어가지 않는다", async () => {
    // 빈 화면으로 데려가면 길을 잃는다.
    await click(label("수학"));
    await click(label("2학년 미적분"));
    const before = all(".gcrumb-item").length;
    await click(label("경사 하강법"));
    expect(all(".gcrumb-item").length).toBe(before);
    expect(all(".gpanel").length).toBe(1);          // 패널은 열린다
  });

  /** 빈 배경을 끌지 않고 누르기만 하기. */
  const tapBackground = async () => {
    const canvas = host.querySelector(".graph-canvas");
    await act(async () => {
      canvas.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 5, clientY: 5 }));
      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0, clientX: 5, clientY: 5 }));
    });
    await settle();
  };

  it("배경을 누르면 선택부터 놓고, 다시 누르면 한 층 위로", async () => {
    // 두 단계인 까닭: 들어간 노드는 패널에도 서 있다. 보던 것을 놓기도 전에
    // 층이 바뀌면 어디로 갔는지 알 수 없다.
    await click(label("수학"));
    expect(all(".gcrumb-item").length).toBe(2);
    expect(all(".gpanel").length).toBe(1);

    await tapBackground();
    expect(all(".gpanel").length).toBe(0);         // 선택만 풀린다
    expect(all(".gcrumb-item").length).toBe(2);    // 층은 그대로

    await tapBackground();
    expect(all(".gcrumb-item").length).toBe(1);    // 이제 위로
  });

  it("뿌리에서 배경을 눌러도 더 갈 곳이 없다", async () => {
    expect(all(".gcrumb-item").length).toBe(1);
    await tapBackground();
    await tapBackground();
    expect(all(".gcrumb-item").length).toBe(1);
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

  it("다른 층의 노드를 찾으면 그 층으로 데려간다", async () => {
    // 초점이 검색을 망가뜨리면 안 된다 — 이름을 정확히 알아도 못 찾게 된다.
    expect(html()).not.toContain("베이즈 정리");
    await type("베이즈");
    expect(html()).toContain("베이즈 정리");
    expect(all(".gcrumb-item").map((b) => b.textContent))
      .toEqual(["내 생기부", "수학", "3학년 확률과 통계"]);
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
    const l = all("span").find((s) => s.textContent === "수학");
    if (l) await click(l);
    expect(panels()).toBe(1);
    expect(host.querySelector(".gpanel-title").textContent).toBe("노드");
  });
});

describe("노드 패널", () => {
  const openNode = async () => {
    const l = all("span").find((s) => s.textContent === "수학");
    expect(l, "이름표를 못 찾았다").toBeTruthy();
    await click(l);
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
    const other = all("span").find((s) => ["과학", "2학년 미적분", "3학년 확률과 통계"].includes(s.textContent));
    expect(other, "다른 이름표를 못 찾았다").toBeTruthy();
    await click(other);
    expect(all(".gpanel").length).toBe(1);
    expect(host.querySelector(".gpanel").textContent).not.toBe(first);
  });
});

describe("연결 추가 — 후보는 그래프 전체", () => {
  const openNode = async () => {
    const l = all("span").find((s) => s.textContent === "수학");
    await click(l);
  };
  const openConnect = async () => {
    await openNode();
    await click(btn("연결 추가"));
  };

  it("지금 층에 없는 노드도 후보에 뜬다", async () => {
    // 예전에는 보고 있는 층으로 걸러 넘겨서, 다른 층 노드와는 이을 수 없었다.
    await openConnect();
    const input = host.querySelector(".gpick").previousElementSibling;
    expect(input.getAttribute("placeholder")).toContain("개)");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    await act(async () => {
      setter.call(input, "베이즈");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await settle();
    expect(all(".gpick-name").map((n) => n.textContent)).toContain("베이즈 정리");
  });

  it("고르면 그 노드가 캔버스에 잠시 선다", async () => {
    await openConnect();
    const input = host.querySelector(".gpick").previousElementSibling;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    await act(async () => {
      setter.call(input, "베이즈");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await settle();
    const onCanvasBefore = all(".graph-canvas [style*='pointer-events: auto']").map((n) => n.textContent);
    expect(onCanvasBefore).not.toContain("베이즈 정리");   // 아직 캔버스엔 없다
    await click(all(".gpick-row")[0]);
    // 이제 캔버스에 손님으로 서 있다 — 무엇과 잇는 중인지 눈으로 보인다.
    const onCanvas = all(".graph-canvas [style*='pointer-events: auto']").map((n) => n.textContent);
    expect(onCanvas).toContain("베이즈 정리");
    expect(all(".gnode.is-guest").length).toBe(1);
  });

  it("층을 옮기면 손님은 돌아간다", async () => {
    await openConnect();
    const input = host.querySelector(".gpick").previousElementSibling;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    await act(async () => {
      setter.call(input, "베이즈");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await settle();
    await click(all(".gpick-row")[0]);
    expect(all(".gnode.is-guest").length).toBe(1);
    await click(all(".gcrumb-item")[0]);            // 뿌리로
    expect(all(".gnode.is-guest").length).toBe(0);
  });

  it("후보 개수를 미리 알려주고 목록은 여덟 개까지만 편다", async () => {
    await openConnect();
    const input = host.querySelector(".gpick").previousElementSibling;
    // 「수학」은 문서·미적분·확통과 이미 이어져 있으므로 후보는 나머지 전부다.
    expect(input.getAttribute("placeholder")).toBe("이을 노드 찾기 (7개)");
    expect(all(".gpick-row").length).toBeLessThanOrEqual(8);
  });
});

describe("보던 자리를 기억한다", () => {
  it("어느 층에 있었는지 sessionStorage 에 남긴다", async () => {
    const l = all("span").find((s) => s.textContent === "수학");
    await click(l);
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });   // 디바운스
    expect(JSON.parse(sessionStorage.getItem("mbx_graph_view")).focusId).toBe("math");
  });
});
