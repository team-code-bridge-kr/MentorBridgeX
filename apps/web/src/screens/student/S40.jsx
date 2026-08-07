/**
 * S40 — 탐구 피드 온보딩 (진학 희망 학과 선택)
 *
 * 학생이 처음부터 키워드를 떠올릴 필요가 없어야 한다는 게 이 화면의 요지다.
 * 학과를 고르면 그 학과의 프리셋 키워드가 자동으로 적용되고, 이후 피드를 읽으며
 * 좁혀 나간다.
 */

import { useEffect, useMemo, useState } from "react";
import api from "../../api/index.js";
import { useLoading } from "../../components/LoadingDock.jsx";
import { Btn } from "../../components/ui.jsx";

// 계열 표시 순서 — 이공계 학생이 다수라 앞에 둔다
const FIELD_ORDER = ["공학", "자연", "의약", "사회", "인문"];

export function S40({ onNav }) {
  const [tracks, setTracks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.research
      .tracks()
      .then(setTracks)
      .catch((e) => setErr(e.message || "학과 목록을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    const by = {};
    for (const t of tracks) (by[t.field] ||= []).push(t);
    const fields = Object.keys(by).sort(
      (a, b) => FIELD_ORDER.indexOf(a) - FIELD_ORDER.indexOf(b)
    );
    return fields.map((field) => [field, by[field]]);
  }, [tracks]);

  const chosen = tracks.find((t) => t.id === selected) || null;

  const confirm = async () => {
    if (!chosen) return;
    setSaving(true);
    setErr("");
    try {
      await api.research.setTrack(chosen.id);
      onNav("S41");
    } catch (e) {
      setErr(e.message || "저장에 실패했습니다.");
      setSaving(false);
    }
  };

  // 화면을 비우고 문구는 알림에 맡긴다. 여기저기 다른 말로 적으면 같은
  // 기다림이 화면마다 달라 보인다.
  useLoading(loading, "학과 목록을 불러오는 중이에요…");

  if (loading) return <div className="rs-wrap" />;

  return (
    <div className="rs-wrap">
      <p className="rs-lead">
        진학하고 싶은 계열이나 학과를 하나 골라주세요.<br />
        그 분야에서 자주 다루는 주제들이 자동으로 적용되고, 피드를 읽으면서
        관심사를 좁혀 나갈 수 있습니다.
      </p>

      {err && <div className="rs-empty" style={{ color: "var(--danger)" }}>{err}</div>}

      {grouped.map(([field, list]) => (
        <div key={field}>
          <div className="rs-field-label">{field}</div>
          <div className="rs-track-grid">
            {list.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`rs-track${selected === t.id ? " on" : ""}`}
                onClick={() => setSelected(t.id)}
              >
                <div className="rs-track-name">{t.name}</div>
                <div className="rs-track-desc">{t.description}</div>
              </button>
            ))}
          </div>
        </div>
      ))}

      {chosen && (
        <div
          style={{
            position: "sticky",
            bottom: 0,
            marginTop: 24,
            padding: "16px 0 4px",
            background: "linear-gradient(to bottom, transparent, var(--bg2) 24px)",
          }}
        >
          <div
            style={{
              border: "1px solid var(--brd)",
              borderRadius: 12,
              background: "var(--bg1)",
              padding: 16,
            }}
          >
            <div style={{ fontSize: 13, color: "var(--tt)", marginBottom: 10 }}>
              <b style={{ color: "var(--tp)" }}>{chosen.name}</b> 를 고르면 이런 주제들을
              먼저 보여드립니다 · 총 {chosen.keywords.length}개
            </div>
            <div className="rs-chips" style={{ marginBottom: 14 }}>
              {chosen.keywords.slice(0, 14).map((k) => (
                <span key={k} className="rs-chip preset">{k}</span>
              ))}
              {chosen.keywords.length > 14 && (
                <span className="rs-chip">+{chosen.keywords.length - 14}</span>
              )}
            </div>
            <Btn fw onClick={confirm} disabled={saving}>
              {saving ? "적용 중…" : "이걸로 시작하기"}
            </Btn>
            <div style={{ fontSize: 12, color: "var(--tt)", marginTop: 8, textAlign: "center" }}>
              나중에 키워드 화면에서 얼마든지 바꿀 수 있어요
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
