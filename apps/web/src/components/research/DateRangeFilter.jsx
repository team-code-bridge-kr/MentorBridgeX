/**
 * 기간 필터 — 버튼 하나 + 팝오버.
 *
 * 예전에는 "전체 기간 / 최근 1주 / 1개월 / 3개월" 네 개를 늘 펼쳐 두어서,
 * 키워드 칩과 같은 줄에 같은 모양으로 섞여 있었다. 지금은 지금 적용된 기간을
 * 버튼 하나가 말해 주고, 고를 때만 팝오버가 열린다.
 *
 * 달력은 기본으로 보여주지 않는다. 대부분은 "최근 1개월"이면 끝나고, 달력을
 * 늘 펼쳐 두면 팝오버가 커져서 빠른 선택이 묻힌다. "직접 선택"을 눌러야 나온다.
 *
 * **고르면 곧바로 걸린다.** 적용 단추를 따로 두면 고른 뒤에도 한 번 더 눌러야
 * 하고, 안 누르고 닫으면 고른 것이 사라진다. 다만 직접 선택(달력)은 시작일만
 * 고른 상태로 걸면 결과가 엉뚱해지므로 **종료일까지 고른 순간** 걸린다.
 */

import { useMemo, useRef, useState } from "react";
import { Popover } from "../ui/Popover.jsx";

const QUICK = [
  { days: 0, label: "전체 기간" },
  { days: 1, label: "오늘" },
  { days: 7, label: "최근 1주" },
  { days: 30, label: "최근 1개월" },
  { days: 90, label: "최근 3개월" },
];

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

function MonthGrid({ month, onPick, from, to }) {
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const pad = first.getDay();
    return [
      ...Array.from({ length: pad }, () => null),
      ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
    ];
  }, [month]);

  const today = iso(new Date());
  return (
    <div className="cal-grid" role="grid" aria-label="날짜 선택">
      {WEEK.map((w) => <span key={w} className="cal-wd" aria-hidden="true">{w}</span>)}
      {cells.map((d, i) => {
        if (!d) return <span key={`p${i}`} />;
        const v = iso(d);
        const inRange = from && to && v >= from && v <= to;
        const edge = v === from || v === to;
        return (
          <button
            key={v}
            type="button"
            className={`cal-day${edge ? " is-edge" : ""}${inRange ? " is-in" : ""}${v === today ? " is-today" : ""}`}
            onClick={() => onPick(v)}
            aria-label={`${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`}
            aria-pressed={edge || undefined}
          >
            {d.getDate()}
          </button>
        );
      })}
    </div>
  );
}

export function DateRangeFilter({ days, from, to, onApply }) {
  const anchor = useRef(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ days, from, to });
  const [custom, setCustom] = useState(Boolean(from || to));
  const [month, setMonth] = useState(() => new Date());
  const [warn, setWarn] = useState("");

  const label = from || to
    ? `${from || "처음"} ~ ${to || "오늘"}`
    : (QUICK.find((q) => q.days === days)?.label || "전체 기간");
  const isSet = Boolean(days || from || to);

  const openPop = () => {
    setDraft({ days, from, to });
    setCustom(Boolean(from || to));
    setWarn("");
    setOpen(true);
  };

  /** 빠른 선택 — 누르는 즉시 걸리고 닫힌다. */
  const quick = (d) => {
    setCustom(false);
    setDraft({ days: d, from: "", to: "" });
    onApply({ days: d, from: "", to: "" });
    setOpen(false);
  };

  /** 달력 — 시작일만 고른 상태에서는 아직 걸지 않는다. */
  const pick = (v) => {
    setWarn("");
    setDraft((d) => {
      // 시작만 있거나 범위가 완성된 상태면 새로 시작한다
      if (!d.from || (d.from && d.to)) return { days: 0, from: v, to: "" };
      const next = v < d.from ? { days: 0, from: v, to: d.from } : { ...d, to: v };
      onApply({ days: 0, from: next.from, to: next.to });
      setOpen(false);
      return next;
    });
  };

  return (
    <span className="filter-wrap">
      <button
        ref={anchor}
        type="button"
        className={`filter-btn${isSet ? " is-set" : ""}`}
        onClick={() => (open ? setOpen(false) : openPop())}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        기간: {label}
        <span className="filter-caret" aria-hidden="true">▾</span>
      </button>

      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchor} label="기간 선택">
        <div className="pop-title">기간 선택</div>
        <div className="pop-list">
          {QUICK.map((q) => (
            <button
              key={q.days}
              type="button"
              className={`pop-item${!custom && draft.days === q.days ? " is-on" : ""}`}
              onClick={() => quick(q.days)}
              aria-pressed={!custom && draft.days === q.days}
            >
              {q.label}
            </button>
          ))}
          <button
            type="button"
            className={`pop-item${custom ? " is-on" : ""}`}
            onClick={() => setCustom(true)}
            aria-pressed={custom}
          >
            직접 선택
          </button>
        </div>

        {custom && (
          <div className="cal">
            <div className="cal-hdr">
              <button type="button" className="cal-nav" aria-label="이전 달"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
              <span>{month.getFullYear()}년 {month.getMonth() + 1}월</span>
              <button type="button" className="cal-nav" aria-label="다음 달"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
              <button type="button" className="cal-today" onClick={() => setMonth(new Date())}>오늘</button>
            </div>
            <MonthGrid month={month} onPick={pick} from={draft.from} to={draft.to} />
            <p className="cal-picked">
              {draft.from ? `${draft.from} ~ ${draft.to || "종료일 선택"}` : "시작일을 고르세요"}
            </p>
          </div>
        )}

        {warn && <p className="pop-warn" role="alert">{warn}</p>}
      </Popover>
    </span>
  );
}
