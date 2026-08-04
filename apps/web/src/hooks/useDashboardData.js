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

export function useRecentConversations(limit = 3) {
  return useResource(() => api.assistant.conversations(limit), [limit]);
}

/**
 * 오늘의 관심 기사.
 *
 * 추천 이유는 아직 백엔드가 계산해주지 않는다. 기사에 매칭된 키워드가 이미
 * 내려오므로 그걸로 문장을 만든다 — 컴포넌트가 아니라 여기서 만드는 이유는
 * 나중에 서버가 reason 을 내려주면 이 함수만 지우면 되기 때문이다.
 */
export function useRecommendedArticles(limit = 3) {
  return useResource(async () => {
    const feed = await api.research.feed({ tab: "all", limit });
    return (feed.items || []).map((item) => ({
      ...item,
      reason: reasonFor(item),
    }));
  }, [limit]);
}

function reasonFor(item) {
  // 등록된 낱말 그대로 쓰면 "algorithm 과 관련된 글입니다"가 된다.
  // 걸린 결과는 그대로 두고 표기만 한국어 쪽으로 바꾼다.
  const matched = [...new Set((item.matched_keywords || []).map(displayKeyword))];
  if (!matched.length) return "관심 분야와 관련된 글입니다.";
  if (matched.length === 1) return `내 키워드 ‘${matched[0]}’와 관련된 글입니다.`;
  return `내 키워드 ‘${matched[0]}’, ‘${matched[1]}’와 관련된 글입니다.`;
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
