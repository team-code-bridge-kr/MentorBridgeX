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
  footerMask, toItems, toLines, findAnchors, findCellLabels, findSubjectAnchors,
  findGradeMarks, findRowGrades, findRules, findSectionBreaks, findHeaderTables, snapToRule,
} from "../../lib/pdfRegions.js";
import { linksFrom, linksForPage, factsForPage } from "../../lib/pdfLinks.js";
import { NavIcon } from "../NavIcon.jsx";
import { API_BASE, getToken } from "../../api/client.js";
import { showLoading } from "../LoadingDock.jsx";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const FOOTER_RATIO = 0.92;   // 이 아래는 인적사항 가림띠다. 구획을 걸치지 않는다.
const MIN_REGION_PT = 10;    // 이보다 얇은 구획은 누를 수가 없다
const TURN_MS = 150;         // 문서 크로스페이드
const RETURN_MS = 260;       // 연타 판정 — 이보다 빠르면 페이드를 건너뛴다
const FLASH_MS = 620;        // 깜빡임 한 번
const COACH_SEEN = "mbx_reader_coach";
/**
 * 안내를 늘 띄워 둘지.
 *
 * 문구를 고치는 동안에만 true 로 둔다. 그때는 「알겠어요」를 눌러도 닫히지
 * 않아서, 다 고치고 나면 반드시 false 로 되돌려야 한다 — 안 그러면 두 번째
 * 방문부터 잔소리가 되고, 무엇보다 **닫히지 않는 안내는 고장으로 읽힌다.**
 */
const COACH_ALWAYS = false;

const TYPE_KIND = {
  award: "수상", autonomous: "자율활동", club: "동아리활동", volunteer: "봉사활동",
  career: "진로활동", reading: "독서활동", behavior: "행동특성", subject_specific: "세특",
};
// 학년마다 되풀이되는 영역. 창체 표는 학년별로 자율·동아리·진로 세 줄이 있다.
// 수상경력·독서활동·행동특성·봉사활동 실적은 표 하나에 모든 학년이 들어 있어서
// 학년을 붙이면 거짓말이 된다.
const GRADED_KEYS = new Set(["autonomous", "club", "career"]);
const KEY_TYPE = {
  award: "award", autonomous: "autonomous", club: "club", volunteer: "volunteer",
  career: "career", reading: "reading", behavior: "behavior",
};

/* ── 문서 훑기 ──────────────────────────────────────────────
   한 번만 돈다. 쪽을 넘길 때마다 다시 읽으면 19쪽짜리에서 넘김이 굼떠진다.

   경계는 세 가지에서 온다.
   ① 표 안 라벨(자율활동 …) — 셀 가운데에 놓이므로 **바로 위 괘선에 붙인다**
   ② 번호 붙은 대제목(`4. 자격증 …`) — 구획은 아니지만 앞 구획을 여기서 끊는다
   ③ 세특 과목(`국어:`) — 표가 아니라 한 셀 안의 글이라 괘선이 없다. 글 위치 그대로

   그리고 **쪽을 넘어 이어지는 구획**을 만든다. 수상경력 표는 1쪽에서 시작해
   2쪽 위까지 이어지는데, 2쪽에는 제목이 없어서 앵커만 보면 그 표가 통째로
   빠진다(예전 화면이 그랬다). */
