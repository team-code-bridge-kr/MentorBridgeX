import { useState, useEffect, useCallback, useRef } from "react";
import { StoreProvider, useStore } from "./store/StoreProvider.jsx";
import { Toast } from "./components/Toast.jsx";
import { Sidebar } from "./components/layout/Sidebar.jsx";
import { GlobalHeader } from "./components/layout/GlobalHeader.jsx";
import { ScreenPicker } from "./components/ScreenPicker.jsx";
import { renderScreen } from "./screens/index.jsx";
import { S_NAV, T_NAV, A_NAV, TITLES, NO_HDR,
         SHARED_SCREENS, getLayout } from "./nav/menus.js";
import TDS from "./theme/tokens.js";
import { TFI } from "./components/ui.jsx";

const PUBLIC_SCREENS = ["S01","S02","S03","S04","A00","T01"];
/* 화면 id → 요구 역할 (게이팅). 공용 화면은 현재 세션 역할을 그대로 허용 */

function requiredRole(s, sessionRole){
  if (SHARED_SCREENS.includes(s) && sessionRole) return sessionRole;
  if (s==="A00"||s.startsWith("A")) return "admin";
  if (s.startsWith("T")) return "teacher";
  return "student";
}


export default function App() {
  return (
    <StoreProvider>
      <AppShell />
      <Toast />
    </StoreProvider>
  );
}


function AppShell() {
  const { state } = useStore();
  const session = state.session;
  const [screen, setScreen] = useState(() =>
    window.location.pathname.startsWith("/oauth/callback") ? "S02" : "S01"
  );
  const [picker, setPicker] = useState(false);
  const [preview, setPreview] = useState(false);  // 개발용: 게이트 우회하고 화면 미리보기 (디자인 검토)

  /* ── 인증 게이팅 ──
     - preview 모드(화면 목록에서 점프)면 우회
     - 로그인 안 됨 + 비공개 화면 → 로그인(S01)으로 리다이렉트
     - 로그인 됨 + 역할 불일치 → 자기 역할 홈으로 리다이렉트 */
  const nav = useCallback((id, opts={})=>{
    if (opts.preview) { setPreview(true); setScreen(id); return; }
    setPreview(false);
    setScreen(id);
  }, []);

  useEffect(()=>{
    if (preview) return;
    if (!session && !PUBLIC_SCREENS.includes(screen)) { setScreen("S01"); return; }
    if (session) {
      const need = requiredRole(screen, session.user.role);
      if (need !== session.user.role && !PUBLIC_SCREENS.includes(screen)) {
        const home = session.user.role==="admin"?"A01":session.user.role==="teacher"?"T03":"S05";
        setScreen(home);
      }
    }
  }, [session, screen, preview]);

  /* 로그인 직후 자동으로 역할 홈으로 진입 */
  const prevSession = useRef(null);
  useEffect(()=>{
    if (session && !prevSession.current) {
      const home = session.user.role==="admin"?"A01":session.user.role==="teacher"?"T03":"S05";
      setPreview(false); setScreen(home);
    }
    if (!session && prevSession.current) { setScreen("S01"); }
    prevSession.current = session;
  }, [session]);

  const layout = getLayout(screen, session?.user?.role);
  const sideNav = layout==="teacher"?T_NAV:layout==="admin"?A_NAV:S_NAV;
  const role = layout==="teacher"?"교사":layout==="admin"?"관리자":"학생";

  const devPicker = (
    <div style={{position:"fixed",bottom:20,right:20,zIndex:9999}}>
      <button onClick={()=>setPicker(!picker)} title="화면 목록 (개발용)" style={{background:TDS.blue500,color:"#fff",border:"none",borderRadius:"50%",width:52,height:52,fontSize:22,cursor:"pointer",boxShadow:`0 4px 20px rgba(49,130,246,.45)`}}><TFI>🗺</TFI></button>
      {picker&&<ScreenPicker cur={screen} onSel={id=>{nav(id,{preview:true});setPicker(false);}} />}
    </div>
  );

  if(layout==="full") return (
    <>
      {renderScreen(screen, nav)}
      {devPicker}
    </>
  );

  const activeNav = sideNav.find(n=>n.id===screen)?.id || sideNav[0].id;
  const showHdr = !NO_HDR.includes(screen);

  return (
    <>
      <div className="app">
        <Sidebar nav={sideNav} active={activeNav} onNav={nav} role={role} dark={layout==="admin"} />
        <div className="main">
          {showHdr&&(
            <div className="hdr">
              <div className="row g-10" style={{gap:10}}>
                <span className="hdr-title">{TITLES[screen]||screen}</span>
              </div>
              <div className="hdr-actions"><GlobalHeader onNav={nav}/></div>
            </div>
          )}
          <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
            {renderScreen(screen, nav)}
          </div>
        </div>
      </div>
      {devPicker}
    </>
  );
}

