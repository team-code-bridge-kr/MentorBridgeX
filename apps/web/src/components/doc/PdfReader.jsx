/**
 * 생기부 리더 — 원본 위에 구획을 얹고, 오른쪽에 이어지는 기록을 띄운다.
 *
 * 생기부는 수상경력·창의적체험활동·세특이 서로 다른 쪽에 흩어져 있다. 한 항목을
 * 보면서 관련 기록을 확인하려면 계속 앞뒤로 넘겨야 한다. 이 화면의 목적은
 * 그 왕복을 한 자리에서 되게 만드는 것이다.
 *
 * 설계에서 물러서지 않은 것 셋:
 *
 * 1. **패널은 문서를 덮지 않는다.** 오버레이로 띄우면 펼침 보기에서 오른쪽
 *    쪽면을 가린다. 좌우로 나눠 붙인다.
 * 2. **하이라이트는 옅게.** 생기부는 이미 표선 + 빽빽한 명조체다. 채도 있는
 *    면을 얹으면 글자가 안 읽히고, 구획이 열 개 넘는 쪽은 파란 얼룩이 된다.
 * 3. **근거 없는 연결은 만들지 않는다.** 카드마다 "왜 이게 떴는지" 한 줄이
 *    붙는다(lib/pdfLinks.js). 규칙으로 설명 못 하면 아예 안 띄운다.
 *
 * 좌표는 전부 0~1 비율이다. px 로 잡으면 창 크기·줌·모바일에서 다 틀어진다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  footerMask, toLines, findAnchors, findSubjectAnchors, findGradeMarks,
} from "../../lib/pdfRegions.js";
import { linksFrom, linksForPage, factsForPage } from "../../lib/pdfLinks.js";
import { API_BASE, getToken } from "../../api/client.js";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const FOOTER_RATIO = 0.92;   // 이 아래는 인적사항 가림띠다. 구획을 걸치지 않는다.
const MIN_REGION_PT = 10;    // 이보다 얇은 구획은 누를 수가 없다
const TURN_MS = 150;         // 문서 크로스페이드
const RETURN_MS = 260;       // 연타 판정 — 이보다 빠르면 페이드를 건너뛴다
const FLASH_MS = 620;        // 깜빡임 한 번

const TYPE_KIND = {
  award: "수상", autonomous: "자율활동", club: "동아리활동", volunteer: "봉사활동",
  career: "진로활동", reading: "독서활동", behavior: "행동특성", subject_specific: "세특",
};
const KEY_TYPE = {
  award: "award", autonomous: "autonomous", club: "club", volunteer: "volunteer",
  career: "career", reading: "reading", behavior: "behavior",
};

/* ── 문서 훑기 ──────────────────────────────────────────────
   한 번만 돈다. 쪽을 넘길 때마다 다시 읽으면 19쪽짜리에서 넘김이 굼떠진다. */
async function scanDocument(doc, subjects) {
  const pages = [];
  let grade = "";
  for (let no = 1; no <= doc.numPages; no += 1) {
    const page = await doc.getPage(no);
    const vp = page.getViewport({ scale: 1 });
    const lines = toLines(await page.getTextContent(), vp, pdfjs);
    const marks = findGradeMarks(lines, vp.width);
    const areas = findAnchors(lines, vp.width);
    const subs = findSubjectAnchors(lines, subjects, vp.width);

    const anchors = [
      // 세특 제목("과목 | 세부능력 및 특기사항")은 표 머리라 쪽마다 다시 찍힌다.
      // 그 쪽에 과목이 잡혔으면 과목 쪽이 더 잘게 나누므로 제목은 버린다.
      ...areas
        .filter((a) => !(a.key === "subject" && subs.length))
        .map((a) => ({ y: a.y, kind: "area", key: a.key, label: a.label })),
      ...subs.map((a) => ({ y: a.y, kind: "subject", subject: a.subject })),
    ].sort((a, b) => a.y - b.y);

    const bottom = vp.height * FOOTER_RATIO;
    const regions = [];
    anchors.forEach((a, i) => {
      const yStart = Math.max(0, a.y - 4);
      const yEnd = Math.min(bottom, anchors[i + 1] ? anchors[i + 1].y - 4 : bottom);
      if (yEnd - yStart < MIN_REGION_PT) return;
      // 학년은 `[1학년]` 표시로 나뉜다. 이 앵커 앞의 마지막 표시가 이 구획의 학년.
      const g = [...marks].filter((m) => m.y <= a.y).pop()?.grade || grade;
      regions.push({
        id: `r${no}-${Math.round(a.y)}`,
        page: no,
        kind: a.kind,
        key: a.key || "",
        subject: a.subject || "",
        grade: g,
        label: a.kind === "subject" ? `${g ? `${g} ` : ""}${a.subject} 세특` : a.label,
        rect: { x: 0.03, w: 0.94, y: yStart / vp.height, h: (yEnd - yStart) / vp.height },
      });
    });
    if (marks.length) grade = marks[marks.length - 1].grade;
    pages.push({ no, regions });
  }
  return pages;
}

