/**
 * 대시보드 데이터 훅.
 *
 * 화면 컴포넌트는 로딩·오류·재시도를 직접 다루지 않는다. 모든 훅이 같은 모양
 * ({data, loading, error, reload})을 돌려주므로 카드마다 스켈레톤/오류/재시도를
 * 똑같이 처리할 수 있다.
 *
 * 아직 전용 API 가 없는 부분(기사 추천 이유 등)은 컴포넌트 안에 목업을 박지 않고
 * 여기서 기존 LIVE API 를 조합해 만든다 — 나중에 전용 엔드포인트가 생기면
 * 이 파일만 바꾸면 된다.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/index.js";
import { displayKeyword } from "../lib/keywordAliases.js";

/** 공통 비동기 리소스 훅. deps 가 바뀌면 다시 불러온다. */
function useResource(loader, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, loading: enabled, error: null });
  const alive = useRef(true);

  const reload = useCallback(async () => {
    if (!enabled) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loader();
      if (alive.current) setState({ data, loading: false, error: null });
    } catch (e) {
      if (alive.current) {
        setState({ data: null, loading: false, error: e.message || "불러오지 못했습니다." });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    alive.current = true;
    reload();
    return () => { alive.current = false; };
  }, [reload]);

  /**
   * 이미 받아 둔 값을 화면에서 고친다(이름 바꾸기 등).
   * reload 를 쓰면 목록이 잠깐 스켈레톤으로 돌아갔다 오므로, 한 글자 바꾼
   * 결과를 보여주자고 화면을 깜빡이게 하지 않는다.
   */
  const setData = useCallback((update) => {
    setState((s) => ({
      ...s,
      data: typeof update === "function" ? update(s.data) : update,
    }));
  }, []);

  return { ...state, reload, setData };
}

/** 사용자 이름 · 주간 활동 · 그래프 요약 · 확인할 피드백 · 미확인 알림 */
export function useDashboardSummary() {
  return useResource(() => api.assistant.dashboard(), []);
}

/**
 * 오늘의 관심 기사 — **뉴스와 논문을 번갈아** 세운다.
 *
 * 한 번에 최신순으로만 받으면 한쪽 종류가 카드를 통째로 차지한다. 실제로
 * 그런 일이 있었다(논문만 넉 장). 종류별로 따로 받아 번갈아 끼우면, 한쪽이
 * 모자랄 때만 다른 쪽으로 채워진다 — 억지로 균형을 맞추느라 빈칸을 만들지 않는다.
 */
export function useRecommendedArticles(limit = 4) {
  return useResource(async () => {
    const half = Math.ceil(limit / 2);
    const [news, papers] = await Promise.all([
      api.research.feed({ tab: "news", limit: half }),
      api.research.feed({ tab: "paper", limit: half }),
    ]);
    return alternate(news.items || [], papers.items || [])
      .slice(0, limit)
      .map((item) => ({ ...item, keywords: keywordsOf(item) }));
  }, [limit]);
}

/** 뉴스 → 논문 → 뉴스 … 한쪽이 끝나면 남은 쪽을 그대로 잇는다. */
function alternate(a, b) {
  const out = [];
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (a[i]) out.push(a[i]);
    if (b[i]) out.push(b[i]);
  }
  return out;
}

/**
 * 이 글이 걸린 내 키워드. 등록된 낱말 그대로 쓰면 "algorithm"처럼 영문이 나오므로
 * 표기만 한국어 쪽으로 바꾼다(걸린 결과 자체는 건드리지 않는다).
 * 같은 개념의 한글·영문은 한 번만 — "알고리즘 · algorithm"은 두 개가 아니다.
 */
function keywordsOf(item) {
  return [...new Set((item.matched_keywords || []).map(displayKeyword))].slice(0, 3);
}

/** 최근 지식 그래프 — 요약 API 에서 이미 오므로 재요청하지 않고 잘라 쓴다. */
export function useRecentGraph(summary) {
  return summary?.graph ?? null;
}

/** 확인할 피드백 — 같은 이유로 요약 API 에서 파생 */
export function usePendingFeedback(summary) {
  return {
    items: summary?.pending_feedback ?? [],
    count: summary?.pending_feedback_count ?? 0,
  };
}
