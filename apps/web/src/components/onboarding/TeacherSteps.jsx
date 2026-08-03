/**
 * 교사 온보딩 T1~T2.
 *
 * T2 의 참여 코드는 **서버가 만든다.** 화면에서 만들면 같은 코드가 두 번 나올 수
 * 있고, 그때 학생이 엉뚱한 학급에 들어간다.
 */

import { useState } from "react";

const TEACH_GRADES = ["1", "2", "3"];

/* ── T1 소속 ─────────────────────────────────────────────── */

export function TeacherProfileStep({ school, subject, grades, onChange, busy }) {
  const picked = (grades || "").split(",").filter(Boolean);

  const toggleGrade = (g) => {
    const next = picked.includes(g) ? picked.filter((p) => p !== g) : [...picked, g];
    onChange({ teacher_grades: next.sort().join(",") });
  };

  return (
    <>
      <div className="inp-group">
        <label className="inp-label" htmlFor="t-school">
          학교
        </label>
        <input
          id="t-school"
          className="inp"
          value={school || ""}
          onChange={(e) => onChange({ school: e.target.value })}
          placeholder="○○고등학교"
          maxLength={120}
          disabled={busy}
        />
      </div>
      <div className="inp-group">
        <label className="inp-label" htmlFor="t-subject">
          담당 과목
        </label>
        <input
          id="t-subject"
          className="inp"
          value={subject || ""}
          onChange={(e) => onChange({ subject: e.target.value })}
          placeholder="화학 / 진로 / 담임"
          maxLength={60}
          disabled={busy}
        />
      </div>
      <div className="inp-group">
        <span className="inp-label">담당 학년</span>
        <div className="ob-major-row">
          {TEACH_GRADES.map((g) => (
            <button
              key={g}
              type="button"
              className={`ob-major${picked.includes(g) ? " is-on" : ""}`}
              onClick={() => toggleGrade(g)}
              disabled={busy}
              aria-pressed={picked.includes(g)}
            >
              {picked.includes(g) && (
                <span className="ob-check" aria-hidden="true">
                  ✓
                </span>
              )}
              {g}학년
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/* ── T2 학급 연결 ────────────────────────────────────────── */

export function ClassroomStep({ classrooms, onCreate, onJoin, busy }) {
  const [mode, setMode] = useState(null); // "create" | "join"
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  const run = async (fn, arg) => {
    setErr("");
    try {
      await fn(arg);
      setName("");
      setCode("");
      setMode(null);
    } catch (e) {
      setErr(e.message || "처리하지 못했습니다.");
    }
  };

  return (
    <>
      {classrooms.length > 0 && (
        <ul className="ob-class-list">
          {classrooms.map((c) => (
            <li key={c.id} className="ob-class">
              <div>
                <span className="ob-class-name">{c.name}</span>
                {c.school && <span className="ob-class-school">{c.school}</span>}
                <span className="ob-class-count">학생 {c.member_count}명</span>
              </div>
              {/* 코드는 학생에게 불러 줘야 해서 크게 보여준다 */}
              <span className="ob-class-code" title="학생에게 알려줄 참여 코드">
                {c.join_code}
              </span>
            </li>
          ))}
        </ul>
      )}

      {mode === null && (
        <div className="ob-class-actions">
          <button
            type="button"
            className="ob-class-btn"
            onClick={() => setMode("create")}
            disabled={busy}
          >
            <span className="ob-class-btn-title">＋ 새 학급 만들기</span>
            <span className="ob-class-btn-sub">6자리 참여 코드가 만들어져요</span>
          </button>
          <button
            type="button"
            className="ob-class-btn"
            onClick={() => setMode("join")}
            disabled={busy}
          >
            <span className="ob-class-btn-title">기존 학급 참여</span>
            <span className="ob-class-btn-sub">받은 코드를 입력하세요</span>
          </button>
        </div>
      )}

      {mode === "create" && (
        <div className="ob-class-form">
          <input
            className="inp"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="학급 이름 (예: 3학년 2반)"
            maxLength={80}
            disabled={busy}
            aria-label="학급 이름"
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => run(onCreate, name.trim())}
            disabled={busy || !name.trim()}
          >
            만들기
          </button>
          <button type="button" className="ob-back" onClick={() => setMode(null)}>
            취소
          </button>
        </div>
      )}

      {mode === "join" && (
        <div className="ob-class-form">
          <input
            className="inp ob-code-inp"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="참여 코드 6자리"
            maxLength={8}
            disabled={busy}
            aria-label="참여 코드"
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => run(onJoin, code.trim())}
            disabled={busy || code.trim().length < 4}
          >
            참여
          </button>
          <button type="button" className="ob-back" onClick={() => setMode(null)}>
            취소
          </button>
        </div>
      )}

      {err && (
        <p className="ob-warn" role="alert">
          {err}
        </p>
      )}
    </>
  );
}
