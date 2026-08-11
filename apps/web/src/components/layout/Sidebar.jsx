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
import { RecentActivity, SIDEBAR_LIMIT } from "../sidebar/RecentActivity.jsx";
import { useRecentActivity } from "../../hooks/useRecentActivity.js";
import { activityDetailRoute, restoreActivity } from "../../lib/activityRestore.js";
import mbxLogo from "../../assets/brand/mbx_logo.png";

const PIN_KEY = "mbx_sidebar_pinned";
// 커서가 스치기만 해도 열리면 성가시다 — 잠깐 머물러야 연다
const OPEN_DELAY_MS = 140;

export function Sidebar({ nav, active, current, onNav, role, dark }) {
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

  /**
   * 최근 활동 — 대화·기사·그래프·피드백·문서·양식·음성을 한 목록으로.
   *
   * 학생 화면에서만 쓴다(교사·관리자는 탐구 흐름이 없다). 사이드바를 여닫을
   * 때마다 다시 부르지 않는다 — 목록이 바뀌었을 때만(useRecentActivity 안의
   * mbx:activity-changed) 다시 받는다.
   */
  const showActivity = !dark && role !== "교사";
  const [kind, setKind] = useState("all");
  const [query, setQuery] = useState("");
  const activity = useRecentActivity({
    limit: SIDEBAR_LIMIT,
    kind,
    q: query,
    enabled: showActivity,
  });

  // 지금 열려 있는 활동 — 대시보드가 대화를 열 때마다 알려준다
  const [activeConversation, setActiveConversation] = useState(null);
  useEffect(() => {
    const onActive = (e) => setActiveConversation(e.detail?.id || null);
    window.addEventListener("mbx:active-conversation", onActive);
    return () => window.removeEventListener("mbx:active-conversation", onActive);
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

          {showActivity && (
            <>
              {/* 접힌 레일에서는 목록을 감추고 아이콘만 남긴다. 누르면 사이드바가
                  펼쳐진다 — 떠 있는 두 번째 패널을 새로 열지 않는다. */}
              <button
                type="button"
                className="sb-item sb-rail-only"
                onClick={() => {
                  // 좁은 화면에서는 사이드바가 가로 막대라 목록이 들어갈 자리가
                  // 없다. 두 번째 서랍을 새로 열지 않고 활동 기록 화면으로 보낸다.
                  if (window.matchMedia("(max-width: 768px)").matches) {
                    close();
                    onNav("S44");
                    return;
                  }
                  setOpen(true);
                }}
                title="최근 활동"
                aria-label="최근 활동"
              >
                <span className="sb-icon" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <NavIcon name="history" size="100%" color={dark ? "#7c8aa3" : "#6b7a90"} />
                </span>
              </button>

              <RecentActivity
                items={activity.items}
                total={activity.total}
                loading={activity.loading}
                error={activity.error}
                activeId={activeConversation ? `conv:${activeConversation}` : null}
                kind={kind}
                onKindChange={setKind}
                query={query}
                onQueryChange={setQuery}
                onReload={activity.reload}
                onOpen={(item) => { close(); restoreActivity(item, onNav); }}
                onRename={(item, title) => activity.update(item.id, { title }).catch((e) =>
                  actions.toast("error", e.message || "이름을 바꾸지 못했습니다.")
                )}
                onTogglePin={(item) =>
                  activity.update(item.id, { pinned: !item.pinned }).catch((e) =>
                    actions.toast("error", e.message || "고정하지 못했습니다.")
                  )
                }
                onDelete={(item, deleteSource) =>
                  activity
                    .remove(item.id, { deleteSource })
                    .catch((e) => actions.toast("error", e.message || "삭제하지 못했습니다."))
                }
                onDetail={(item) => {
                  const route = activityDetailRoute(item);
                  if (route) { close(); onNav(route); }
                }}
                onViewAll={() => { close(); onNav("S44"); }}
              />
            </>
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

        {/* 하단 유틸. 다섯이 한 줄에 서 있으므로 생김새가 하나여야 한다 —
            색은 CSS 한 곳(.sb-util-btn)에서 정하고 아이콘은 그것을 물려받는다
            (currentColor). 예전에는 넷은 NavIcon, 로그아웃만 손으로 그린 svg
            였는데 색이 한 칸 흐려서 저 혼자 꺼져 있는 것처럼 보였다. */}
        <div className="sb-util sb-fade">
          {!dark && S_UTIL.map((u) => (
            <button
              key={u.id}
              type="button"
              /* 위 목록이 이미 불을 켰으면 여기는 켜지 않는다 — 교사 메뉴에는
                 알림·설정이 위에도 있어서 둘 다 켜지면 어느 쪽이 지금인지
                 알 수 없다. */
              className={`sb-util-btn${!active && current === u.id ? " active" : ""}`}
              aria-current={!active && current === u.id ? "page" : undefined}
              onClick={() => { close(); onNav(u.id); }}
              aria-label={u.label}
              title={u.label}
            >
              <NavIcon name={u.icon} size={16} color="currentColor" />
              {u.badge === "notifications" && unread > 0 && (
                <span className="sb-util-dot" aria-label={`읽지 않은 알림 ${unread}개`} />
              )}
            </button>
          ))}
          {/* 나가기는 오른쪽 끝에 떨어뜨린다. 옮겨 다니는 단추들 사이에 끼어
              있으면 화면 하나 여는 줄 알고 누른다. */}
          <button
            type="button"
            className="sb-util-btn sb-util-out"
            aria-label="로그아웃"
            title="로그아웃"
            onClick={() => actions.signOut()}
          >
            <NavIcon name="logout" size={16} color="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
}


/* ──────────────────────────────────────────────────────────────
   HEADER
────────────────────────────────────────────────────────────── */
