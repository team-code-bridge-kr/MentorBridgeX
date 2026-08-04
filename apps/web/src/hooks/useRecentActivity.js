/**
 * 최근 활동 데이터.
 *
 * 사이드바·대시보드·전체 보기가 같은 훅을 쓴다. 세 곳이 각자 불러오면 정렬이
 * 갈리고, 한 곳에서 이름을 바꿔도 나머지는 옛 이름을 계속 보여준다.
 *
 * **사이드바를 여닫을 때마다 다시 부르지 않는다.** 목록이 필요한 화면이 뜰 때
 * 한 번 받고, 무언가 바뀐 뒤에만(이름 변경·고정·숨김·새 대화) 다시 받는다.
 * 갱신 신호는 `mbx:activity-changed` 로 오간다 — 사이드바와 대시보드가 서로를
 * 모르는 채로도 같은 목록을 유지할 수 있어야 한다.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/index.js";

export const ACTIVITY_CHANGED = "mbx:activity-changed";

/** 목록을 고친 쪽이 부른다. 듣는 쪽은 알아서 다시 받는다. */
export function notifyActivityChanged() {
  window.dispatchEvent(new CustomEvent(ACTIVITY_CHANGED));
}

export function useRecentActivity({ limit = 8, kind = "all", q = "", enabled = true } = {}) {
  const [state, setState] = useState({ items: [], total: 0, loading: enabled, error: null });
  const alive = useRef(true);
  // 늦게 도착한 응답이 최신 응답을 덮어쓰지 않게 한다 (검색어를 빨리 칠 때)
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!enabled) {
      setState({ items: [], total: 0, loading: false, error: null });
      return;
    }
    const mine = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api.activity.recent({ limit, kind, q });
      if (!alive.current || mine !== seq.current) return;
      setState({
        items: data.items || [],
        total: data.total || 0,
        pinnedLimit: data.pinned_limit || 5,
        loading: false,
        error: null,
      });
    } catch (e) {
      if (!alive.current || mine !== seq.current) return;
      setState({
        items: [],
        total: 0,
        loading: false,
        error: e.message || "최근 활동을 불러오지 못했습니다.",
      });
    }
  }, [enabled, limit, kind, q]);

  useEffect(() => {
    alive.current = true;
    load();
    return () => { alive.current = false; };
  }, [load]);

  useEffect(() => {
    const onChanged = () => load();
    window.addEventListener(ACTIVITY_CHANGED, onChanged);
    return () => window.removeEventListener(ACTIVITY_CHANGED, onChanged);
  }, [load]);

  /** 이름 변경 · 고정. 화면을 먼저 고치고 서버에 보낸다. */
  const update = useCallback(
    async (key, patch) => {
      const before = state.items;
      setState((s) => ({
        ...s,
        items: s.items.map((it) => (it.id === key ? { ...it, ...patch } : it)),
      }));
      try {
        await api.activity.update(key, patch);
        notifyActivityChanged();
        return true;
      } catch (e) {
        setState((s) => ({ ...s, items: before }));
        throw e;
      }
    },
    [state.items]
  );

  const remove = useCallback(async (key, options) => {
    await api.activity.remove(key, options);
    notifyActivityChanged();
  }, []);

  return { ...state, reload: load, update, remove };
}
