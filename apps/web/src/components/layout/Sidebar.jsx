import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { Av } from "../ui.jsx";
import { NavIcon } from "../NavIcon.jsx";
import logoBlack from "../../assets/brand/TeamCodeBridge_Logo_Black_Web.png";
import logoWhite from "../../assets/brand/TeamCodeBridge_Logo_White_Web.png";

export function Sidebar({ nav, active, onNav, role, dark }) {
  const { state, actions } = useStore();
  const user = state.session?.user;
  const displayName = user?.name || (dark?"시스템 관리자":"게스트");
  const displayEmail = user?.email || "—";
  // 기본은 접힌 아이콘 레일 — sb-rail 에 hover/focus 하면 본문 위로 펼쳐진다 (styles.css).
  return (
    <div className="sb-rail">
      <div className={`sidebar sb-${dark?"dark":"light"}`}>
        <div className="sb-logo">
          <img
            className="sb-logo-icon"
            src={dark ? logoWhite : logoBlack}
            alt="Team Code Bridge"
          />
          <span className="sb-logo-text sb-fade">MentorBridgeX</span>
        </div>
        <div className="sb-section">
          {nav.map(n => {
            const isActive = active===n.id;
            // 푸른끼 있는 gray stroke / 활성 시 blue
            const stroke = isActive ? (dark?TDS.blue400:TDS.blue500) : (dark?"#7c8aa3":"#6b7a90");
            return (
            <div
              key={n.id}
              className={`sb-item${isActive?" active":""}`}
              onClick={()=>onNav(n.id)}
              title={n.label}
            >
              <span className="sb-icon" style={{display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
                <NavIcon name={n.icon} size="100%" color={stroke} />
              </span>
              <span className="sb-label sb-fade">{n.label}</span>
            </div>
            );
          })}
        </div>
        <div className="sb-profile">
          <Av name={displayName || "?"} src={user?.picture} size="sm" />
          <div className="sb-pmeta sb-fade" style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span className="sb-pname">{displayName}</span>
              <span className="sb-chip">{role}</span>
            </div>
            <div className="sb-pemail">{displayEmail}</div>
          </div>
          <button
            className="sb-logout sb-fade"
            title="로그아웃"
            onClick={()=>actions.signOut()}
            style={{flexShrink:0,width:32,height:32,borderRadius:8,border:"none",background:"transparent",cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center"}}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={dark?"#7c8aa3":"#8b95a1"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   HEADER
────────────────────────────────────────────────────────────── */

