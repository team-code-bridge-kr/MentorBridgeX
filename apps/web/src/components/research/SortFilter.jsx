/**
 * 정렬 — 기간 필터와 **같은 방식**으로 고른다.
 *
 * 예전에는 네이티브 `<select>` 였다. 그래서 기간은 눌러서 패널이 열리고 정렬은
 * 운영체제 목록이 뜨는, 나란히 있는 두 조작이 서로 다른 물건처럼 굴었다.
 * (게다가 그 목록은 앱 디자인 밖이라 폰트도 색도 다르다.)
 */

import { useRef, useState } from "react";
import { Popover } from "../ui/Popover.jsx";

const OPTIONS = [
  { id: "latest", label: "최신순" },
  { id: "oldest", label: "오래된순" },
  // 좋아요(따봉)한 글의 주제부터. 관련도순이 아니다 — 근거는 내가 누른
  // 좋아요 하나뿐이고, 그 안에서는 최신순이다.
  { id: "taste", label: "취향순", hint: "좋아요한 주제 먼저" },
];

export function SortFilter({ value, onChange }) {
  const anchor = useRef(null);
  const [open, setOpen] = useState(false);
  const current = OPTIONS.find((o) => o.id === value) || OPTIONS[0];

  return (
    <span className="filter-wrap">
      <button
        ref={anchor}
        type="button"
        className="filter-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        정렬: {current.label}
        <span className="filter-caret" aria-hidden="true">▾</span>
      </button>

      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchor} label="정렬 기준">
        <div className="pop-title">정렬 기준</div>
        <div className="pop-list">
          {OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`pop-item${o.id === value ? " is-on" : ""}`}
              aria-pressed={o.id === value}
              onClick={() => { onChange(o.id); setOpen(false); }}
            >
              {o.label}
              {o.hint && <span className="pop-item-hint">{o.hint}</span>}
            </button>
          ))}
        </div>
      </Popover>
    </span>
  );
}
