/**
 * 내 관심 키워드 + MBX 추천 키워드.
 *
 * 둘은 성격이 다르다. 관심 키워드는 **내가 등록한 것**이고, 추천은 **읽은 글에서
 * 뽑아 제안하는 것**이다. 한 배열에 섞으면 화면에서 무엇이 내 것인지 알 수 없어
 * 여기서부터 나눠 둔다.
 *
 * 추천의 근거는 서버의 /discover 가 준다 — 내가 읽은 글에 자주 나온 개념이다.
 * 지식 그래프 기반 추천은 아직 API 가 없어서 만들지 않았다(있는 척하지 않는다).
 */

import { useCallback, useEffect, useState } from "react";
import api from "../api/index.js";
import { groupKeywords } from "../lib/keywordAliases.js";

export function useInterestKeywords() {
  const [keywords, setKeywords] = useState([]);   // 서버 원본 [{keyword, source}]
  const [groups, setGroups] = useState([]);       // 화면용 묶음
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const apply = useCallback((list) => {
    setKeywords(list);
    setGroups(groupKeywords(list));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      apply(await api.research.keywords());
      setError("");
    } catch (e) {
      setError(e.message || "키워드를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useEffect(() => { load(); }, [load]);

  // 추천 — 실패해도 화면이 멈추지 않게 조용히 넘어간다 (보조 정보다)
  useEffect(() => {
    api.research
      .discover(12)
      .then((d) => setSuggestions((d.terms || []).filter((t) => !t.registered)))
      .catch(() => setSuggestions([]));
  }, [keywords.length]);

  const add = useCallback(async (word) => {
    const w = word.trim();
    if (!w) return;
    if (keywords.some((k) => k.keyword.toLowerCase() === w.toLowerCase())) {
      throw new Error("이미 등록된 키워드입니다.");
    }
    apply(await api.research.addKeyword(w));
  }, [keywords, apply]);

  const remove = useCallback(async (word) => {
    // 낙관적 반영 — 실패하면 서버 상태로 되돌린다
    const before = keywords;
    apply(keywords.filter((k) => k.keyword !== word));
    try {
      await api.research.removeKeyword(word);
    } catch (e) {
      apply(before);
      throw e;
    }
  }, [keywords, apply]);

  return { keywords, groups, suggestions, loading, error, add, remove, reload: load };
}
