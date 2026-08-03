/**
 * 온보딩의 서버 상태.
 *
 * **단계마다 저장한다.** 마지막에 한 번에 보내면 중간에 창을 닫은 사람은 처음부터
 * 다시 골라야 한다. 고등학생이 폰으로 하는 일이라 그 확률이 낮지 않다.
 *
 * 화면은 여기서 온 값을 그대로 그린다 — 로컬에 따로 복사본을 두지 않는다.
 * 두 벌을 두면 저장이 실패했을 때 화면만 앞서 나간다.
 */

import { useCallback, useEffect, useState } from "react";
import api from "../api/index.js";

export function useOnboarding() {
  const [data, setData] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [state, trackList] = await Promise.all([
        api.onboarding.state(),
        api.research.tracks(),
      ]);
      setData(state);
      setTracks(trackList);
      setError("");
    } catch (e) {
      setError(e.message || "온보딩 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** 바뀐 것만 보낸다. 실패하면 던져서 화면이 다음 단계로 넘어가지 않게 한다. */
  const patch = useCallback(async (part) => {
    setSaving(true);
    setError("");
    try {
      const next = await api.onboarding.patch(part);
      setData(next);
      return next;
    } catch (e) {
      setError(e.message || "저장하지 못했습니다.");
      throw e;
    } finally {
      setSaving(false);
    }
  }, []);

  const setKeywords = useCallback(async (preset, manual) => {
    setSaving(true);
    setError("");
    try {
      const next = await api.onboarding.setKeywords(preset, manual);
      setData(next);
      return next;
    } catch (e) {
      setError(e.message || "키워드를 저장하지 못했습니다.");
      throw e;
    } finally {
      setSaving(false);
    }
  }, []);

  const complete = useCallback(async () => {
    setSaving(true);
    setError("");
    try {
      const next = await api.onboarding.complete();
      setData(next);
      return next;
    } catch (e) {
      setError(e.message || "완료 처리에 실패했습니다.");
      throw e;
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    data,
    tracks,
    loading,
    saving,
    error,
    setError,
    patch,
    setKeywords,
    complete,
    reload: load,
  };
}
