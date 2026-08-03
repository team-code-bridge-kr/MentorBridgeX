/**
 * 멘토 온보딩 M1~M2.
 *
 * 멘토링 가능 분야에는 **학생과 같은 어휘**를 쓴다. 여기서만 다른 말로 받으면
 * 나중에 학생과 이어 줄 때 맞출 방법이 없다 — 같은 트랙 목록을 그대로 쓴다.
 */

import { useMemo, useState } from "react";
import { MAX_MAJORS } from "../../lib/onboardingData.js";

/* ── M1 전공 / 직무 ──────────────────────────────────────── */

export function MentorProfileStep({
  tracks,
  trackId,
  affiliation,
  status,
  onChange,
  busy,
}) {
  const [q, setQ] = useState("");
  const found = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return tracks.slice(0, 8);
    return tracks.filter((t) => t.name.toLowerCase().includes(needle)).slice(0, 8);
  }, [tracks, q]);

  return (
    <>
      <div className="inp-group">
        <label className="inp-label" htmlFor="mentor-major">
          전공 학과
        </label>
        <input
          id="mentor-major"
          className="inp"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="학과 이름으로 찾기"
          disabled={busy}
        />
        <div className="ob-major-row" style={{ marginTop: 10 }}>
          {found.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`ob-major${trackId === t.id ? " is-on" : ""}`}
              onClick={() => onChange({ mentor_track_id: t.id })}
              disabled={busy}
              aria-pressed={trackId === t.id}
            >
              {trackId === t.id && (
                <span className="ob-check" aria-hidden="true">
                  ✓
                </span>
              )}
              {t.name}
            </button>
          ))}
          {found.length === 0 && <p className="ob-hint">그런 이름의 학과가 목록에 없어요.</p>}
        </div>
      </div>

      <div className="inp-group">
        <label className="inp-label" htmlFor="mentor-aff">
          현재 소속 <span className="ob-optional">(선택)</span>
        </label>
        <input
          id="mentor-aff"
          className="inp"
          value={affiliation || ""}
          onChange={(e) => onChange({ mentor_affiliation: e.target.value })}
          placeholder="○○대학교 / ○○ 회사"
          maxLength={120}
          disabled={busy}
        />
      </div>

      <div className="inp-group">
        <span className="inp-label">구분</span>
        <div className="ob-major-row">
          {[
            ["student", "재학"],
            ["graduate", "졸업"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`ob-major${status === id ? " is-on" : ""}`}
              onClick={() => onChange({ mentor_status: id })}
              disabled={busy}
              aria-pressed={status === id}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/* ── M2 멘토링 가능 분야 ─────────────────────────────────── */

export function MentorFieldStep({ tracks, value, onChange, busy }) {
  const [warn, setWarn] = useState("");

  const toggle = (id) => {
    setWarn("");
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
      return;
    }
    if (value.length >= MAX_MAJORS) {
      setWarn(`${MAX_MAJORS}개까지 고를 수 있어요`);
      return;
    }
    onChange([...value, id]);
  };

  return (
    <>
      <div className="ob-major-row">
        {tracks.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`ob-major${value.includes(t.id) ? " is-on" : ""}`}
            onClick={() => toggle(t.id)}
            disabled={busy}
            aria-pressed={value.includes(t.id)}
            title={t.description}
          >
            {value.includes(t.id) && (
              <span className="ob-check" aria-hidden="true">
                ✓
              </span>
            )}
            {t.name}
          </button>
        ))}
      </div>
      {warn && (
        <p className="ob-warn" role="status">
          {warn}
        </p>
      )}
    </>
  );
}
