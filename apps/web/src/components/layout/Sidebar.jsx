/**
 * 사이드바.
 *
 * 기본은 접힌 아이콘 레일이다. 커서를 올리면 펼쳐지고, **그대로 고정된다** —
 * 커서가 벗어나자마자 닫히면 메뉴를 고르는 도중에 사라져서 쓸 수가 없다.
 * 닫는 방법은 세 가지: « 버튼, Esc, 바깥 클릭. 고정 상태는 새로고침해도 남는다.
 *
 * 펼쳐진 사이드바는 본문 위에 겹친다(절대배치). 본문을 밀지 않으므로 열고 닫아도
 * 화면이 다시 계산되지 않는다.
 *
 * 구조: 로고+접기 / 메뉴 / 최근 작업 / 프로필+유틸(알림·통계·설정·로그아웃)
 * 핵심 콘텐츠보다 강하게 보이지 않도록 밝은 배경과 얇은 구분선만 쓴다.
 */

import { useEffect, useRef, useState } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { Av } from "../ui.jsx";
import { NavIcon } from "../NavIcon.jsx";
import { S_UTIL } from "../../nav/menus.js";
import api from "../../api/index.js";
import logoBlack from "../../assets/brand/TeamCodeBridge_Logo_Black_Web.png";
import logoWhite from "../../assets/brand/TeamCodeBridge_Logo_White_Web.png";

const PIN_KEY = "mbx_sidebar_pinned";
// 커서가 스치기만 해도 열리면 성가시다 — 잠깐 머물러야 연다
const OPEN_DELAY_MS = 140;

export function Sidebar({ nav, active, onNav, role, dark }) {
  const { state, actions } = useStore();
  const user = state.session?.user;
  const displayName = user?.name || (dark ? "시스템 관리자" : "게스트");
  const displayEmail = user?.email || "—";
  const unread = (state.notifications || []).filter((n) => !n.read).length;

  // 펼침 상태는 새로고침해도 유지한다
  const [open, setOpen] = useState(() => localStorage.getItem(PIN_KEY) === "open");
  const railRef = useRef(null);
  const enterTimer = useRef(null);

  useEffect(() => {
    localStorage.setItem(PIN_KEY, open ? "open" : "rail");
  }, [open]);

  // 열려 있는 동안만 바깥 클릭·Esc 를 듣는다
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!railRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => () => clearTimeout(enterTimer.current), []);

  const onEnter = () => {
    if (open) return;
    clearTimeout(enterTimer.current);
    enterTimer.current = setTimeout(() => setOpen(true), OPEN_DELAY_MS);
  };
  const onLeave = () => clearTimeout(enterTimer.current); // 이미 열렸으면 그대로 둔다

  // 최근 작업 — MBX 엔 프로젝트 개념이 없어 최근 AI 대화를 쓴다
  const [recent, setRecent] = useState([]);
  useEffect(() => {
    if (dark || role === "교사") return;
    let cancelled = false;
    api.assistant
      .conversations(5)
      .then((items) => { if (!cancelled) setRecent(items); })
      .catch(() => { /* 사이드바 보조 정보라 조용히 실패시킨다 */ });
    return () => { cancelled = true; };
  }, [dark, role, state.session?.token]);

  const go = (item) => {
    setOpen(false); // 고른 화면을 사이드바가 덮고 있으면 안 된다
    if (item.action === "newChat") {
      // 대시보드로 이동하면서 대화를 초기화한다
      window.dispatchEvent(new CustomEvent("mbx:new-chat"));
      onNav("S05");
      return;
    }
    onNav(item.id);
  };

  return (
    <div
      ref={railRef}
      className={`sb-rail${open ? " sb-open" : ""}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div className={`sidebar sb-${dark ? "dark" : "light"}`}>
        <div className="sb-logo">
          <img
            className="sb-logo-icon"
            src={dark ? logoWhite : logoBlack}
            alt="Team Code Bridge"
          />
          <span className="sb-logo-text sb-fade">MentorBridgeX</span>
          <button
            type="button"
            className="sb-collapse sb-fade"
            aria-label="사이드바 접기"
            title="사이드바 접기 (Esc)"
            aria-expanded={open}
            onClick={() => setOpen(false)}
          >
            «
          </button>
        </div>

        <div className="sb-section">
          {nav.map((n) => {
            const isActive = active === n.id;
            const stroke = isActive
              ? (dark ? TDS.blue400 : TDS.blue500)
              : (dark ? "#7c8aa3" : "#6b7a90");
            return (
              <div
                key={n.id}
                className={`sb-item${isActive ? " active" : ""}`}
                onClick={() => go(n)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(n); } }}
                role="button"
                tabIndex={0}
                aria-current={isActive ? "page" : undefined}
                title={n.label}
              >
                <span className="sb-icon" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <NavIcon name={n.icon} size="100%" color={stroke} />
                </span>
                <span className="sb-label sb-fade">{n.label}</span>
              </div>
            );
          })}

          {recent.length > 0 && (
            <div className="sb-recent sb-fade">
              <div className="sb-recent-hdr">최근 작업</div>
              {recent.slice(0, 5).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="sb-recent-item"
                  title={c.title}
                  onClick={() => {
                    setOpen(false);
                    window.dispatchEvent(
                      new CustomEvent("mbx:resume-chat", { detail: { id: c.id } })
                    );
                    onNav("S05");
                  }}
                >
                  <span className="sb-recent-title">{c.title}</span>
                  <span className="sb-recent-time">{ago(c.updated_at)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="sb-profile">
          <Av name={displayName || "?"} src={user?.picture} size="sm" />
          <div className="sb-pmeta sb-fade" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="sb-pname">{displayName}</span>
              <span className="sb-chip">{role}</span>
            </div>
            <div className="sb-pemail">{displayEmail}</div>
          </div>
        </div>

        <div className="sb-util sb-fade">
          {!dark && S_UTIL.map((u) => (
            <button
              key={u.id}
              type="button"
              className={`sb-util-btn${active === u.id ? " active" : ""}`}
              onClick={() => { setOpen(false); onNav(u.id); }}
              aria-label={u.label}
              title={u.label}
            >
              <NavIcon name={u.icon} size={16} color={dark ? "#7c8aa3" : "#6b7a90"} />
              {u.badge === "notifications" && unread > 0 && (
                <span className="sb-util-dot" aria-label={`읽지 않은 알림 ${unread}개`} />
              )}
            </button>
          ))}
          <button
            type="button"
            className="sb-util-btn"
            aria-label="로그아웃"
            title="로그아웃"
            onClick={() => actions.signOut()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke={dark ? "#7c8aa3" : "#8b95a1"} strokeWidth="1.7"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" /><path d="M21 12H9" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function ago(iso) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  if (ms < 3_600_000) return `${Math.max(1, Math.floor(ms / 60_000))}분`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}시간`;
  return `${Math.floor(ms / 86_400_000)}일`;
}

/* ──────────────────────────────────────────────────────────────
   HEADER
────────────────────────────────────────────────────────────── */
