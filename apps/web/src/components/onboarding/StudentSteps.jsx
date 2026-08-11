/**
 * 학생 온보딩 STEP 1~5.
 *
 * 이 흐름의 전제: **모른다고 답할 수 있어야 한다.** 이 서비스가 풀려는 문제가
 * "학생이 자기 관심사를 모른다"는 것인데, 온보딩에서 정확한 관심사를 요구하면
 * 그 문제를 사용자에게 되돌려 주는 꼴이 된다. 그래서 STEP 3 에 "아직
 * 모르겠어요"를 두고, STEP 4 는 통째로 건너뛸 수 있게 한다.
 */

import { useMemo, useState } from "react";
import { GRADES, MAX_MAJORS, easyLabel, groupTracksByField } from "../../lib/onboardingData.js";

/* ── STEP 1 학년 ─────────────────────────────────────────── */

export function GradeStep({ value, onPick, busy }) {
  return (
    <div className="ob-grade-grid">
      {GRADES.map((g) => (
        <button
          key={g.id}
          type="button"
          className={`ob-grade${value === g.id ? " is-on" : ""}`}
          onClick={() => onPick(g.id)}
          disabled={busy}
          aria-pressed={value === g.id}
        >
          <span className="ob-grade-label">{g.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ── STEP 2 계열 ─────────────────────────────────────────── */

export function FieldStep({ tracks, value, onChange, busy }) {
  const groups = useMemo(() => groupTracksByField(tracks), [tracks]);
  const picked = value ? value.split(",").filter(Boolean) : [];
  const [multi, setMulti] = useState(picked.length > 1);

  const toggle = (id) => {
    if (!multi) {
      onChange(id);
      return;
    }
    if (picked.includes(id)) {
      onChange(picked.filter((p) => p !== id).join(","));
      return;
    }
    // 둘까지. 셋을 넘어가면 "계열을 골랐다"는 말이 무의미해진다.
    if (picked.length >= 2) return;
    onChange([...picked, id].join(","));
  };

  return (
    <>
      <div className="ob-field-grid">
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`ob-field${picked.includes(g.id) ? " is-on" : ""}`}
            onClick={() => toggle(g.id)}
            disabled={busy || (multi && picked.length >= 2 && !picked.includes(g.id))}
            aria-pressed={picked.includes(g.id)}
          >
            <span className="ob-field-label">{g.label}</span>
            {/* 예시 학과는 시드에서 뽑는다 — 따로 적어 두면 학과가 늘어도 안 바뀐다 */}
            <span className="ob-field-sample">{g.sample}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="ob-multi-toggle"
        onClick={() => {
          setMulti((m) => !m);
          if (multi && picked.length > 1) onChange(picked[0]);
        }}
        aria-pressed={multi}
      >
        {multi ? "하나만 고를래요" : "여러 분야가 궁금해요"}
      </button>
      {multi && <p className="ob-hint">두 분야까지 고를 수 있어요 ({picked.length}/2)</p>}
    </>
  );
}

/* ── STEP 3 학과 ─────────────────────────────────────────── */

export function MajorStep({ tracks, trackGroup, value, onChange, onUnsure, busy }) {
  const fields = (trackGroup || "").split(",").filter(Boolean);
  const inGroup = tracks.filter((t) => fields.includes(t.field));
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
        {inGroup.map((t) => (
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

      {/* 이 서비스의 존재 이유가 여기 있다 — 좁히는 일은 '발견' 화면이 대신한다 */}
      <button type="button" className="ob-unsure" onClick={onUnsure} disabled={busy}>
        아직 모르겠어요
        <span className="ob-unsure-sub">
          고른 계열 전체에서 넓게 모아드릴게요. 읽다 보면 좁혀져요.
        </span>
      </button>
    </>
  );
}

/* ── STEP 4 세부 관심 ────────────────────────────────────── */

/**
 * 학과 프리셋 키워드를 고르는 단계.
 *
 * 칩에 적히는 말은 **학생이 알아들을 수 있는 말**이다("자연어처리" 대신
 * "챗봇·번역 AI"). 매칭에 쓰이는 건 원래 낱말 그대로라, 라벨을 바꿔도 결과는
 * 달라지지 않는다.
 *
 * 한글·영문(자연어처리 / natural language processing)은 화면에서 하나로 묶는다.
 * 두 개로 보이면 같은 걸 두 번 고르게 된다. 어느 낱말끼리 짝인지는 **서버가**
 * 알려준다(`keyword_groups`) — 시드의 나열 순서가 곧 짝이라 화면에서 다시
 * 맞히려 들면 틀린다.
 */
export function KeywordStep({ tracks, majors, selected, onToggle, manual, onManual, busy }) {
  const [draft, setDraft] = useState("");

  const groups = useMemo(() => {
    const byName = new Map();
    for (const t of tracks) {
      if (!majors.includes(t.id)) continue;
      for (const pair of t.keyword_groups || []) {
        const [head, ...rest] = pair;
        if (!head) continue;
        const cur = byName.get(head) || [];
        byName.set(head, [...new Set([...cur, head, ...rest])]);
      }
    }
    return [...byName].map(([displayName, searchTerms]) => ({ displayName, searchTerms }));
  }, [tracks, majors]);

  const add = () => {
    const w = draft.trim();
    if (w.length < 2) return;
    if (!manual.includes(w)) onManual([...manual, w]);
    setDraft("");
  };

  return (
    <>
      <div className="ob-kw-row">
        {groups.map((g) => {
          const on = g.searchTerms.every((t) => selected.includes(t));
          const easy = easyLabel(g.displayName);
          return (
            <button
              key={g.displayName}
              type="button"
              className={`ob-kw${on ? " is-on" : ""}`}
              onClick={() => onToggle(g.searchTerms, !on)}
              disabled={busy}
              aria-pressed={on}
              title={g.searchTerms.join(" · ")}
            >
              {on && (
                <span className="ob-check" aria-hidden="true">
                  ✓
                </span>
              )}
              {easy || g.displayName}
            </button>
          );
        })}
      </div>

      <div className="ob-kw-add">
        <input
          className="inp"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="여기 없는 관심사를 직접 적어도 돼요"
          maxLength={40}
          aria-label="관심 키워드 직접 추가"
        />
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={add}
          disabled={busy || draft.trim().length < 2}
        >
          ＋ 추가
        </button>
      </div>
      {manual.length > 0 && (
        <div className="ob-kw-row ob-kw-manual">
          {manual.map((m) => (
            <button
              key={m}
              type="button"
              className="ob-kw is-on"
              onClick={() => onManual(manual.filter((x) => x !== m))}
              aria-label={`${m} 빼기`}
            >
              {m} ×
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/* ── STEP 5 미리보기 ─────────────────────────────────────── */

/**
 * 고르기만 하고 끝나면 무엇을 얻었는지 모른다. 실제로 받게 될 글을 보여준다.
 *
 * `matched=false` 는 내 키워드로 걸린 글이 아직 없다는 뜻이다. 그때도 빈 화면을
 * 내보내지 않고 최신글로 채우되, **문구를 바꿔서 사실대로 말한다.**
 */
export function PreviewStep({ preview, loading, keywords }) {
  if (loading) {
    return (
      <div className="ob-prev-list" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className="ob-prev-skel" />
        ))}
      </div>
    );
  }

  const items = preview?.items || [];

  return (
    <>
      {!preview?.matched && items.length > 0 && (
        <p className="ob-hint">곧 맞춤 글이 쌓일 거예요. 우선 이런 소식부터 보실래요?</p>
      )}
      <div className="ob-prev-list">
        {items.map((a) => (
          <article key={a.id} className="ob-prev">
            {a.image_url && (
              <img
                className="ob-prev-img"
                src={a.image_url}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
            <div className="ob-prev-text">
              <h3 className="ob-prev-title">{a.title}</h3>
              <p className="ob-prev-sum">{a.summary}</p>
              <p className="ob-prev-meta">
                {a.outlet || (a.kind === "paper" ? "논문" : "뉴스")}
              </p>
            </div>
          </article>
        ))}
        {items.length === 0 && (
          <p className="ob-hint">
            아직 모아둔 글이 없어요. 수집이 돌면 바로 첫 화면에 나타납니다.
          </p>
        )}
      </div>

      {keywords.length > 0 && (
        <div className="ob-kw-row ob-kw-summary">
          {keywords.slice(0, 12).map((k) => (
            <span key={k} className="ob-kw is-static">
              {easyLabel(k) || k}
            </span>
          ))}
          {keywords.length > 12 && <span className="ob-kw is-static">+{keywords.length - 12}</span>}
        </div>
      )}
    </>
  );
}