async function scanDocument(doc, subjects) {
  const pages = [];
  let carry = null;   // 앞 쪽에서 이어져 오는 구획
  let grade = "";     // 세특 학년 — `[1학년]` 표시에서
  let rowGrade = "";  // 창체 학년 — 표 맨 왼쪽 숫자 칸에서

  for (let no = 1; no <= doc.numPages; no += 1) {
    const page = await doc.getPage(no);
    const vp = page.getViewport({ scale: 1 });
    const text = await page.getTextContent();
    const items = toItems(text, vp, pdfjs);
    const lines = toLines(text, vp, pdfjs);
    const rules = findRules(await page.getOperatorList(), vp, pdfjs);
    const marks = findGradeMarks(lines, vp.width);
    const subs = findSubjectAnchors(lines, subjects, vp.width);
    const bottom = vp.height * FOOTER_RATIO;

    const gradeAt = (y) => [...marks].filter((m) => m.y <= y).pop()?.grade || grade;
    // 창체 라벨은 가장 가까운 학년 칸을 따른다. 그 쪽에 숫자가 없으면(학년 묶음이
    // 쪽을 넘어온 것) 앞에서 쓰던 학년을 이어 쓴다.
    const rows = findRowGrades(items, vp.width);
    const rowGradeAt = (y) => {
      if (!rows.length) return rowGrade;
      return rows.reduce((a, b) => (Math.abs(a.y - y) <= Math.abs(b.y - y) ? a : b)).grade;
    };

    const bounds = [
      // 대제목 — 표 밖에 있으므로 글 위치가 곧 시작이다
      ...findAnchors(lines, vp.width)
        // 세특 표 머리("과목 | 세부능력 및 특기사항")는 구획이 아니다. 구획은
        // 과목이다. 표 머리를 구획으로 삼으면 앞 쪽에서 이어지던 과목이 통째로
        // 지워진다(표본 13·18쪽).
        .filter((a) => a.key !== "subject")
        .map((a) => ({ y: a.y - 4, kind: "area", key: a.key, label: a.label, at: a.y })),
      // 표 안 라벨 — 셀 세로 가운데에 놓이므로 바로 위 괘선에 붙인다
      ...[...findCellLabels(items, vp.width), ...findHeaderTables(items, vp.width)]
        .map((a) => ({
          y: snapToRule(rules, a.y), kind: "area", key: a.key, label: a.label, at: a.y,
          rowGrade: rowGradeAt(a.y),
        })),
      ...subs.map((a) => ({ y: a.y - 4, kind: "subject", subject: a.subject, at: a.y })),
      // `[2학년]` 표시 뒤에는 성적표가 온다. 앞 과목을 여기서 끊지 않으면
      // 2학년 미술 구획이 3학년 성적표까지 덮는다.
      ...[...findSectionBreaks(lines, vp.width), ...marks]
        .map((b) => ({ y: b.y - 4, kind: "break", at: b.y })),
    ].sort((a, b) => a.y - b.y || (a.kind === "break" ? 1 : -1));

    // 같은 자리를 두 번 세지 않는다 — `3. 수상경력` 은 대제목이자 영역이다.
    const merged = [];
    for (const b of bounds) {
      const prev = merged[merged.length - 1];
      if (prev && Math.abs(prev.y - b.y) < 3) {
        if (prev.kind === "break" && b.kind !== "break") merged[merged.length - 1] = b;
        continue;
      }
      merged.push(b);
    }

    const regions = [];
    const push = (meta, yStart, yEnd) => {
      if (yEnd - yStart < MIN_REGION_PT) return;
      regions.push({
        ...meta,
        id: `${meta.rid}@${no}#${regions.length}`,
        page: no,
        rect: { x: 0.03, w: 0.94, y: yStart / vp.height, h: (yEnd - yStart) / vp.height },
      });
    };

    // 이어짐 — 쪽 맨 위(표 머리 아래 첫 괘선)부터 첫 경계까지
    if (carry) {
      const top = rules.find((r) => r < vp.height * 0.14) ?? 0;
      push(carry, top, merged.length ? merged[0].y : bottom);
    }

    merged.forEach((b, i) => {
      const yEnd = i + 1 < merged.length ? merged[i + 1].y : bottom;
      if (b.kind === "break") { carry = null; return; }
      const g = gradeAt(b.at);
      const meta = b.kind === "subject"
        ? { rid: `s:${g}:${b.subject}`, kind: "subject", key: "", subject: b.subject, grade: g,
            label: `${g ? `${g} ` : ""}${b.subject} 세특` }
        : (() => {
          const withGrade = GRADED_KEYS.has(b.key) && (b.rowGrade || "");
          if (withGrade) rowGrade = withGrade;
          return {
            rid: `a:${b.key}${withGrade ? `:${withGrade}` : ""}`,
            kind: "area", key: b.key, subject: "", grade: withGrade || "",
            label: withGrade ? `${withGrade} ${b.label}` : b.label,
          };
        })();
      push(meta, b.y, yEnd);
      carry = i === merged.length - 1 ? meta : carry;
    });
    if (!merged.length && !carry) carry = null;

    // 이어진 쪽에서는 제목이 다시 찍힌다. 그러면 같은 구획이 위아래 두 도막으로
    // 나뉜다 — 맞닿아 있으면 하나로 만든다.
    const joined = [];
    for (const r of regions) {
      const prev = joined[joined.length - 1];
      if (prev && prev.rid === r.rid && Math.abs((prev.rect.y + prev.rect.h) - r.rect.y) < 0.01) {
        prev.rect.h = r.rect.y + r.rect.h - prev.rect.y;
        continue;
      }
      joined.push(r);
    }

    if (marks.length) grade = marks[marks.length - 1].grade;
    pages.push({ no, regions: joined });
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
      if (item && !item.page) { item.page = page.no; item.regionId = region.rid; }
    }
  }

  // 같은 글이 두 벌 저장돼 있으면 카드도 두 장 나온다(실제로 자율활동 1,852자가
  // 두 번, 수상 822자가 두 번 떴다). 사람이 보기에 같은 것은 하나로 친다.
  // 남기는 쪽은 **쪽 번호를 아는 것** — 그래야 눌러서 뛸 수 있다.
  const canon = new Map();  // 열쇠 → 남길 항목
  for (const it of items) {
    const key = `${it.kind}|${it.subject}|${it.text.replace(/\s+/g, "").slice(0, 120)}`;
    const kept = canon.get(key);
    if (!kept || (!kept.page && it.page)) canon.set(key, it);
  }
  const keep = new Set([...canon.values()].map((i) => i.id));
  const alias = new Map();  // 지워질 id → 남길 id
  for (const it of items) {
    const key = `${it.kind}|${it.subject}|${it.text.replace(/\s+/g, "").slice(0, 120)}`;
    const kept = canon.get(key);
    if (kept && kept.id !== it.id) alias.set(it.id, kept.id);
  }
  for (const page of pages) {
    for (const region of page.regions) {
      if (alias.has(region.itemId)) region.itemId = alias.get(region.itemId);
    }
  }
  return items.filter((i) => keep.has(i.id));
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

      /**
       * **보이는 캔버스에는 가린 그림만 올라간다.**
       *
       * 예전에는 보이는 캔버스에 바로 그리고 렌더가 끝난 뒤에 가림띠를 칠했다.
       * pdf.js 는 조금씩 그려 나가므로, 그 사이 몇 프레임 동안 맨 아래 인적사항이
       * **그대로 보였다.** 쪽을 넘길 때마다 깜빡이며 드러났고 화면 녹화에도 남는다.
       *
       * 안 보이는 캔버스에 그리고, 거기에 가림띠까지 칠한 다음, 다 된 그림을
       * 한 번에 옮긴다. 보이는 쪽은 이전 쪽 → 가려진 새 쪽으로 바로 넘어간다.
       * (덤으로 처음의 흰 깜빡임도 없어진다 — 예전에는 canvas.width 를 대입하는
       * 순간 화면이 비워졌다.)
       */
      // 자리는 **먼저** 잡는다. 보이는 캔버스의 CSS 크기만 정하는 것이라
      // 픽셀은 건드리지 않는다 — 이걸 안 하면 렌더가 끝날 때까지 캔버스가
      // 기본 크기(300×150)로 서 있다가 쪽이 갑자기 커진다.
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const off = document.createElement("canvas");
      off.width = viewport.width * dpr;
      off.height = viewport.height * dpr;
      const octx = off.getContext("2d");
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      task = page.render({ canvasContext: octx, viewport });
      try {
        await task.promise;
        if (cancelled) return;
        if (mask) {
          const m = footerMask(viewport);
          octx.fillStyle = "#e9edf3";
          octx.fillRect(m.x, m.y, m.w, m.h);
          octx.fillStyle = "#8b95a1";
          octx.font = "10px Pretendard, sans-serif";
          octx.textAlign = "center";
          octx.fillText("인적사항 가림", m.x + m.w / 2, m.y + m.h / 2 + 3);
        }
        canvas.width = off.width;
        canvas.height = off.height;
        canvas.getContext("2d").drawImage(off, 0, 0);
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
              data-rid={r.rid}
              className={`rd-region${show ? " is-shown" : ""}${selected === r.rid ? " is-on" : ""}${flash === r.rid ? " is-flash" : ""}`}
              style={{
                left: `${r.rect.x * 100}%`, top: `${r.rect.y * 100}%`,
                width: `${r.rect.w * 100}%`, height: `${r.rect.h * 100}%`,
              }}
              aria-pressed={selected === r.rid}
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
      {/* 근거의 가운데 낱말은 알약으로 세운다. 따옴표로 감싸면 본문 글자와
          섞여 어느 말이 근거인지 한눈에 안 들어온다(탐구 피드와 같은 규칙). */}
      <div className="rd-why">
        <i aria-hidden="true" />
        <span>
          {why.lead}
          {why.term && <b className="rd-why-term">{why.term}</b>}
          {why.tail}
        </span>
      </div>
    </button>
  );
}

