/**
 * 「직접 입력」이 여는 영역 고르개.
 *
 * 예전에는 이 단추가 **세특으로만** 갔다(`open(AREA_META[0])`). 게다가 세특이
 * 이미 있으면 새로 만들지 않고 그중 가장 최근 것을 열었다 — 새로 쓰려고 눌렀는데
 * 이미 있는 「1학년 국어」 편집기가 뜨고, 거기서 지우고 쓰면 원래 기록이 사라졌다.
 *
 * 이제 여덟 영역을 늘어놓고 고르게 한다. 칸마다 지금 상태를 함께 적는다 —
 * 어디로 가는지 모르고 누르는 일이 없어야 한다.
 *
 * **세특만 다르다.** 세특은 한 영역이 아니라 학년별 과목이라, 만들 때 학년과
 * 과목을 받는다. 이름표 없이 만들면 다른 세특들 사이에서 어느 과목 것인지
 * 알 수 없다.
 */

import { useState } from "react";
import { Popover } from "../ui/Popover.jsx";

const GRADES = ["1학년", "2학년", "3학년"];

export function AreaPicker({ open, onClose, anchorRef, areas, countOf, busy, onPick }) {
  const [subjectFor, setSubjectFor] = useState(null);   // 세특을 고른 상태
  const [grade, setGrade] = useState(GRADES[0]);
  const [subject, setSubject] = useState("");

  const close = () => {
    setSubjectFor(null);
    setSubject("");
    onClose();
  };

  const choose = (meta) => {
    if (meta.type === "subject_specific") {
      setSubjectFor(meta);
      return;
    }
    onPick(meta);
    close();
  };

  const submitSubject = () => {
    const s = subject.trim();
    if (!s) return;
    onPick(subjectFor, { subject_id: s, period_id: grade });
    close();
  };

  return (
    <Popover open={open} onClose={close} anchorRef={anchorRef} label="영역 고르기" align="right">
      {subjectFor ? (
        <div className="ap-form">
          <div className="ap-form-t">어느 과목의 세특인가요?</div>
          <div className="ap-grades" role="group" aria-label="학년">
            {GRADES.map((g) => (
              <button
                key={g}
                type="button"
                className={`ap-grade${grade === g ? " is-on" : ""}`}
                aria-pressed={grade === g}
                onClick={() => setGrade(g)}
              >
                {g}
              </button>
            ))}
          </div>
          <input
            className="inp"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitSubject(); } }}
            placeholder="과목 이름 (예: 미적분)"
            maxLength={40}
            autoFocus
          />
          <div className="ap-form-act">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSubjectFor(null)}>
              뒤로
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={submitSubject}
              disabled={busy || !subject.trim()}
            >
              만들기
            </button>
          </div>
        </div>
      ) : (
        <div className="pop-list">
          {areas.map((m) => {
            const n = countOf(m.type);
            return (
              <button
                key={m.type}
                type="button"
                className="pop-item gpop-item"
                disabled={busy}
                onClick={() => choose(m)}
              >
                <span className="gpop-body">
                  <span className="gpop-t">{m.t}</span>
                  {/* 무슨 일이 일어날지 미리 적는다. 「이어 쓰기」와 「새로 쓰기」는
                      결과가 다른 일이라, 누르기 전에 알아야 한다. */}
                  <span className="gpop-hint">
                    {m.type === "subject_specific"
                      ? n ? `과목 ${n}개 있음 · 새 과목을 더합니다` : "새 과목을 만듭니다"
                      : n ? "이미 있음 · 이어서 씁니다" : "아직 없음 · 새로 만듭니다"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Popover>
  );
}
