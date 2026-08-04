/**
 * 내 자료 검색 — 노드·문서·음성·코멘트.
 *
 * 예전에는 "통합 검색"(S27)이라는 화면이 따로 있었다. 그런데 사용자가 검색창을
 * 여는 이유는 대개 "아까 그거"를 찾으려는 것이고, 그 "아까 그거"는 활동일 수도
 * 자료일 수도 있다. 검색창이 둘로 나뉘어 있으면 어느 쪽에서 찾을지부터 정해야 한다.
 * 그래서 **활동 기록(S44)의 검색 하나로 합쳤다.**
 *
 * 활동은 서버가 묶어 주지만(`/v1/activity/recent`), 자료는 그런 API 가 없다.
 * 여기서 기존 LIVE API 네 개를 모아 화면에서 거른다 — 예전 S27 이 하던 일 그대로다.
 */

import api from "../api/index.js";

const AREA_LABEL = {
  subject_specific: "세부능력 및 특기사항",
  autonomous: "자율활동",
  club: "동아리활동",
  volunteer: "봉사활동",
  career: "진로활동",
  behavior: "행동특성 및 종합의견",
  reading: "독서활동",
  award: "수상경력",
};

/** 자료 한 벌을 모은다. 검색어를 칠 때 한 번만 부르고 그 뒤로는 걸러 쓴다. */
export async function loadLibrary() {
  const [graph, docs, voices, comments] = await Promise.all([
    api.graph.fetch().catch(() => ({ nodes: [], edges: [] })),
    api.documents.list().catch(() => []),
    api.voice.listSessions().catch(() => []),
    api.comments.list().catch(() => []),
  ]);

  const degree = {};
  for (const e of graph.edges || []) {
    degree[e.from] = (degree[e.from] || 0) + 1;
    degree[e.to] = (degree[e.to] || 0) + 1;
  }

  const items = [];
  for (const n of graph.nodes || []) {
    items.push({
      id: `node:${n.id}`,
      kind: "graph",
      label: "노드",
      title: n.label,
      sub: `${n.cat || n.kind || "노드"} · 연결 ${degree[n.id] || 0}개`,
      hay: [n.label, n.cat, n.kind],
      nav: { screen: "S06", store: { mbx_node_id: n.id } },
    });
  }
  for (const d of docs || []) {
    const title = AREA_LABEL[d.section_type] || d.section_type || "텍스트";
    const chars = (d.content || "").length;
    const empty = !d.content || d.content === "(작성 시작)";
    items.push({
      id: `doc:${d.id}`,
      kind: "document",
      label: "문서",
      title,
      sub: empty ? "미작성" : `${chars.toLocaleString()}자`,
      hay: [title, d.content, d.section_type],
      nav: { screen: "S12", store: { mbx_doc_id: d.id, mbx_doc_type: d.section_type } },
    });
  }
  for (const v of voices || []) {
    items.push({
      id: `voice:${v.id}`,
      kind: "voice",
      label: "음성",
      title: v.t || "음성 세션",
      sub: [v.date, v.dur, v.st].filter(Boolean).join(" · "),
      hay: [v.t, v.transcript, ...(v.keywords || [])],
      nav: { screen: v.transcript ? "S17" : "S15", store: { mbx_voice_session: v.id } },
    });
  }
  for (const c of comments || []) {
    items.push({
      id: `comment:${c.id}`,
      kind: "feedback",
      label: "코멘트",
      title: c.author ? `${c.author}님의 코멘트` : "코멘트",
      sub: c.target || "전체 그래프",
      hay: [c.author, c.content, c.target, c.type],
      nav: { screen: "S24" },
    });
  }
  return items;
}

/** 활동 필터(kind)와 같은 값으로 자료도 거른다 — 필터가 화면마다 다르면 안 된다. */
const FILTER_KINDS = {
  all: null,
  conversation: [],           // 자료에는 "대화"가 없다
  reading: [],                // 기사·논문은 활동 쪽에서 다룬다
  graph: ["graph"],
  feedback: ["feedback"],
  document: ["document"],
  voice: ["voice"],
};

export function filterLibrary(items, query, kind = "all") {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const kinds = FILTER_KINDS[kind];
  if (kinds && kinds.length === 0) return [];
  return items.filter(
    (it) =>
      (!kinds || kinds.includes(it.kind)) &&
      [it.title, it.sub, ...(it.hay || [])].some((p) =>
        String(p || "").toLowerCase().includes(needle)
      )
  );
}

/** 결과를 열 때 — 상세 화면이 sessionStorage 로 대상을 받는 기존 방식 그대로. */
export function openLibraryItem(item, onNav) {
  for (const [k, v] of Object.entries(item.nav?.store || {})) {
    sessionStorage.setItem(k, v);
  }
  onNav(item.nav.screen);
}
