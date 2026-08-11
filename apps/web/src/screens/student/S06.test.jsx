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

  it("뿌리에서는 경로표시를 세우지 않는다", () => {
    // "내 생기부" 한 칸짜리 경로는 길이 아니라 이름이다.
    expect(all(".gcrumb-item").length).toBe(0);
  });

  it("도구띠 — 만들기는 왼쪽, 가다듬기는 오른쪽", () => {
    // 「시드로 생성」·「층 다시 세우기」는 「더보기」 팝오버 안에 숨어 있었다.
    // 하는 일의 결로 갈라 양쪽에 세운다. 으뜸 단추는 하나뿐이다.
    expect(host.querySelector(".toolbar-graph")).toBeTruthy();
    const groups = all(".gtools").map((g) =>
      [...g.querySelectorAll(".btn")].map((b) => b.textContent.trim()));
    expect(groups).toEqual([
      ["노드 추가", "시드로 생성"],
      ["층 다시 세우기", "확장하기"],
    ]);
    expect(host.querySelector(".toolbar-graph .gsearch")).toBeTruthy();
    expect(btn("더보기"), "더보기는 없앴다").toBeUndefined();
    expect(all(".btn-primary").length).toBe(1);
  });

  it("개수 알약은 캔버스 밖 도구띠에 선다", () => {
    // 캔버스 위에 얹혀 있을 때는 노드를 가리고 드래그도 방해했다.
    expect(host.querySelector(".graph-canvas .gcount"), "캔버스 안에 있으면 안 된다").toBeNull();
    expect(host.querySelector(".toolbar-graph .gcount")).toBeTruthy();
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
    expect(all(".gcrumb-item").length).toBe(0);   // 뿌리로 돌아오면 경로가 사라진다
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
    expect(all(".gcrumb-item").length).toBe(0);    // 뿌리로 — 경로는 사라진다
  });

  it("판이 서면 경로표시도 판 안으로 옮겨 간다", async () => {
    // 판을 읽는 동안 눈은 오른쪽에 있다. 길이 왼쪽 끝에만 있으면 거기까지
    // 되짚어 올라가야 한다. 두 곳에 같이 두지는 않는다 — 어느 쪽이 진짜인지
    // 알 수 없어진다.
    await click(label("수학"));
    expect(all(".gcrumb").length).toBe(1);
    expect(host.querySelector(".gcrumb").closest(".gpanel")).toBeTruthy();

    await tapBackground();                            // 판만 닫는다
    expect(all(".gcrumb").length).toBe(1);            // 길은 남는다
    expect(host.querySelector(".gcrumb").closest(".gpanel")).toBeNull();
  });

  it("판 안 경로표시의 앞 칸이 나가는 길이다", async () => {
    // 「〈 부모」 단추를 따로 두지 않는다 — 경로표시가 그 일을 겸한다.
    await click(label("수학"));
    await click(label("2학년 미적분"));
    const crumbs = all(".gpanel .gcrumb-item");
    expect(crumbs.map((b) => b.textContent)).toEqual(["내 생기부", "수학", "2학년 미적분"]);
    await click(crumbs[1]);                           // 바로 앞 칸 = 한 겹 위
    expect(all(".gcrumb-item").map((b) => b.textContent)).toEqual(["내 생기부", "수학"]);
    expect(all(".gpanel").length).toBe(0);            // 고른 노드는 놓는다
  });

  it("뿌리에서 배경을 눌러도 더 갈 곳이 없다", async () => {
    expect(all(".gcrumb-item").length).toBe(0);
    await tapBackground();
    await tapBackground();
    expect(all(".gcrumb-item").length).toBe(0);
    // 뿌리 층 노드가 그대로 서 있는지로 확인한다
    expect(html()).toContain("수학");
  });
});

describe("검색", () => {
  const type = async (text) => {
    // 검색창이 탐구 피드와 같은 알약(.gsearch)으로 바뀌었다.
    const input = host.querySelector(".gsearch input");
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

  it("만들기 → 확장하기로 바꿔도 하나다", async () => {
    await click(btn("노드 추가"));
    expect(panels()).toBe(1);
    await click(btn("확장하기"));
    expect(panels()).toBe(1);
  });

  it("확장하기에 세 구획이 모여 있다", async () => {
    await click(btn("확장하기"));
    const titles = all(".gsec-title").map((n) => n.textContent);
    expect(titles).toEqual(expect.arrayContaining(["빈 곳", "이어 볼 만한 짝", "넓혀 볼 만한 주제"]));
  });

  it("확장하기를 연 채 노드를 골라도 하나다 — 예전엔 둘이 섰다", async () => {
    await click(btn("확장하기"));
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

  it("구획 넷이 모두 펼쳐져 있다", async () => {
    // 접기를 걷었다. 접힌 것은 **없는 것처럼** 읽혀서, 출처가 일곱 문장
    // 있는데도 그냥 지나쳤다.
    await openNode();
    const titles = all(".gpanel .gsec-title").map((n) => n.textContent);
    expect(titles).toEqual(expect.arrayContaining(["출처", "연결", "다음 탐구", "코멘트"]));
    expect(all(".gpanel .gsec-body").length).toBe(titles.length);
    expect(all(".gpanel .gsec-hd").length).toBe(0);   // 여닫는 단추가 없다
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

describe("보던 자리를 기억한다", () => {
  it("어느 층에 있었는지 sessionStorage 에 남긴다", async () => {
    const l = all("span").find((s) => s.textContent === "수학");
    await click(l);
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });   // 디바운스
    expect(JSON.parse(sessionStorage.getItem("mbx_graph_view")).focusId).toBe("math");
  });
});
