/**
 * 멘토 온보딩 M1~M2.
 *
 * 멘토링 가능 분야에는 **학생과 같은 어휘**를 쓴다. 여기서만 다른 말로 받으면
 * 나중에 학생과 이어 줄 때 맞출 방법이 없다 — 같은 트랙 목록을 그대로 쓴다.
 */

import { useMemo, useState } from "react";
import { MAX_MAJORS } from "../../lib/onboardingData.js";

/**
 * 목록에 없는 학과를 직접 적었을 때 붙이는 표시.
 *
 * 저장 칸(mentor_profiles.track_id)은 원래 목록의 **id** 를 담는 자리다.
 * 적어 넣은 이름을 그대로 넣으면 나중에 둘을 구분할 수 없으므로 앞에 표를
 * 단다. 목록(마스터 데이터)에는 손대지 않는다 — 온보딩에서 아무나 학과를
 * 만들 수 있게 되면 목록이 금방 오타로 뒤덮인다.
 */
const CUSTOM = "custom:";
/** 저장 칸이 40자라 표(7자)를 뺀 만큼만 받는다. */
const CUSTOM_MAX = 33;

export function customMajorName(trackId) {
  return trackId?.startsWith(CUSTOM) ? trackId.slice(CUSTOM.length) : "";
}

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
  const custom = customMajorName(trackId);
  const typed = q.trim().slice(0, CUSTOM_MAX);

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
          {/* 직접 적은 학과도 고른 것으로 함께 세운다 — 안 그러면 적어 넣고
              나서 아무것도 안 골라진 것처럼 보인다. */}
          {custom && (
            <button
              type="button"
              className="ob-major is-on"
              onClick={() => onChange({ mentor_track_id: "" })}
              disabled={busy}
              aria-pressed="true"
              title="지우기"
            >
              <span className="ob-check" aria-hidden="true">✓</span>
              {custom}
            </button>
          )}
        </div>
        {found.length === 0 && !custom && (
          <div className="ob-nofind">
            <p className="ob-hint">앗! 학과가 검색되지 않아요. 직접 추가해볼까요?</p>
            {typed && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onChange({ mentor_track_id: CUSTOM + typed })}
                disabled={busy}
              >
                ‘{typed}’ 추가하기
              </button>
            )}
          </div>
        )}
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
