/**
 * 탐구 피드의 상태.
 *
 * 화면(S41)이 데이터·필터·요청을 한꺼번에 들고 있으면 어디서 무엇이 바뀌는지
 * 따라갈 수 없다. 여기서는 **조건(filters)** 과 **결과(feed)** 를 나눠 둔다.
 *
 * 조건은 URL 해시에 실어 둔다. 새로고침·뒤로가기로 조건이 날아가면 사용자는
 * 방금 만든 검색을 처음부터 다시 만들어야 한다. (이 앱은 해시 라우팅이라
 * 쿼리스트링 대신 해시 뒤에 붙인다 — 라우터와 충돌하지 않는다.)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../api/index.js";

export const DEFAULT_FILTERS = {
  tab: "all",
  query: "",
  keywords: [],   // 화면에서 고른 대표 이름들 (searchTerms 로 펼쳐 보낸다)
  days: 0,        // 빠른 선택 (0 = 전체)
  from: "",       // 직접 선택 시작일 YYYY-MM-DD
  to: "",
  sort: "latest",
};

const KEYS = Object.keys(DEFAULT_FILTERS);

function readFromUrl() {
  try {
    const raw = window.location.hash.split("?")[1];
    if (!raw) return {};
    const p = new URLSearchParams(raw);
    const out = {};
    for (const k of KEYS) {
      if (!p.has(k)) continue;
      const v = p.get(k);
      if (k === "keywords") out[k] = v ? v.split(",").filter(Boolean) : [];
      else if (k === "days") out[k] = Number(v) || 0;
      else out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writeToUrl(filters) {
  const p = new URLSearchParams();
  for (const k of KEYS) {
    const v = filters[k];
    if (v === DEFAULT_FILTERS[k]) continue;
    if (Array.isArray(v)) { if (v.length) p.set(k, v.join(",")); }
    else if (v) p.set(k, String(v));
  }
  const base = window.location.hash.split("?")[0] || "#/S41";
  const next = p.toString() ? `${base}?${p}` : base;
  if (next !== window.location.hash) {
    window.history.replaceState(null, "", next);
  }
}

/**
 * @param defaultTab 처음 열 탭. 3학년은 논문부터 본다(온보딩에서 고른 학년).
 *                   주소에 탭이 적혀 있으면 그쪽이 이긴다 — 링크로 들어온
 *                   사람이 다른 탭을 보게 되면 안 된다.
 */
export function useExplorationFeed({ groups, defaultTab }) {
  const [filters, setFilters] = useState(() => ({
    ...DEFAULT_FILTERS,
    ...(defaultTab ? { tab: defaultTab } : {}),
    ...readFromUrl(),
  }));
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);   // 첫 페이지 / 조건 변경
  const [paging, setPaging] = useState(false);    // 스크롤로 더 불러오는 중
  const [error, setError] = useState("");
  const reqId = useRef(0);

  // 대표 이름 → 실제 검색어 목록. 화면은 하나로 보여도 검색은 다 보낸다.
  const expand = useCallback(
    (names) =>
      names.flatMap((name) => {
        const g = groups.find((x) => x.id === name);
        return g ? g.searchTerms : [name];
      }),
    [groups]
  );

  useEffect(() => { writeToUrl(filters); }, [filters]);

  const fetchPage = useCallback(
    async (nextCursor) => {
      const id = ++reqId.current;
      if (nextCursor) setPaging(true); else setLoading(true);
      setError("");
      try {
        const data = await api.research.feed({
          tab: filters.tab,
          cursor: nextCursor,
          query: filters.query,
          days: filters.from || filters.to ? 0 : filters.days,
          keywords: expand(filters.keywords),
          from: filters.from,
          to: filters.to,
          sort: filters.sort,
        });
        if (id !== reqId.current) return; // 늦게 온 이전 요청은 버린다
        setItems((prev) => (nextCursor ? [...prev, ...data.items] : data.items));
        setCursor(data.next_cursor);
        setDone(!data.next_cursor);
      } catch (e) {
        if (id !== reqId.current) return;
        // 실패했다고 조건이나 이미 받은 목록을 지우지 않는다 — 다시 시도만 하면 된다
        setError(e.message || "자료를 불러오지 못했습니다.");
        setDone(true);
      } finally {
        if (id === reqId.current) { setLoading(false); setPaging(false); }
      }
    },
    [filters, expand]
  );

  // 조건이 바뀌면 처음부터 다시
  useEffect(() => {
    setItems([]);
    setCursor(null);
    setDone(false);
    fetchPage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.tab, filters.query, filters.keywords.join(","), filters.days,
      filters.from, filters.to, filters.sort]);

  const patch = useCallback((part) => setFilters((f) => ({ ...f, ...part })), []);
  const reset = useCallback(
    () => setFilters((f) => ({ ...DEFAULT_FILTERS, tab: f.tab })),
    []
  );

  const active = useMemo(() => {
    const list = [];
    for (const k of filters.keywords) list.push({ type: "keyword", value: k, label: k });
    if (filters.query) list.push({ type: "query", value: filters.query, label: `“${filters.query}”` });
    if (filters.from || filters.to) {
      list.push({ type: "date", value: "", label: `${filters.from || "처음"} ~ ${filters.to || "오늘"}` });
    } else if (filters.days) {
      const map = { 1: "오늘", 7: "최근 1주", 30: "최근 1개월", 90: "최근 3개월" };
      list.push({ type: "days", value: "", label: map[filters.days] || `최근 ${filters.days}일` });
    }
    if (filters.sort === "oldest") list.push({ type: "sort", value: "", label: "오래된순" });
    if (filters.sort === "taste") list.push({ type: "sort", value: "", label: "취향순" });
    return list;
  }, [filters]);

  const removeFilter = useCallback((chip) => {
    setFilters((f) => {
      if (chip.type === "keyword") return { ...f, keywords: f.keywords.filter((k) => k !== chip.value) };
      if (chip.type === "query") return { ...f, query: "" };
      if (chip.type === "date") return { ...f, from: "", to: "" };
      if (chip.type === "days") return { ...f, days: 0 };
      if (chip.type === "sort") return { ...f, sort: "latest" };
      return f;
    });
  }, []);

  return {
    filters, patch, reset, active, removeFilter,
    items, setItems, cursor, done, loading, paging, error,
    loadMore: () => { if (cursor && !paging && !loading) fetchPage(cursor); },
    retry: () => fetchPage(null),
  };
}
