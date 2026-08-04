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
import mbxLogo from "../../assets/brand/mbx_logo.png";

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
  // 방금 사용자가 직접 닫았다는 표시. 커서가 레일 위에 있는 채로 닫으면
  // 곧바로 다시 열려서 "닫히지 않는" 것처럼 보인다. 커서가 한 번 벗어날
  // 때까지 자동 열기를 쉰다.
  const holdClosed = useRef(false);

  /** 사용자가 직접 닫는 경우(« / Esc / 바깥 클릭 / 메뉴 선택). */
  const close = () => {
    clearTimeout(enterTimer.current);
    enterTimer.current = null;
    // 커서가 레일 밖이면 어차피 mouseenter 가 새로 오므로 잠글 필요가 없다
    holdClosed.current = !!railRef.current?.matches(":hover");
    setOpen(false);
  };

  useEffect(() => {
    localStorage.setItem(PIN_KEY, open ? "open" : "rail");
  }, [open]);

  // 열려 있는 동안만 바깥 클릭·Esc 를 듣는다
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!railRef.current?.contains(e.target)) close();
    };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => () => clearTimeout(enterTimer.current), []);

  // mouseenter 만으로는 부족하다: 사이드바가 닫히면서 폭이 줄어도 커서가
  // 그대로면 브라우저는 mouseenter 를 다시 쏘지 않는다. 그래서 그 자리에서
  // 마우스를 움직여도 안 열리는 "씹힘"이 생긴다. mousemove 로도 받는다.
  const onHover = () => {
    if (open || holdClosed.current || enterTimer.current) return;
    enterTimer.current = setTimeout(() => {
      enterTimer.current = null;
      setOpen(true);
    }, OPEN_DELAY_MS);
  };
  const onLeave = () => {
    clearTimeout(enterTimer.current);
    enterTimer.current = null;
    holdClosed.current = false; // 벗어났으니 다시 hover 로 열 수 있다
  };

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

  // 대시보드에서 대화 이름을 바꾸면 여기 목록도 같은 이름이어야 한다.
  // 이 목록만 따로 받아 오므로, 다시 받지 말고 알림만 받아 고친다.
  useEffect(() => {
    const onRenamed = (e) => {
      const { id, title } = e.detail || {};
      if (!id) return;
      setRecent((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    };
    window.addEventListener("mbx:convo-renamed", onRenamed);
    return () => window.removeEventListener("mbx:convo-renamed", onRenamed);
  }, []);

  const go = (item) => {
    close(); // 고른 화면을 사이드바가 덮고 있으면 안 된다
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
      onMouseEnter={onHover}
      onMouseMove={onHover}
      onMouseLeave={onLeave}
    >
      <div className={`sidebar sb-${dark ? "dark" : "light"}`}>
        <div className="sb-logo">
          {/* 로고 자체가 어두운 배경을 품은 그림이라 밝은/어두운 레일 양쪽에서
              같은 파일을 쓴다. 앱 아이콘처럼 모서리만 둥글린다. */}
          <img className="sb-logo-icon" src={mbxLogo} alt="팀코드브릿지 MBX" />
          {/* 팀 이름은 진하게, 제품 이름은 한 단계 옅게 — 팀코드브릿지의 다른
              제품(Arena 등)과 같은 짜임이다. 스크린리더에는 로고 alt 로 이미
              같은 문장이 읽히므로 여기서는 장식으로 둔다. */}
          <span className="sb-logo-text sb-fade" aria-hidden="true">
            팀코드브릿지 <span className="sb-logo-product">MBX</span>
          </span>
          <button
            type="button"
            className="sb-collapse sb-fade"
            aria-label="사이드바 접기"
            title="사이드바 접기 (Esc)"
            aria-expanded={open}
            onClick={close}
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
                    close();
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
              onClick={() => { close(); onNav(u.id); }}
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
