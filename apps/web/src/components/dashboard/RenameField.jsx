/**
 * 제자리에서 이름 고치기.
 *
 * 최근 대화 목록과 대화 화면 머리에서 같이 쓴다. 이름을 바꾸려고 다른 화면이나
 * 모달로 보내지 않는다 — 고치려는 이름이 눈앞에 있는데 창을 띄울 이유가 없다.
 *
 * 규칙은 셋뿐이다: Enter 저장 / Esc 취소 / 다른 곳을 누르면 저장.
 * 비워 두면 저장하지 않는다 — 이름 없는 대화는 목록에서 찾을 수가 없다.
 */

import { useEffect, useRef, useState } from "react";

export function RenameField({ value, onSave, onCancel, className = "", label = "대화 이름" }) {
  const [text, setText] = useState(value);
  const inputRef = useRef(null);
  // Esc 로 닫으면 사라지면서 blur 도 뜬다 — 취소한 뒤에 저장되면 안 된다
  const doneRef = useRef(false);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    // preventScroll: 위쪽 카드 가로 스크롤이 딸려 움직이지 않게
    el.focus({ preventScroll: true });
    el.select(); // 전체 선택 — 대개 서버가 붙인 긴 제목을 통째로 갈아 끼운다
  }, []);

  const finish = (save) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const next = text.trim();
    if (save && next && next !== value) onSave(next);
    else onCancel();
  };

  return (
    <form
      className={`rn-form ${className}`.trim()}
      onSubmit={(e) => {
        e.preventDefault();
        finish(true);
      }}
    >
      <input
        ref={inputRef}
        className="rn-input"
        value={text}
        maxLength={120}
        aria-label={label}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            finish(false);
          }
        }}
        onBlur={() => finish(true)}
      />
      <span className="rn-hint" aria-hidden="true">Enter 저장 · Esc 취소</span>
    </form>
  );
}