/* ── 리더 ───────────────────────────────────────────────── */
export function PdfReader({ docs = [], keywords = [], filename = "", mask = true, onMissing }) {
  const [doc, setDoc] = useState(null);
  const [err, setErr] = useState("");
  const [pages, setPages] = useState(null);
  const [spread, setSpread] = useState(0);
  const [single, setSingle] = useState(false);
  const [show, setShow] = useState(true);
  const [sel, setSel] = useState(null);      // 고른 구획
  // 옆 판을 열어 둘지. 구획을 고르면 열리고, 닫으면 책이 다시 가운데로 온다.
  const [panelOpen, setPanelOpen] = useState(false);
  // 처음 온 사람에게만 한 번. 봤다는 사실은 이 브라우저에 남긴다.
  const [coach, setCoach] = useState(() => {
    if (COACH_ALWAYS) return true;
    try { return localStorage.getItem(COACH_SEEN) !== "1"; } catch { return true; }
  });
  const [flash, setFlash] = useState("");
  const [fading, setFading] = useState(false);
  const [pageW, setPageW] = useState(420);
  // 쪽의 세로/가로 비. 쪽을 화면 높이에 맞추려면 이게 필요하다.
  const [aspect, setAspect] = useState(842 / 595);
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
      const vp = (await doc.getPage(1)).getViewport({ scale: 1 });
      if (!cancelled) {
        setAspect(vp.height / vp.width);
        setPages(scanned);
      }
    })();
    return () => { cancelled = true; };
  }, [doc, subjects]);

  // 19쪽을 훑는 데 3~4초. 그동안 아무 말이 없으면 멈춘 줄 안다.
  // showLoading 이 돌려주는 함수가 곧 정리 함수라 그대로 넘긴다.
  useEffect(() => {
    if (doc && pages) return undefined;
    return showLoading(doc ? "생기부를 읽는 중이에요…" : "생기부를 여는 중이에요…");
  }, [doc, pages]);

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
      const byWidth = (el.clientWidth - 96 - (per - 1) * 8) / per;
      // 세로도 맞춘다. 쪽이 화면보다 길면 세로 스크롤이 먼저 걸려서, 스크롤로
      // 쪽을 넘기려 해도 한 번 넘긴 뒤부터 먹히지 않는다(실제로 그랬다).
      const byHeight = (el.clientHeight - 120) / aspect;
      setPageW(Math.max(240, Math.min(560, Math.floor(Math.min(byWidth, byHeight)))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [single, pages, aspect]);

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

  // 스크롤로 쪽을 넘긴다. 책을 넘기는 것과 같은 손짓이라 화살표를 찾지 않아도 된다.
  // 트랙패드는 한 번 밀 때 이벤트가 수십 개 오므로, 한 번 넘긴 뒤에는 잠깐 쉰다.
  useEffect(() => {
    const el = stage.current;
    if (!el) return undefined;
    let cooling = false;
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) < 4) return;
      // 쪽이 화면보다 길면(모바일·확대) 세로 스크롤이 먼저다. 끝에 닿았을 때만 넘긴다.
      const room = el.scrollHeight - el.clientHeight;
      if (room > 8) {
        const atTop = el.scrollTop <= 0;
        const atEnd = el.scrollTop >= room - 1;
        if (!(e.deltaY > 0 ? atEnd : atTop)) return;
      }
      e.preventDefault();
      if (cooling) return;
      cooling = true;
      setTimeout(() => { cooling = false; }, 420);
      turn(e.deltaY > 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // `pages` 를 함께 본다. 읽는 동안에는 다른 화면을 그리므로 이 효과가 처음
    // 돌 때 stage 가 아직 없다 — 그때 한 번 붙이고 말면 스크롤이 죽는다.
  }, [turn, pages]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.tagName === "INPUT" || e.target?.tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight") turn(1);
      else if (e.key === "ArrowLeft") turn(-1);
      else if (e.key === "Escape") { setSel(null); setPanelOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn]);

  const dismissCoach = useCallback(() => {
    // 고치는 동안(COACH_ALWAYS)에는 닫지 않는다 — 문구를 계속 봐야 하니까.
    if (COACH_ALWAYS) return;
    setCoach(false);
    try { localStorage.setItem(COACH_SEEN, "1"); } catch { /* 사생활 보호 모드 */ }
  }, []);

  const pick = useCallback((r) => {
    dismissCoach();
    setSel((cur) => (cur === r.rid ? null : r.rid));
    setPanelOpen(true);
  }, [dismissCoach]);

  const jump = useCallback((item) => {
    if (!item.page) return;
    const nextSpread = Math.floor((item.page - 1) / step);
    setSpread(nextSpread);
    setSel(item.regionId || null);
    setPanelOpen(true);
    // 깜빡임 두 번. 이 왕복이 되는 순간 체감이 달라진다.
    setFlash("");
    setTimeout(() => {
      setFlash(item.regionId);
      // 한 구획이 쪽을 넘어 이어지면 조각이 여럿이다. 뛰어간 쪽의 조각을 찾는다.
      const el = document.querySelector(`[data-rid="${item.regionId}"]`);
      el?.scrollIntoView({ block: "center", behavior: reduce.current ? "auto" : "smooth" });
      setTimeout(() => setFlash(""), FLASH_MS * 2 + 40);
    }, 60);
  }, [step]);

  const pageRegions = useMemo(() => {
    if (!pages) return [];
    return shownNos.flatMap((n) => pages[n - 1]?.regions || []);
  }, [pages, shownNos.join(",")]);

  const selRegion = pageRegions.find((r) => r.rid === sel) || null;
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
        {/* 읽는 동안의 문구는 아래 알림이 맡는다. 여기서는 오류만 말한다. */}
        {err && <div className="rs-empty" style={{ color: "var(--danger)" }}>{err}</div>}
      </div>
    );
  }

  return (
    <div className="rd">
      <div className={`rd-body${panelOpen ? " is-open" : ""}`}>
        <div className="rd-stage" ref={stage}>
          {/* 처음 한 번만. 파란 띠가 눌리는 것인 줄 모르면 이 화면은 그냥 PDF
              뷰어다. 그렇다고 늘 띄워 두면 두 번째부터는 잔소리다 — 한 번 보고
              나면 다시 나오지 않는다. */}
          {coach && (COACH_ALWAYS || !panelOpen) && (
            <div className="rd-coach" role="status">
              <span className="rd-coach-dot" aria-hidden="true" />
              <div>
                <strong>파란 구획을 눌러 보세요</strong>
                <span>그 구획과 이어지는 다른 기록이 옆에 열립니다.</span>
              </div>
              <button type="button" onClick={dismissCoach}>알겠어요</button>
            </div>
          )}
          <div className={`rd-spread${fading ? " is-fading" : ""}`}>
            <ReaderPage
              doc={doc} pageNo={leftNo <= total ? leftNo : 0} width={pageW} mask={mask}
              regions={pages[leftNo - 1]?.regions || []}
              show={show} selected={sel} flash={flash} onPick={pick}
            />
            {!single && (
              <ReaderPage
                doc={doc} pageNo={rightNo <= total ? rightNo : 0} width={pageW} mask={mask}
                regions={pages[rightNo - 1]?.regions || []}
                show={show} selected={sel} flash={flash} onPick={pick}
              />
            )}
          </div>

          {/* 조작은 문서 아래에 떠 있는 알약 하나로. 위에 띠를 두면 읽는 자리가
              그만큼 줄고, 정작 자주 쓰는 것은 쪽 넘김 하나뿐이다. */}
          <div className="rd-controls-wrap">
          <div className="rd-controls">
            <button type="button" onClick={() => turn(-1)} disabled={spread <= 0} aria-label="이전 쪽">‹</button>
            <span>{shownNos.join("–")} / {total}</span>
            <button type="button" onClick={() => turn(1)} disabled={spread >= maxSpread} aria-label="다음 쪽">›</button>
            <i className="rd-controls-sep" aria-hidden="true" />
            <button
              type="button"
              className={`rd-controls-toggle${show ? " is-on" : ""}`}
              aria-pressed={show}
              onClick={() => setShow((v) => !v)}
            >
              구획 표시
            </button>
          </div>
          </div>
        </div>

        {panelOpen && (
        <aside className="rd-panel">
          <div className="rd-panel-head">
            <span className="rd-eyebrow">{selRegion ? "선택한 구획" : `${shownNos.join("–")}쪽`}</span>
            <h3>{selRegion ? selRegion.label : (pageRegions[0]?.label || "이 쪽")}</h3>
            <button
              type="button"
              className="rd-panel-x"
              onClick={() => { setSel(null); setPanelOpen(false); }}
              aria-label="닫기"
            >
              ×
            </button>
            {selRegion && (
              <button type="button" className="rd-back" onClick={() => setSel(null)}>
                {/* "이 쪽" 은 어느 쪽인지 안 말한다. 지금 보고 있는 쪽을 적는다. */}
                <NavIcon name="chevronLeft" size={14} /> {shownNos.join("–")}쪽 기록 모두 보기
              </button>
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
        )}
      </div>
    </div>
  );
}
