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
import { renderScreen } from "./screens/index.jsx";
import { S_NAV, T_NAV, A_NAV, TITLES, NO_HDR,
         SHARED_SCREENS, getLayout } from "./nav/menus.js";
import {
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
  return "student";
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
    return <Navigate to={screenToPath(homeScreenForRole(state.session.user.role))} replace />;
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

  const screen = pathToScreen(location.pathname) || (session ? homeScreenForRole(session.user.role) : "S01");

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
      const need = requiredRole(screen, session.user.role);
      if (need !== session.user.role && !PUBLIC_SCREENS.includes(screen)) {
        navigate(screenToPath(homeScreenForRole(session.user.role)), { replace: true });
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
        navigate(screenToPath(homeScreenForRole(session.user.role)), { replace: true });
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
        {devPicker}
      </>
    );
  }

  const activeNav = sideNav.find((n) => n.id === screen)?.id || sideNav[0].id;
  const showHdr = !NO_HDR.includes(screen);

  return (
    <>
      <div className="app">
        <Sidebar nav={sideNav} active={activeNav} onNav={nav} role={role} dark={layout === "admin"} />
        <div className="main">
          {showHdr && (
            <div className="hdr">
              <div className="row g-10" style={{ gap: 10 }}>
                <span className="hdr-title">{TITLES[screen] || screen}</span>
              </div>
              <div className="hdr-actions"><GlobalHeader onNav={nav} /></div>
            </div>
          )}
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {renderScreen(screen, nav)}
          </div>
        </div>
      </div>
      {devPicker}
    </>
  );
}
