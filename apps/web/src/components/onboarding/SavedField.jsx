/**
 * 저장까지 맡는 글자 칸.
 *
 * **한 글자 칠 때마다 서버로 보내면 한글이 깨진다.** 예전 코드는 onChange 마다
 * PATCH 를 날렸고, 돌아온 값이 다시 칸에 꽂혔다. 한글은 자모를 모아 한 글자를
 * 만드는 중(IME 조합)인데 그 사이에 value 가 갈리면 조합이 끊긴다 — "다른"을
 * 치면 칸에 "ㄷㄹ"만 남았다.
 *
 * 그래서 치는 동안에는 이 컴포넌트가 들고 있다가, 칸을 벗어나거나 Enter 를
 * 칠 때 한 번만 보낸다. 네트워크를 한 글자마다 두드리지 않는 것은 덤이다.
 */

import { useEffect, useRef, useState } from "react";

export function SavedField({
  id,
  label,
  optional,
  value,
  onSave,
  placeholder,
  maxLength = 120,
  disabled,
}) {
  const [draft, setDraft] = useState(value || "");
  // 마지막으로 서버에 보낸(=서버가 갖고 있는) 값. 밖에서 온 변화와 내가 만든
  // 변화를 가르는 기준이다.
  const saved = useRef(value || "");

  useEffect(() => {
    const next = value || "";
    // 내가 보낸 값이 그대로 돌아온 것이면 건드리지 않는다 — 건드리면 커서가 튄다.
    if (next === saved.current) return;
    saved.current = next;
    setDraft(next);
  }, [value]);

  const commit = () => {
    const v = draft.trim();
    if (v === saved.current) return;
    saved.current = v;
    onSave(v);
  };

  return (
    <div className="inp-group">
      <label className="inp-label" htmlFor={id}>
        {label} {optional && <span className="ob-optional">(선택)</span>}
      </label>
      <input
        id={id}
        className="inp"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
      />
    </div>
  );
}
