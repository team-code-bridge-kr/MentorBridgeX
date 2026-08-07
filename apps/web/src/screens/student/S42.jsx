/**
 * S42 — 키워드 관리
 *
 * 학과 프리셋에서 온 키워드(preset)와 직접 추가한 것(manual)을 시각적으로 구분한다.
 * 트랙을 바꾸면 preset 만 교체되고 manual 은 남는다 (백엔드 규칙).
 */

import { useEffect, useState } from "react";
import api from "../../api/index.js";
import { useLoading } from "../../components/LoadingDock.jsx";
import { Btn } from "../../components/ui.jsx";

export function S42({ onNav }) {
  const [keywords, setKeywords] = useState([]);
  const [profile, setProfile] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    Promise.all([api.research.keywords(), api.research.profile()])
      .then(([kw, p]) => {
        setKeywords(kw);
        setProfile(p);
      })
      .catch((e) => setErr(e.message || "불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  const add = async (e) => {
    e?.preventDefault();
    const keyword = input.trim();
    if (keyword.length < 2) {
      setErr("키워드는 2글자 이상이어야 합니다.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      setKeywords(await api.research.addKeyword(keyword));
      setInput("");
    } catch (e2) {
      setErr(e2.message || "추가하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (keyword) => {
    const before = keywords;
    setKeywords((prev) => prev.filter((k) => k.keyword !== keyword));
    try {
      await api.research.removeKeyword(keyword);
    } catch (e) {
      setKeywords(before);
      setErr(e.message || "삭제하지 못했습니다.");
    }
  };

  const preset = keywords.filter((k) => k.source === "preset");
  const manual = keywords.filter((k) => k.source === "manual");

  // 화면을 비우고 문구는 알림에 맡긴다. 여기저기 다른 말로 적으면 같은
  // 기다림이 화면마다 달라 보인다.
  useLoading(loading, "관심 키워드를 불러오는 중이에요…");

  if (loading) return <div className="rs-wrap" />;

  return (
    <div className="rs-wrap">
      <p className="rs-lead">
        피드는 여기 있는 키워드로 글을 골라옵니다.
        {profile?.track_name && (
          <>
            {" "}현재 학과는 <b style={{ color: "var(--tp)" }}>{profile.track_name}</b> 입니다.{" "}
            <button
              type="button"
              className="btn-inline"
              style={{ height: 28, fontSize: 12 }}
              onClick={() => onNav("S40")}
            >
              학과 바꾸기
            </button>
          </>
        )}
      </p>

      <form onSubmit={add} style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input
          className="inp"
          style={{ flex: 1 }}
          placeholder="관심 있는 주제를 입력하세요 (예: 양자컴퓨팅)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={80}
        />
        <Btn onClick={add} disabled={busy}>{busy ? "추가 중…" : "추가"}</Btn>
      </form>

      {err && (
        <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16 }}>{err}</div>
      )}

      <div className="rs-field-label">직접 추가한 키워드 · {manual.length}개</div>
      {manual.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--tt)" }}>
          아직 없습니다. 발견 화면에서 추천받거나 위에서 직접 추가해 보세요.
        </div>
      ) : (
        <div className="rs-chips">
          {manual.map((k) => (
            <span key={k.keyword} className="rs-chip manual">
              {k.keyword}
              <button
                type="button"
                className="rs-chip-x"
                title="삭제"
                onClick={() => remove(k.keyword)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="rs-field-label">학과 프리셋 · {preset.length}개</div>
      <div className="rs-chips">
        {preset.map((k) => (
          <span key={k.keyword} className="rs-chip preset">
            {k.keyword}
            <button
              type="button"
              className="rs-chip-x"
              title="삭제"
              onClick={() => remove(k.keyword)}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={{ fontSize: 12, color: "var(--tt)", marginTop: 10, lineHeight: 1.6 }}>
        프리셋 키워드를 지워도 됩니다. 다만 학과를 다시 고르면 프리셋은 초기화되고,
        직접 추가한 키워드는 그대로 남습니다.
      </div>
    </div>
  );
}
