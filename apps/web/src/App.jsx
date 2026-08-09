import { useState, useEffect, useCallback, useRef } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { StoreProvider, useStore } from "./store/StoreProvider.jsx";
import { Toast } from "./components/Toast.jsx";
import { Sidebar } from "./components/layout/Sidebar.jsx";
import { GlobalHeader } from "./components/layout/GlobalHeader.jsx";
import { ScreenPicker } from "./components/ScreenPicker.jsx";
import { VoiceDock } from "./components/voice/VoiceDock.jsx";
import { LoadingDock } from "./components/LoadingDock.jsx";
import { renderScreen } from "./screens/index.jsx";
import { S_NAV, T_NAV, A_NAV, TITLES, NO_HDR, NAV_ALIAS,
         SHARED_SCREENS, getLayout } from "./nav/menus.js";
import {
  ONBOARDING_SCREEN,
  PUBLIC_SCREENS,
  screenToPath,
  pathToScreen,
  homeScreenForRole,
} from "./nav/routes.js";
import TDS from "./theme/tokens.js";
import { TFI } from "./components/ui.jsx";

function requiredRole(s, sessionRole) {
  if (SHARED_SCREENS.includes(s) && sessionRole) return sessionRole;
  if (s === "A00" || s.startsWith("A")) return "admin";
  if (s.startsWith("T")) return "teacher";
  // 멘토는 아직 전용 화면이 없어서 학생 화면을 함께 쓴다. 여기서 "student" 를
  // 그대로 돌려주면 멘토가 홈으로 튕기고, 그 홈이 또 S 화면이라 무한히 돈다.
  return sessionRole === "mentor" ? "mentor" : "student";
}

export default function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <Routes>
          <Route path="/oauth/callback" element={<AppShell />} />
          <Route path="/login" element={<AppShell />} />
          <Route path="/:screenId" element={<AppShell />} />
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toast />
      </StoreProvider>
    </BrowserRouter>
  );
}

function RootRedirect() {
  const { state } = useStore();
  if (state.session?.user) {
    const u = state.session.user;
    const target =
      u.onboarded === false ? ONBOARDING_SCREEN : homeScreenForRole(u.role, u.grade);
    return <Navigate to={screenToPath(target)} replace />;
  }
  return <Navigate to="/login" replace />;
}

