/**
 * 생기부 책 넘김 뷰어.
 *
 * 카드 8개로 늘어놓으면 "한 권의 기록"이라는 감각이 없다. 펼침면(두 쪽)으로
 * 보여주고 넘기게 하면 처음부터 끝까지 훑어보게 된다.
 *
 * PDF 를 그리는 것이 아니라 **추출된 텍스트**를 쪽으로 나눠 그린다. 원본 PDF 는
 * 서버에 오래 두지 않기 때문에 나중에 다시 열 수가 없다. 대신 텍스트라서
 * 화면 크기에 맞춰 다시 흐르고, 글자를 복사할 수도 있다.
 *
 * page-flip 같은 라이브러리를 쓰지 않았다. 고정 크기 이미지 페이지를 전제로 해서
 * 길이가 제각각인 텍스트와 잘 안 맞고, 넘김 효과 자체는 CSS 3D 로 충분하다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// 한 쪽에 들어갈 대략의 글자 수. 쪽 높이(560px)에 13.5px/1.9 줄간격으로
// 22줄 정도가 들어가고, 한 줄에 40자 안팎이 담긴다.
const CHARS_PER_PAGE = 880;

/** 문단을 유지하면서 쪽으로 나눈다. 문단이 통째로 길면 문장 단위로 더 자른다. */
function paginate(text) {
  const pages = [];
  let buf = "";
  const push = () => { if (buf.trim()) pages.push(buf.trim()); buf = ""; };

  for (const para of String(text || "").split(/\n+/)) {
    const chunks =
      para.length <= CHARS_PER_PAGE
        ? [para]
        : para.match(/[^.!?。]+[.!?。]?\s*/g) || [para];
    for (const chunk of chunks) {
      if (buf.length + chunk.length > CHARS_PER_PAGE && buf) push();
      buf += (buf ? "\n" : "") + chunk;
    }
    if (buf.length > CHARS_PER_PAGE * 0.75) push();
  }
  push();
  return pages.length ? pages : [""];
}

/** 영역 목록 → 쪽 목록. 영역마다 표지 한 쪽을 먼저 둔다. */
function buildPages(areas) {
  const pages = [];
  for (const area of areas) {
    pages.push({ kind: "cover", area });
    paginate(area.content).forEach((body, i, arr) => {
      pages.push({ kind: "body", area, body, part: i + 1, total: arr.length });
    });
  }
  return pages;
}

export function BookViewer({ areas }) {
  const pages = useMemo(() => buildPages(areas), [areas]);
  // 펼침면 기준 인덱스 — 왼쪽 쪽 번호는 항상 짝수다
  const [spread, setSpread] = useState(0);
  const [turning, setTurning] = useState(null); // "next" | "prev"
  const [single, setSingle] = useState(false);
  const reduce = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduce.current = mq.matches;
    const onChange = (e) => { reduce.current = e.matches; };
    mq.addEventListener("change", onChange);
    // 좁은 화면에서는 펼침면 대신 한 쪽씩 — 두 쪽을 욱여넣으면 글자가 못 읽게 작아진다
    const narrow = window.matchMedia("(max-width: 900px)");
    setSingle(narrow.matches);
    const onNarrow = (e) => setSingle(e.matches);
    narrow.addEventListener("change", onNarrow);
    return () => {
      mq.removeEventListener("change", onChange);
      narrow.removeEventListener("change", onNarrow);
    };
  }, []);

  const step = single ? 1 : 2;
  const maxSpread = Math.max(0, Math.ceil(pages.length / step) - 1);

  const go = useCallback(
    (dir) => {
      setSpread((cur) => {
        const next = Math.min(maxSpread, Math.max(0, cur + dir));
        if (next === cur) return cur;
        if (!reduce.current) {
          setTurning(dir > 0 ? "next" : "prev");
          setTimeout(() => setTurning(null), 460);
        }
        return next;
      });
    },
    [maxSpread]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const left = pages[spread * step];
  const right = single ? null : pages[spread * step + 1];

  const renderPage = (page, side) => {
    if (!page) return <div className={`book-page book-${side} is-blank`} aria-hidden="true" />;
    if (page.kind === "cover") {
      return (
        <div className={`book-page book-${side} is-cover`}>
          <div className="book-cover-inner">
            <span className="book-cover-kicker">생활기록부</span>
            <h3 className="book-cover-title">{page.area.title}</h3>
            <p className="book-cover-desc">{page.area.desc}</p>
            <span className="book-cover-chars">{page.area.content.length.toLocaleString()}자</span>
          </div>
          <span className="book-page-no">{pages.indexOf(page) + 1}</span>
        </div>
      );
    }
    return (
      <div className={`book-page book-${side}`}>
        <div className="book-page-hdr">
          {page.area.title}
          {page.total > 1 && <span className="book-page-part"> · {page.part}/{page.total}</span>}
        </div>
        <p className="book-page-body">{page.body}</p>
        <span className="book-page-no">{pages.indexOf(page) + 1}</span>
      </div>
    );
  };

  return (
    <div className="book-viewer">
      <div className={`book-stage${single ? " is-single" : ""}${turning ? ` is-${turning}` : ""}`}>
        <button
          type="button"
          className="book-arrow book-arrow-prev"
          onClick={() => go(-1)}
          disabled={spread <= 0}
          aria-label="이전 쪽"
        >
          ‹
        </button>

        <div className="book-spread">
          {renderPage(left, "left")}
          {!single && renderPage(right, "right")}
        </div>

        <button
          type="button"
          className="book-arrow book-arrow-next"
          onClick={() => go(1)}
          disabled={spread >= maxSpread}
          aria-label="다음 쪽"
        >
          ›
        </button>
      </div>

      <div className="book-foot">
        <span className="book-progress">
          {Math.min(pages.length, spread * step + 1)}
          {!single && right ? `–${spread * step + 2}` : ""} / {pages.length}쪽
        </span>
        <input
          className="book-slider"
          type="range"
          min={0}
          max={maxSpread}
          value={spread}
          onChange={(e) => setSpread(Number(e.target.value))}
          aria-label="쪽 이동"
        />
      </div>
    </div>
  );
}
