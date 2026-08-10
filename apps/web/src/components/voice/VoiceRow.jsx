/**
 * 녹음 한 줄. 최근 활동 한 줄(RecentActivityItem)과 같은 뼈대다.
 *
 *   [아이콘] 이름                                 시간  ⋯
 *            상태 · 길이 · 참여자
 *
 * 지우기가 ⋯ 안에 있는 까닭: 목록에 늘 떠 있는 ✕ 는 누르려던 것이 아닐 때에도
 * 손에 걸린다. 되돌릴 수 없는 일은 한 겹 안쪽에 두고, 누르면 그 자리에서
 * 한 번 더 물어본다.
 */

import { useEffect, useRef, useState } from "react";
import { NavIcon } from "../NavIcon.jsx";
import TDS from "../../theme/tokens.js";

export function VoiceRow({ session, when, onOpen, onRename, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const menuRef = useRef(null);
  const todo = session.st === "검토 대기";

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => { if (!menuRef.current?.contains(e.target)) { setMenuOpen(false); setConfirming(false); } };
    const onKey = (e) => { if (e.key === "Escape") { setMenuOpen(false); setConfirming(false); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <li className="ra-row">
      <button type="button" className="ra-item" onClick={onOpen} title={session.t}>
        <span className={`ra-ic${todo ? " is-todo" : ""}`}>
          <NavIcon name="voice" size={16} color={todo ? TDS.warning : TDS.primary} />
        </span>
        <span className="ra-body">
          <span className="ra-line">
            <span className="ra-title">{session.t}</span>
            <span className="ra-time">{when}</span>
          </span>
          <span className="ra-sub">
            <span className={`ra-badge${todo ? " is-todo" : ""}`}>{session.st}</span>
            <span className="ra-sub-text">{session.dur} · 참여자 {session.ppl}명</span>
          </span>
        </span>
      </button>

      <div className="ra-more-wrap" ref={menuRef}>
        <button
          type="button"
          className="ra-more"
          aria-label={`‘${session.t}’ 더보기`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => { setMenuOpen((v) => !v); setConfirming(false); }}
        >
          ⋯
        </button>
        {menuOpen && (
          <div className="ra-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onRename(); }}>
              이름 바꾸기
            </button>
            {confirming ? (
              <div className="ra-confirm">
                {/* 무엇이 사라지는지 적는다. 소리는 애초에 저장하지 않으므로
                    여기서 사라지는 것은 옮겨 적은 글이다. */}
                <p>옮겨 적은 글이 사라집니다. 되돌릴 수 없습니다.</p>
                <div className="ra-confirm-btns">
                  <button type="button" onClick={() => setConfirming(false)}>취소</button>
                  <button type="button" className="is-danger"
                    onClick={() => { setMenuOpen(false); setConfirming(false); onDelete(); }}>
                    삭제
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" role="menuitem" className="is-danger" onClick={() => setConfirming(true)}>
                삭제
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