function AppShell() {
  const { state } = useStore();
  const session = state.session;
  const navigate = useNavigate();
  const location = useLocation();
  const [picker, setPicker] = useState(false);
  const [preview, setPreview] = useState(false);

  const screen =
    pathToScreen(location.pathname) ||
    (session ? homeScreenForRole(session.user.role, session.user.grade) : "S01");

  /* 없앤 화면의 옛 주소로 들어오면 이어받은 화면이 뜬다. 그런데 주소창에는
     죽은 경로가 그대로 남아서, 그 자리를 즐겨찾기 하거나 남에게 보내면
     없는 화면 주소가 계속 돌아다닌다. 자리를 옮겨 준 김에 주소도 고친다. */
  useEffect(() => {
    const canonical = screenToPath(screen);
    if (location.pathname !== canonical && pathToScreen(location.pathname) === screen) {
      navigate(canonical, { replace: true });
    }
  }, [screen, location.pathname, navigate]);

  const nav = useCallback((id, opts = {}) => {
    if (opts.preview) setPreview(true);
    else setPreview(false);
    const path = screenToPath(id);
    if (opts.replace) navigate(path, { replace: true });
    else navigate(path);
  }, [navigate]);

  // 인증·역할 게이팅
  useEffect(() => {
    if (preview) return;
    if (!session && !PUBLIC_SCREENS.includes(screen)) {
      navigate("/login", { replace: true });
      return;
    }
    if (session) {
      // 온보딩을 끝내지 않았으면 어디로 가든 온보딩부터. 역할·관심사가 없으면
      // 나머지 화면이 전부 빈 상태로 나온다 — 그 빈 화면을 보여줄 이유가 없다.
      if (
        session.user.onboarded === false &&
        screen !== ONBOARDING_SCREEN &&
        screen !== "S02"
      ) {
        navigate(screenToPath(ONBOARDING_SCREEN), { replace: true });
        return;
      }
      // 온보딩 중에는 역할이 아직 정해지지 않았거나 방금 바뀌었다. 여기서
      // 역할 검사를 하면 교사를 고른 사람이 교사 대시보드로 튕겨 나간다.
      if (screen === ONBOARDING_SCREEN) return;
      const need = requiredRole(screen, session.user.role);
      if (need !== session.user.role && !PUBLIC_SCREENS.includes(screen)) {
        navigate(screenToPath(homeScreenForRole(session.user.role, session.user.grade)), {
          replace: true,
        });
      }
    }
  }, [session, screen, preview, navigate]);

  // 로그인 직후 → 역할 홈 (이미 다른 화면에 있으면 유지 — hydrate)
  const prevSession = useRef(null);
  useEffect(() => {
    const wasNull = !prevSession.current;
    if (session && wasNull) {
      const onLoginOrOAuth = screen === "S01" || screen === "S02" || location.pathname === "/";
      if (onLoginOrOAuth) {
        setPreview(false);
        const target =
          session.user.onboarded === false
            ? ONBOARDING_SCREEN
            : homeScreenForRole(session.user.role, session.user.grade);
        navigate(screenToPath(target), { replace: true });
      }
    }
    if (!session && prevSession.current) {
      navigate("/login", { replace: true });
    }
    prevSession.current = session;
  }, [session, screen, location.pathname, navigate]);

  const layout = getLayout(screen, session?.user?.role);
  const sideNav = layout === "teacher" ? T_NAV : layout === "admin" ? A_NAV : S_NAV;
  const role = layout === "teacher" ? "교사" : layout === "admin" ? "관리자" : "학생";

  // 개발용 화면 피커 FAB — 프로덕션에서는 숨김
  const SHOW_DEV_PICKER = false;
  const devPicker = SHOW_DEV_PICKER ? (
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 9999 }}>
      <button
        onClick={() => setPicker(!picker)}
        title="화면 목록 (개발용)"
        style={{
          background: TDS.blue500, color: "#fff", border: "none", borderRadius: "50%",
          width: 52, height: 52, fontSize: 22, cursor: "pointer",
          boxShadow: "0 4px 20px rgba(49,130,246,.45)",
        }}
      >
        <TFI>🗺</TFI>
      </button>
      {picker && (
        <ScreenPicker
          cur={screen}
          onSel={(id) => { nav(id, { preview: true }); setPicker(false); }}
        />
      )}
    </div>
  ) : null;

  if (layout === "full") {
    return (
      <>
        {renderScreen(screen, nav)}
        <LoadingDock />
        {devPicker}
      </>
    );
  }

  const navTarget = NAV_ALIAS[screen] || screen;
  // 해당하는 메뉴가 없으면 아무것도 활성화하지 않는다. 엉뚱한 메뉴(대시보드)가
  // 켜져 있으면 사이드바가 현재 위치를 잘못 알려주는 셈이다.
  // 설정·알림 같은 유틸 화면은 하단 유틸 버튼이 대신 활성 표시를 갖는다.
  const activeNav = sideNav.find((n) => n.id === navTarget)?.id || null;
  const showHdr = !NO_HDR.includes(screen);

  return (
    <>
      <div className="app">
        <Sidebar nav={sideNav} active={activeNav} onNav={nav} role={role} dark={layout === "admin"} />
        <div className="main">
          {showHdr && (
            <div className="hdr">
              <div className="row g-10" style={{ gap: 10 }}>
                {/* TITLES 에 빈 문자열이면 화면이 자체 제목을 갖고 있다는 뜻 — 화면 ID를 노출하지 않는다 */}
                <span className="hdr-title">
                  {TITLES[screen] === "" ? "" : (TITLES[screen] || screen)}
                </span>
              </div>
              {/* 검색·알림·프로필은 사이드바 하단(S_UTIL)에 있다. 두 군데에 같은
                  버튼을 두면 어느 쪽이 진짜인지 알 수 없다. 사이드바에 유틸이
                  없는 관리자 화면에서만 헤더에 남긴다. */}
              {layout === "admin" && (
                <div className="hdr-actions"><GlobalHeader onNav={nav} /></div>
              )}
            </div>
          )}
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {renderScreen(screen, nav)}
          </div>
        </div>
      </div>
      {/* 녹음 도크는 화면 밖(껍데기)에 있다. 그래야 화면을 옮겨도 다시 그려지지
          않아 녹음이 이어진다 — 화면 안에 두면 이동하는 순간 끊긴다. */}
      {session && <VoiceDock onNav={nav} screen={screen} />}
      <LoadingDock />
      {devPicker}
    </>
  );
}
