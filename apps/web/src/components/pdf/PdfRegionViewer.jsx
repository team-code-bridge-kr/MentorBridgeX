/**
 * 생기부 PDF 구획 뷰어.
 *
 * 페이지를 캔버스에 그리고, 인식한 구획을 **절대 배치된 button** 으로 얹는다.
 * 박스를 캔버스에 그리지 않는 이유: hover·포커스·키보드 조작이 공짜로 따라온다.
 *
 * 확대는 CSS transform 이 아니라 **그 영역만 고배율로 다시 렌더**한다.
 * transform 으로 늘리면 원본 픽셀이 뭉개져서, 정작 확인하려는 글자가 흐려진다.
 * devicePixelRatio 까지 곱해야 레티나에서 선명하다.
 *
 * PDF 는 서버에 올리지 않은 상태에서 브라우저 안에서만 열린다. 파일을 그대로
 * 두고 화면에서만 보는 것이라, 인적사항 마스크도 **캔버스에 직접 칠한다** —
 * div 로 덮으면 개발자도구에서 걷어낼 수 있고 이미지로 내보낼 때 빠진다.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { buildRegions, findAnchors, footerMask, toLines } from "../../lib/pdfRegions.js";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const BASE_SCALE = 1.4;
const ZOOM = 3;
// 인식 기대치 — 이보다 적으면 "일부를 못 찾았다"고 알린다 (8개 영역 기준)
const EXPECTED_REGIONS = 8;

function paintMask(ctx, viewport) {
  const m = footerMask(viewport);
  ctx.save();
  ctx.fillStyle = "#e9edf3";
  ctx.fillRect(m.x, m.y, m.w, m.h);
  ctx.fillStyle = "#8b95a1";
  ctx.font = "12px Pretendard, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("인적사항 가림", m.x + m.w / 2, m.y + m.h / 2 + 4);
  ctx.restore();
}

export function PdfRegionViewer({ file, onRegions }) {
  const canvasRef = useRef(null);
  const docRef = useRef(null);
  const [state, setState] = useState({ status: "loading", pageCount: 0 });
  const [pageNo, setPageNo] = useState(1);
  const [regions, setRegions] = useState([]);
  const [active, setActive] = useState(null);
  const [zoomed, setZoomed] = useState(null);
  const zoomCanvasRef = useRef(null);

  // ── 1. 파일 열기 + 전 페이지 구획 인식 ──────────────────────
  useEffect(() => {
    if (!file) return undefined;
    let cancelled = false;
    let doc;

    (async () => {
      try {
        const buf = await file.arrayBuffer();
        doc = await pdfjs.getDocument({ data: buf }).promise;
        if (cancelled) return;
        docRef.current = doc;

        const pages = [];
        for (let i = 1; i <= doc.numPages; i += 1) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: BASE_SCALE });
          const lines = toLines(await page.getTextContent(), viewport, pdfjs);
          if (!lines.length && i === 1) {
            // 텍스트 레이어가 없다 = 스캔본. 구획 인식을 시도해봐야 헛수고다.
            setState({ status: "scanned", pageCount: doc.numPages });
            return;
          }
          pages.push({
            index: i,
            height: viewport.height,
            width: viewport.width,
            anchors: findAnchors(lines, viewport.width),
          });
        }
        if (cancelled) return;
        const found = buildRegions(pages);
        setRegions(found);
        setState({ status: "ready", pageCount: doc.numPages });
        onRegions?.(found);
      } catch (e) {
        if (!cancelled) setState({ status: "error", message: e.message, pageCount: 0 });
      }
    })();

    return () => {
      cancelled = true;
      // 캔버스를 붙들고 있으면 20쪽 × 고해상도로 수백 MB가 된다
      doc?.destroy?.();
      docRef.current = null;
    };
  }, [file, onRegions]);

  // ── 2. 현재 페이지 렌더 ────────────────────────────────────
  useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || state.status !== "ready") return undefined;
    let cancelled = false;
    let task;

    (async () => {
      const page = await doc.getPage(pageNo);
      if (cancelled) return;
      const viewport = page.getViewport({ scale: BASE_SCALE });
      const dpr = window.devicePixelRatio || 1;
      // 자리는 먼저 잡는다(CSS 크기만 — 픽셀은 안 건드린다).
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      // 보이는 캔버스에는 **가린 그림만** 올린다 — 까닭은 PdfReader 의 같은 자리 주석에.
      const off = document.createElement("canvas");
      off.width = viewport.width * dpr;
      off.height = viewport.height * dpr;
      const octx = off.getContext("2d");
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      task = page.render({ canvasContext: octx, viewport });
      try {
        await task.promise;
        if (cancelled) return;
        paintMask(octx, viewport);
        canvas.width = off.width;
        canvas.height = off.height;
        canvas.getContext("2d").drawImage(off, 0, 0);
      } catch {
        /* 페이지를 넘기면 이전 렌더는 취소된다 — 정상 */
      }
    })();

    return () => { cancelled = true; task?.cancel?.(); };
  }, [pageNo, state.status]);

  // ── 3. 구획 확대 — 그 부분만 고배율 재렌더 ─────────────────
  const openZoom = useCallback(
    async (region, slice) => {
      const doc = docRef.current;
      if (!doc) return;
      setZoomed({ region, slice, loading: true });
      const page = await doc.getPage(slice.index);
      const scale = BASE_SCALE * ZOOM * (window.devicePixelRatio || 1);
      const viewport = page.getViewport({
        scale,
        offsetX: -slice.yStart * 0, // x 는 전체 폭을 쓴다 (표가 페이지 폭을 다 쓴다)
        offsetY: -slice.yStart * ZOOM * (window.devicePixelRatio || 1),
      });
      const base = page.getViewport({ scale: BASE_SCALE });
      const canvas = zoomCanvasRef.current;
      if (!canvas) return;
      const h = Math.max(40, slice.yEnd - slice.yStart);
      const z = ZOOM * (window.devicePixelRatio || 1);
      // 확대본도 안 보이는 곳에서 그린 뒤 옮긴다. 여기는 세 배로 키운 그림이라
      // 렌더가 더 오래 걸리고, 그동안 인적사항이 **더 크게** 드러난다.
      const off = document.createElement("canvas");
      off.width = base.width * z;
      off.height = h * z;
      const octx = off.getContext("2d");
      await page.render({ canvasContext: octx, viewport }).promise;
      // 확대본에도 마스크는 남아야 한다 — 원본 좌표를 확대 배율로 옮겨 칠한다
      const m = footerMask(base);
      octx.fillStyle = "#e9edf3";
      octx.fillRect(0, (m.y - slice.yStart) * z, off.width, m.h * z);
      canvas.width = off.width;
      canvas.height = off.height;
      canvas.style.width = "100%";
      canvas.getContext("2d").drawImage(off, 0, 0);
      setZoomed({ region, slice, loading: false });
    },
    []
  );

  useEffect(() => {
    if (!zoomed) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setZoomed(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zoomed]);

  if (state.status === "loading") return <div className="rs-empty" />;
  if (state.status === "error")
    return <div className="rs-empty" style={{ color: "var(--danger)" }}>PDF 를 열지 못했습니다. {state.message}</div>;
  if (state.status === "scanned")
    return (
      <div className="pdf-notice pdf-notice-warn">
        <strong>스캔본으로 보입니다.</strong>
        <span>글자 정보가 없어 구획을 자동으로 찾을 수 없습니다. 내용을 직접 입력해 주세요.</span>
      </div>
    );

  const onThisPage = regions
    .map((r) => ({ region: r, slice: r.pages.find((p) => p.index === pageNo) }))
    .filter((x) => x.slice);

  return (
    <div className="pdf-viewer">
      <div className="pdf-bar">
        <span className={`pdf-count${regions.length < EXPECTED_REGIONS ? " warn" : ""}`}>
          {regions.length}개 영역 인식됨
        </span>
        <span className="pdf-pager">
          <button type="button" className="rs-save" disabled={pageNo <= 1}
            onClick={() => setPageNo((n) => Math.max(1, n - 1))}>이전</button>
          <span className="pdf-page-no">{pageNo} / {state.pageCount}</span>
          <button type="button" className="rs-save" disabled={pageNo >= state.pageCount}
            onClick={() => setPageNo((n) => Math.min(state.pageCount, n + 1))}>다음</button>
        </span>
      </div>

      {regions.length < EXPECTED_REGIONS && (
        <div className="pdf-notice">
          일부 영역을 찾지 못했어요. 학교마다 양식이 조금씩 달라 생기는 일입니다 —
          업로드한 뒤 <strong>파싱 결과 검토</strong>에서 직접 고칠 수 있습니다.
        </div>
      )}

      <div className="pdf-stage">
        <div className="pdf-page-wrap">
          <canvas ref={canvasRef} className="pdf-canvas" />
          <div className="pdf-overlay">
            {onThisPage.map(({ region, slice }, i) => (
              <button
                key={`${region.key}-${i}`}
                type="button"
                className="pdf-region"
                aria-current={active === `${region.key}-${i}` ? "true" : undefined}
                style={{
                  top: slice.yStart,
                  height: Math.max(18, slice.yEnd - slice.yStart),
                }}
                onMouseEnter={() => setActive(`${region.key}-${i}`)}
                onFocus={() => setActive(`${region.key}-${i}`)}
                onClick={() => openZoom(region, slice)}
                title={`${region.label} 확대해서 보기`}
              >
                <span className="pdf-region-tag">{region.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {zoomed && (
        <div className="pdf-zoom" role="dialog" aria-modal="true" aria-label={`${zoomed.region.label} 확대`}
          onClick={(e) => { if (e.target === e.currentTarget) setZoomed(null); }}>
          <div className="pdf-zoom-box">
            <div className="pdf-zoom-hdr">
              <strong>{zoomed.region.label}</strong>
              <span className="feed-meta">
                {zoomed.slice.index}쪽
                {zoomed.region.pages.length > 1 && ` · ${zoomed.region.pages.length}쪽에 걸침`}
              </span>
              <button type="button" className="rs-save" onClick={() => setZoomed(null)}>닫기 (Esc)</button>
            </div>
            <div className="pdf-zoom-body">
              <canvas ref={zoomCanvasRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
