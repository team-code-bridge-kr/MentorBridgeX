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
 * 적용 전에는 목록을 건드리지 않는다 — 날짜를 고르는 도중에 결과가 계속
 * 바뀌면 무엇을 고르는 중인지 알 수 없다.
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

  const pick = (v) => {
    setWarn("");
    setDraft((d) => {
      // 시작만 있거나 범위가 완성된 상태면 새로 시작한다
      if (!d.from || (d.from && d.to)) return { days: 0, from: v, to: "" };
      if (v < d.from) return { days: 0, from: v, to: d.from };
      return { ...d, to: v };
    });
  };

  const apply = () => {
    if (draft.from && draft.to && draft.from > draft.to) {
      setWarn("시작일이 종료일보다 늦습니다.");
      return;
    }
    onApply(custom ? { days: 0, from: draft.from, to: draft.to } : { days: draft.days, from: "", to: "" });
    setOpen(false);
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
        <span aria-hidden="true">🗓</span>
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
              onClick={() => { setCustom(false); setDraft({ days: q.days, from: "", to: "" }); }}
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

        <div className="pop-foot">
          <button type="button" className="rs-save"
            onClick={() => { setDraft({ days: 0, from: "", to: "" }); setCustom(false); setWarn(""); }}>
            초기화
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={apply}>적용</button>
        </div>
      </Popover>
    </span>
  );
}
