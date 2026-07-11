import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A00({ onNav }) {
  const { state, actions } = useStore();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [mfa, setMfa] = useState("");
  const [localErr, setLocalErr] = useState("");
  const busy = state.authLoading;
  const doLogin = async () => {
    setLocalErr("");
    try { await actions.signInAdmin(email, pw, mfa); }
    catch (e) { setLocalErr(e.message); }
  };
  const errMsg = localErr || state.authError;
  const darkInput = { background:TDS.dark, border:`1px solid ${TDS.darkBrd}`, color:"#f2f2f7" };
  return (
    <div style={{minHeight:"100vh",background:TDS.dark,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:TDS.darkCard,borderRadius:24,padding:"48px 52px",maxWidth:420,width:"90%",boxShadow:"0 20px 60px rgba(0,0,0,.4)"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:48,marginBottom:12}}><TFI s={48} color={TDS.blue500}>🛡️</TFI></div>
          <h2 style={{fontSize:22,fontWeight:800,color:"#f2f2f7",marginBottom:6}}>관리자 콘솔</h2>
          <p style={{fontSize:13,color:"#8b95a1"}}>보안팀 발급 계정으로 로그인하세요</p>
        </div>
        <Notice type="warning" className="mb24">관리자 계정은 OAuth 가입이 불가합니다. MFA 인증이 필수입니다.</Notice>
        {errMsg && <div style={{marginBottom:16,padding:"10px 12px",borderRadius:10,background:"rgba(240,68,68,.12)",border:`1px solid rgba(240,68,68,.3)`,color:"#ff8080",fontSize:13,fontWeight:500}}>{errMsg}</div>}
        <div className="inp-group"><label className="inp-label" style={{color:"#c2c9d2"}}>관리자 ID</label><input className="inp" style={darkInput} placeholder="admin@school.ac.kr" value={email} onChange={e=>setEmail(e.target.value)} disabled={busy} /></div>
        <div className="inp-group"><label className="inp-label" style={{color:"#c2c9d2"}}>비밀번호</label><input className="inp" type="password" style={darkInput} placeholder="••••••••" value={pw} onChange={e=>setPw(e.target.value)} disabled={busy} /></div>
        <div className="inp-group" style={{marginBottom:24}}><label className="inp-label" style={{color:"#c2c9d2"}}>MFA 코드</label><input className="inp" style={darkInput} placeholder="6자리 코드" maxLength={6} value={mfa} onChange={e=>setMfa(e.target.value.replace(/\D/g,""))} disabled={busy} /></div>
        <Btn v="primary" fw onClick={doLogin} disabled={busy} style={busy?{opacity:.7,cursor:"not-allowed"}:undefined}>{busy?"인증 중…":"로그인"}</Btn>
        <div style={{textAlign:"center",marginTop:14,fontSize:11,color:"#6b7280"}}>데모 · <b style={{color:"#8b95a1"}}>admin@school.ac.kr</b> / 비번 <b style={{color:"#8b95a1"}}>admin</b> / MFA 아무 6자리</div>
      </div>
    </div>
  );
}