/* ── 구획 ↔ 저장된 글 잇기 ─────────────────────────────────
   구획은 PDF 좌표, 항목은 데이터베이스 행이다. 둘을 이어야 카드를 누를 때
   어느 쪽으로 뛸지 알 수 있다. */
function bindItems(pages, docs) {
  const items = docs.map((d) => ({
    id: d.id,
    kind: TYPE_KIND[d.section_type] || d.section_type,
    subject: d.subject_id || "",
    grade: d.period_id || "",
    text: d.content || "",
    page: 0,
    regionId: "",
  }));
  const byId = new Map(items.map((i) => [i.id, i]));

  for (const page of pages) {
    for (const region of page.regions) {
      let doc;
      if (region.kind === "subject") {
        doc = docs.find(
          (d) => d.section_type === "subject_specific" && d.subject_id === region.subject
            && (!d.period_id || !region.grade || d.period_id === region.grade),
        );
      } else if (KEY_TYPE[region.key]) {
        doc = docs.find((d) => d.section_type === KEY_TYPE[region.key]);
      }
      region.itemId = doc?.id || "";
      const item = doc && byId.get(doc.id);
      if (item && !item.page) { item.page = page.no; item.regionId = region.id; }
    }
  }
  return items;
}

/* ── 한 쪽 ──────────────────────────────────────────────── */
function ReaderPage({ doc, pageNo, width, mask, regions, show, selected, flash, onPick }) {
  const ref = useRef(null);
  const [size, setSize] = useState(null);

  useEffect(() => {
    if (!doc || !pageNo) return undefined;
    let cancelled = false;
    let task;
    (async () => {
      const page = await doc.getPage(pageNo);
      if (cancelled) return;
      const raw = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width / raw.width });
      const dpr = window.devicePixelRatio || 1;
      const canvas = ref.current;
      if (!canvas) return;
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      task = page.render({ canvasContext: ctx, viewport });
      try {
        await task.promise;
        if (cancelled) return;
        if (mask) {
          const m = footerMask(viewport);
          ctx.fillStyle = "#e9edf3";
          ctx.fillRect(m.x, m.y, m.w, m.h);
          ctx.fillStyle = "#8b95a1";
          ctx.font = "10px Pretendard, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("인적사항 가림", m.x + m.w / 2, m.y + m.h / 2 + 3);
        }
        setSize({ w: viewport.width, h: viewport.height });
      } catch { /* 쪽을 넘기면 앞 렌더는 취소된다 — 정상 */ }
    })();
    return () => {
      cancelled = true;
      task?.cancel?.();
      const c = ref.current;
      if (c) { c.width = 0; c.height = 0; }
    };
  }, [doc, pageNo, width, mask]);

  if (!pageNo) return <div className="rd-page is-blank" aria-hidden="true" />;
  return (
    <div className="rd-page">
      <canvas ref={ref} />
      {size && (
        <div className="rd-layer" style={{ width: size.w, height: size.h }}>
          {regions.map((r) => (
            <button
              key={r.id}
              type="button"
              id={`region-${r.id}`}
              className={`rd-region${show ? " is-shown" : ""}${selected === r.id ? " is-on" : ""}${flash === r.id ? " is-flash" : ""}`}
              style={{
                left: `${r.rect.x * 100}%`, top: `${r.rect.y * 100}%`,
                width: `${r.rect.w * 100}%`, height: `${r.rect.h * 100}%`,
              }}
              aria-pressed={selected === r.id}
              aria-label={r.label}
              onClick={() => onPick(r)}
            />
          ))}
        </div>
      )}
      <span className="rd-page-no">{pageNo}</span>
    </div>
  );
}

/* ── 카드 ───────────────────────────────────────────────── */
function LinkCard({ item, why, target, onJump }) {
  return (
    <button
      type="button"
      className={`rd-card${target ? " is-target" : ""}`}
      onClick={() => onJump(item)}
      disabled={!item.page}
    >
      <div className="rd-card-head">
        <span className={`rd-chip${item.kind === "세특" ? " is-subject" : ""}`}>
          {item.subject || item.kind}
        </span>
        <span className="rd-card-meta">
          {item.page ? `${item.page}쪽 · ` : ""}{item.text.length.toLocaleString()}자
        </span>
      </div>
      <p className="rd-card-body">{item.text}</p>
      <div className="rd-why"><i aria-hidden="true" />{why}</div>
    </button>
  );
}

