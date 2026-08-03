/**
 * 팝오버 / 드로어 — 프로젝트에 공통 오버레이가 없어서 여기서 처음 만든다.
 *
 * 두 컴포넌트가 공유하는 규칙:
 * - 바깥 클릭·Esc 로 닫힌다
 * - 열리면 안쪽 첫 요소로 포커스가 가고, Tab 이 밖으로 새지 않는다(focus trap)
 * - 닫히면 열었던 버튼으로 포커스가 돌아간다
 *
 * 이 세 가지를 각 화면에서 따로 구현하면 반드시 한두 개를 빠뜨린다.
 */

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function useDismiss(open, onClose, boxRef, anchorRef) {
  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;

    const onKey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab") return;
      const items = boxRef.current?.querySelectorAll(FOCUSABLE);
      if (!items?.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    const onDown = (e) => {
      if (boxRef.current?.contains(e.target)) return;
      if (anchorRef?.current?.contains(e.target)) return; // 여는 버튼을 다시 누른 경우
      onClose();
    };

    document.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onDown);
    // 열리자마자 안쪽으로 포커스를 옮긴다 — 키보드 사용자가 바로 조작할 수 있게
    const timer = setTimeout(() => {
      boxRef.current?.querySelector(FOCUSABLE)?.focus();
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onDown);
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [open, onClose, boxRef, anchorRef]);
}

/** 버튼 아래에 붙는 작은 패널. 모바일에서는 바텀시트로 바뀐다(CSS). */
export function Popover({ open, onClose, anchorRef, label, children, align = "left" }) {
  const boxRef = useRef(null);
  useDismiss(open, onClose, boxRef, anchorRef);
  if (!open) return null;
  return (
    <>
      {/* 모바일 바텀시트일 때만 보이는 배경 — 데스크톱에서는 투명하다 */}
      <div className="pop-scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={boxRef}
        className={`pop pop-${align}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </div>
    </>
  );
}

/** 오른쪽에서 밀려 들어오는 패널. */
export function Drawer({ open, onClose, title, children, footer }) {
  const boxRef = useRef(null);
  useDismiss(open, onClose, boxRef, null);
  if (!open) return null;
  return (
    <div className="drawer-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside ref={boxRef} className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <header className="drawer-hdr">
          <h2 className="drawer-title">{title}</h2>
          <button type="button" className="drawer-x" onClick={onClose} aria-label="닫기">×</button>
        </header>
        <div className="drawer-body">{children}</div>
        {footer && <footer className="drawer-foot">{footer}</footer>}
      </aside>
    </div>
  );
}
