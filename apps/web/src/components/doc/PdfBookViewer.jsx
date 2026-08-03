/**
 * 보관된 생기부 PDF 를 책처럼 넘겨 보는 뷰어.
 *
 * 추출된 텍스트가 아니라 **원본 그대로**를 그린다. 표·서식·도장까지 학생이
 * 실제로 받은 문서 그대로 보이는 것이 이 화면의 목적이다.
 *
 * 렌더한 캔버스는 앞뒤 한 펼침면씩만 들고 있는다. 19쪽을 전부 고해상도로 쥐고
 * 있으면 수백 MB가 되어 탭이 죽는다.
 *
 * 하단 인적사항은 캔버스에 직접 칠해 가린다 (lib/pdfRegions 의 footerMask).
 * 화면에서 가리는 것일 뿐 원본은 그대로 보관된다 — 필요하면 원본 내려받기로
 * 확인할 수 있다.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { footerMask } from "../../lib/pdfRegions.js";
import { API_BASE, getToken } from "../../api/client.js";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const PAGE_W = 460; // 한 쪽의 화면 폭(px). 펼침면이면 두 배가 된다.

function PdfPage({ doc, pageNo, mask, side }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!doc || !pageNo) return undefined;
    let cancelled = false;
    let task;
    setReady(false);

    (async () => {
      const page = await doc.getPage(pageNo);
      if (cancelled) return;
      const raw = page.getViewport({ scale: 1 });
      const scale = PAGE_W / raw.width;
      const viewport = page.getViewport({ scale });
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
        setReady(true);
      } catch {
        /* 쪽을 넘기면 이전 렌더는 취소된다 — 정상 */
      }
    })();

    return () => {
      cancelled = true;
      task?.cancel?.();
      // 캔버스를 비워 메모리를 바로 놓아준다
      const c = ref.current;
      if (c) { c.width = 0; c.height = 0; }
    };
  }, [doc, pageNo, mask]);

  if (!pageNo) return <div className={`book-page book-${side} is-blank`} aria-hidden="true" />;
  return (
    <div className={`book-page book-${side} is-pdf`}>
      <canvas ref={ref} className={ready ? "" : "is-loading"} />
      <span className="book-page-no">{pageNo}</span>
    </div>
  );
}

export function PdfBookViewer({ pageCount, mask = true, onMissing }) {
  const [doc, setDoc] = useState(null);
  const [err, setErr] = useState("");
  const [spread, setSpread] = useState(0);
  const [single, setSingle] = useState(false);
  const [turning, setTurning] = useState(null);
  const reduce = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let loaded;
    (async () => {
      try {
        // 인증이 필요한 엔드포인트라 fetch 로 받아 바이트로 넘긴다
        const res = await fetch(`${API_BASE}/v1/students/me/documents/file`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.status === 404) { onMissing?.(); return; }
        if (!res.ok) throw new Error(`원본을 불러오지 못했습니다 (HTTP ${res.status})`);
        const buf = await res.arrayBuffer();
        loaded = await pdfjs.getDocument({ data: buf }).promise;
        if (cancelled) { loaded.destroy?.(); return; }
        setDoc(loaded);
      } catch (e) {
        if (!cancelled) setErr(e.message);
      }
    })();
    return () => { cancelled = true; loaded?.destroy?.(); };
  }, [onMissing]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduce.current = mq.matches;
    const onMq = (e) => { reduce.current = e.matches; };
    mq.addEventListener("change", onMq);
    const narrow = window.matchMedia("(max-width: 1000px)");
    setSingle(narrow.matches);
    const onNarrow = (e) => setSingle(e.matches);
    narrow.addEventListener("change", onNarrow);
    return () => { mq.removeEventListener("change", onMq); narrow.removeEventListener("change", onNarrow); };
  }, []);

  const total = doc?.numPages || pageCount || 0;
  const step = single ? 1 : 2;
  const maxSpread = Math.max(0, Math.ceil(total / step) - 1);

  const go = useCallback((dir) => {
    setSpread((cur) => {
      const next = Math.min(maxSpread, Math.max(0, cur + dir));
      if (next === cur) return cur;
      if (!reduce.current) {
        setTurning(dir > 0 ? "next" : "prev");
        setTimeout(() => setTurning(null), 460);
      }
      return next;
    });
  }, [maxSpread]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (err) return <div className="rs-empty" style={{ color: "var(--danger)" }}>{err}</div>;
  if (!doc) return <div className="rs-empty">생기부를 여는 중…</div>;

  const leftNo = spread * step + 1;
  const rightNo = single ? null : leftNo + 1;

  return (
    <div className="book-viewer">
      <div className={`book-stage${single ? " is-single" : ""}${turning ? ` is-${turning}` : ""}`}>
        <button type="button" className="book-arrow book-arrow-prev" onClick={() => go(-1)}
          disabled={spread <= 0} aria-label="이전 쪽">‹</button>

        <div className="book-spread is-pdf">
          <PdfPage doc={doc} pageNo={leftNo <= total ? leftNo : null} mask={mask} side="left" />
          {!single && <PdfPage doc={doc} pageNo={rightNo <= total ? rightNo : null} mask={mask} side="right" />}
        </div>

        <button type="button" className="book-arrow book-arrow-next" onClick={() => go(1)}
          disabled={spread >= maxSpread} aria-label="다음 쪽">›</button>
      </div>

      <div className="book-foot">
        <span className="book-progress">
          {leftNo}{!single && rightNo <= total ? `–${rightNo}` : ""} / {total}쪽
        </span>
        <input className="book-slider" type="range" min={0} max={maxSpread} value={spread}
          onChange={(e) => setSpread(Number(e.target.value))} aria-label="쪽 이동" />
      </div>
    </div>
  );
}