/* ── 리더 ───────────────────────────────────────────────── */
export function PdfReader({ docs = [], keywords = [], filename = "", toolbar = null, mask = true, onMissing }) {
  const [doc, setDoc] = useState(null);
  const [err, setErr] = useState("");
  const [pages, setPages] = useState(null);
  const [spread, setSpread] = useState(0);
  const [single, setSingle] = useState(false);
  const [show, setShow] = useState(true);
  const [sel, setSel] = useState(null);      // 고른 구획
  const [flash, setFlash] = useState("");
  const [fading, setFading] = useState(false);
  const [pageW, setPageW] = useState(420);
  const stage = useRef(null);
  const lastTurn = useRef(0);
  const reduce = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let loaded;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/v1/students/me/documents/file`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.status === 404) { onMissing?.(); return; }
        if (!res.ok) throw new Error(`원본을 불러오지 못했습니다 (HTTP ${res.status})`);
        loaded = await pdfjs.getDocument({ data: await res.arrayBuffer() }).promise;
        if (cancelled) { loaded.destroy?.(); return; }
        setDoc(loaded);
      } catch (e) {
        if (!cancelled) setErr(e.message);
      }
    })();
    return () => { cancelled = true; loaded?.destroy?.(); };
  }, [onMissing]);

  // 과목 이름은 저장된 세특에서 온다 — PDF 에서 과목을 추측하지 않는다.
  const subjects = useMemo(
    () => docs.filter((d) => d.section_type === "subject_specific" && d.subject_id)
      .map((d) => d.subject_id),
    [docs],
  );

  useEffect(() => {
    if (!doc) return undefined;
    let cancelled = false;
    (async () => {
      const scanned = await scanDocument(doc, subjects);
      if (!cancelled) setPages(scanned);
    })();
    return () => { cancelled = true; };
  }, [doc, subjects]);

  const items = useMemo(() => (pages ? bindItems(pages, docs) : []), [pages, docs]);
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduce.current = motion.matches;
    const onMotion = (e) => { reduce.current = e.matches; };
    motion.addEventListener("change", onMotion);
    const narrow = window.matchMedia("(max-width: 1100px)");
    setSingle(narrow.matches);
    const onNarrow = (e) => setSingle(e.matches);
    narrow.addEventListener("change", onNarrow);
    return () => {
      motion.removeEventListener("change", onMotion);
      narrow.removeEventListener("change", onNarrow);
    };
  }, []);

  // 쪽 폭은 남는 자리에서 계산한다. 고정 px 로 두면 좁은 화면에서 잘리고
  // 넓은 화면에서는 가운데에 우표만 하게 남는다.
  useEffect(() => {
    const el = stage.current;
    if (!el) return undefined;
    const measure = () => {
      const per = single ? 1 : 2;
      const usable = el.clientWidth - 96 - (per - 1) * 8;
      setPageW(Math.max(280, Math.min(520, Math.floor(usable / per))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [single, pages]);

  const total = doc?.numPages || 0;
  const step = single ? 1 : 2;
  const maxSpread = Math.max(0, Math.ceil(total / step) - 1);
  const leftNo = spread * step + 1;
  const rightNo = single ? 0 : leftNo + 1;
  const shownNos = [leftNo, rightNo].filter((n) => n && n <= total);

  const turn = useCallback((dir) => {
    setSpread((cur) => {
      const next = Math.min(maxSpread, Math.max(0, cur + dir));
      if (next === cur) return cur;
      const now = performance.now();
      // 연타 중에는 페이드를 건너뛴다. 빠르게 넘길 때 깜빡거리면 멀미가 난다.
      if (!reduce.current && now - lastTurn.current > RETURN_MS) {
        setFading(true);
        setTimeout(() => setFading(false), TURN_MS);
      }
      lastTurn.current = now;
      setSel(null); // 쪽이 바뀌면 고른 구획은 풀린다
      return next;
    });
  }, [maxSpread]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.tagName === "INPUT" || e.target?.tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight") turn(1);
      else if (e.key === "ArrowLeft") turn(-1);
      else if (e.key === "Escape") setSel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn]);

  const jump = useCallback((item) => {
    if (!item.page) return;
    const nextSpread = Math.floor((item.page - 1) / step);
    setSpread(nextSpread);
    setSel(item.regionId || null);
    // 깜빡임 두 번. 이 왕복이 되는 순간 체감이 달라진다.
    setFlash("");
    setTimeout(() => {
      setFlash(item.regionId);
      const el = document.getElementById(`region-${item.regionId}`);
      el?.scrollIntoView({ block: "center", behavior: reduce.current ? "auto" : "smooth" });
      setTimeout(() => setFlash(""), FLASH_MS * 2 + 40);
    }, 60);
  }, [step]);

  const pageRegions = useMemo(() => {
    if (!pages) return [];
    return shownNos.flatMap((n) => pages[n - 1]?.regions || []);
  }, [pages, shownNos.join(",")]);

  const selRegion = pageRegions.find((r) => r.id === sel) || null;
  const sources = (selRegion ? [selRegion] : pageRegions)
    .map((r) => itemById.get(r.itemId))
    .filter(Boolean);
  const links = selRegion
    ? linksFrom(sources[0], items, keywords)
    : linksForPage(sources, items, keywords);
  const facts = selRegion ? [] : factsForPage(sources);

  if (err || !doc || !pages) {
    return (
      <div className="rd">
        <div className="rd-bar">{toolbar}<span className="rd-file">{filename || "생기부"}</span></div>
        <div className="rs-empty" style={err ? { color: "var(--danger)" } : undefined}>
          {err || "생기부를 읽는 중…"}
        </div>
      </div>
    );
  }

  return (
    <div className="rd">
      <div className="rd-bar">
        {toolbar}
        <span className="rd-file">{filename || "생기부"}</span>
        <button
          type="button"
          className={`rd-toggle${show ? " is-on" : ""}`}
          aria-pressed={show}
          onClick={() => setShow((v) => !v)}
          title="구획 표시를 끄면 마우스를 올렸을 때만 보입니다"
        >
          <i aria-hidden="true" /> 구획 표시
        </button>
        <div className="rd-nav">
          <button type="button" onClick={() => turn(-1)} disabled={spread <= 0} aria-label="이전 쪽">‹</button>
          <span>{shownNos.join("–")} / {total}</span>
          <button type="button" onClick={() => turn(1)} disabled={spread >= maxSpread} aria-label="다음 쪽">›</button>
        </div>
      </div>

      <div className="rd-body">
        <div className="rd-stage" ref={stage}>
          <div className={`rd-spread${fading ? " is-fading" : ""}`}>
            <ReaderPage
              doc={doc} pageNo={leftNo <= total ? leftNo : 0} width={pageW} mask={mask}
              regions={pages[leftNo - 1]?.regions || []}
              show={show} selected={sel} flash={flash} onPick={(r) => setSel((c) => (c === r.id ? null : r.id))}
            />
            {!single && (
              <ReaderPage
                doc={doc} pageNo={rightNo <= total ? rightNo : 0} width={pageW} mask={mask}
                regions={pages[rightNo - 1]?.regions || []}
                show={show} selected={sel} flash={flash} onPick={(r) => setSel((c) => (c === r.id ? null : r.id))}
              />
            )}
          </div>
        </div>

        <aside className="rd-panel">
          <div className="rd-panel-head">
            <span className="rd-eyebrow">{selRegion ? "선택한 구획" : `${shownNos.join("–")}쪽`}</span>
            <h3>{selRegion ? selRegion.label : (pageRegions[0]?.label || "이 쪽")}</h3>
            {selRegion && (
              <button type="button" className="rd-back" onClick={() => setSel(null)}>← 쪽 전체 보기</button>
            )}
          </div>

          {!!facts.length && (
            <div className="rd-facts">
              <div className="rd-sec-title">이 쪽에서 읽어낸 것</div>
              {facts.map(([k, v]) => (
                <div key={k} className="rd-fact"><span>{k}</span><strong>{v}</strong></div>
              ))}
            </div>
          )}

          <div className="rd-links">
            <div className="rd-sec-title">이어지는 기록 {links.length ? `${links.length}개` : ""}</div>
            {links.map((l, i) => {
              const item = itemById.get(l.itemId);
              return item ? (
                <LinkCard key={l.itemId} item={item} why={l.why} target={!!selRegion && i === 0} onJump={jump} />
              ) : null;
            })}
            {!links.length && (
              <div className="rd-empty">
                <strong>이어지는 기록이 없어요</strong>
                <span>
                  {selRegion
                    ? "이 구획은 다른 기록과 겹치는 내용이 없습니다. 다른 파란 구획을 눌러 보세요."
                    : "이 쪽은 다른 기록과 겹치는 내용이 없습니다. 다음 쪽으로 넘겨 보세요."}
                </span>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
