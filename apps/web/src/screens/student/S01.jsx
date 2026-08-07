import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { withLoading } from "../../components/LoadingDock.jsx";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function S01({ onNav }) {
  const { state, actions } = useStore();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [localErr, setLocalErr] = useState("");
  const busy = state.authLoading;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const doPasswordLogin = async () => {
    setLocalErr("");
    if (!emailOk) { setLocalErr("올바른 이메일 형식을 입력하세요."); return; }
    if (pw.length < 4) { setLocalErr("비밀번호를 입력하세요."); return; }
    try {
      await withLoading("로그인 중이에요…", () => actions.signInPassword(email, pw));
      /* 게이팅이 자동으로 역할 홈으로 이동 */
    } catch (e) { setLocalErr(e.message); }
  };
  const doGoogleLogin = async () => {
    setLocalErr("");
    try {
      // 설정을 받아 온 뒤 구글로 **페이지를 통째로 넘긴다.** 그 사이가 비어 있으면
      // 눌렸는지 알 수 없어 한 번 더 누르게 된다.
      await withLoading("Google 로 이동 중이에요…", () => actions.signInGoogle());
    } catch (e) { setLocalErr(e.message); }
  };
  const onKey = e => { if (e.key === "Enter" && !busy) doPasswordLogin(); };
  const errMsg = localErr || state.authError;

  return (
    <div className="login-wrap">
      {/* 왼쪽 — TDS Primary Blue 그라데이션 */}
      <div className="login-left">
        <div className="login-left-content">

          {/* 로고 */}
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:48}}>
            <div style={{width:48,height:48,borderRadius:14,background:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <TFI s={24} color="#fff">📚</TFI>
            </div>
            <div>
              <div style={{fontSize:19,fontWeight:800,letterSpacing:"-.3px"}}>생기부 관리 시스템</div>
              <div style={{fontSize:12,opacity:.65,marginTop:2}}>Ontology-based Record Management</div>
            </div>
          </div>

          {/* 헤드라인 */}
          <h1 style={{fontSize:"clamp(24px,2.6vw,32px)",fontWeight:800,marginBottom:12,lineHeight:1.25,letterSpacing:"-.5px"}}>
            나만의 학습 여정을<br/>체계적으로 기록하세요
          </h1>
          <p style={{fontSize:15,opacity:.78,lineHeight:1.75,marginBottom:40}}>
            온톨로지 기반 지식 그래프로<br/>생활기록부를 스마트하게 관리합니다
          </p>

          {/* 특징 3가지 — TFI color="#fff" */}
          {[
            ["🧠","지식 그래프","노드와 엣지로 연결되는 학습 지식 구조"],
            ["🎤","AI 음성 인식","강의·토론을 실시간 STT로 자동 기록"],
            ["📝","맞춤형 양식","생기부 영역별 AI 자소서·세특 자동 작성"],
          ].map(([ic,t,d])=>(
            <div key={t} style={{display:"flex",gap:14,marginBottom:18,alignItems:"flex-start"}}>
              <div style={{width:42,height:42,borderRadius:12,background:"rgba(255,255,255,.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <TFI s={20} color="#fff">{ic}</TFI>
              </div>
              <div>
                <div style={{fontWeight:700,fontSize:14,marginBottom:2}}>{t}</div>
                <div style={{fontSize:13,opacity:.7,lineHeight:1.55}}>{d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 오른쪽 — 로그인 폼 */}
      <div className="login-right">
        <div className="login-box">
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:32}}>
            <div style={{width:36,height:36,borderRadius:10,background:TDS.blue500,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <TFI s={18} color="#fff">📚</TFI>
            </div>
            <div style={{fontSize:16,fontWeight:700,color:TDS.textPrimary}}>생기부 관리</div>
          </div>

          <h2 style={{fontSize:26,fontWeight:800,marginBottom:6,color:TDS.textPrimary,letterSpacing:"-.3px"}}>시작하기</h2>
          <p style={{fontSize:14,color:TDS.textTertiary,marginBottom:28}}>학교 Google 계정으로 로그인하세요</p>

          {/* Google 로그인 */}
          <button
            disabled={busy}
            style={{width:"100%",height:52,borderRadius:12,border:`1.5px solid ${TDS.borderDefault}`,background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",gap:10,fontSize:15,fontWeight:600,color:TDS.textPrimary,cursor:busy?"not-allowed":"pointer",opacity:busy?.6:1,marginBottom:20,transition:"border-color .14s"}}
            onClick={doGoogleLogin}
            onMouseEnter={e=>{ if(!busy) e.currentTarget.style.borderColor=TDS.blue500; }}
            onMouseLeave={e=>e.currentTarget.style.borderColor=TDS.borderDefault}
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            {busy ? "로그인 중…" : "Google로 시작하기"}
          </button>

          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
            <div style={{flex:1,height:1,background:TDS.borderDefault}} />
            <span style={{fontSize:12,color:TDS.textTertiary}}>또는</span>
            <div style={{flex:1,height:1,background:TDS.borderDefault}} />
          </div>

          {errMsg && (
            <div style={{marginBottom:14,padding:"10px 12px",borderRadius:10,background:"rgba(240,68,68,.08)",border:`1px solid rgba(240,68,68,.25)`,color:TDS.danger,fontSize:13,fontWeight:500}}>
              {errMsg}
            </div>
          )}

          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:13,fontWeight:600,color:TDS.textSecondary,marginBottom:6}}>이메일</label>
            <input className="inp" placeholder="school@example.ac.kr" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={onKey} disabled={busy} autoComplete="username" />
          </div>
          <div style={{marginBottom:24}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <label style={{fontSize:13,fontWeight:600,color:TDS.textSecondary}}>비밀번호</label>
              <span style={{fontSize:12,color:TDS.blue500,cursor:"pointer"}}>비밀번호 찾기</span>
            </div>
            <input className="inp" type="password" placeholder="••••••••" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={onKey} disabled={busy} autoComplete="current-password" />
          </div>

          <Btn v="primary" s="lg" fw onClick={doPasswordLogin} disabled={busy} style={busy?{opacity:.7,cursor:"not-allowed"}:undefined}>{busy ? "로그인 중…" : "로그인"}</Btn>

          <div style={{textAlign:"center",marginTop:14,fontSize:11,color:TDS.textTertiary,lineHeight:1.6}}>
            데모 계정 · 학생 <b>hong@school.ac.kr</b> / 교사 <b>sujin@school.ac.kr</b> · 비번 <b>1234</b>
          </div>

          <div style={{textAlign:"center",marginTop:16,fontSize:12,color:TDS.textTertiary}}>
            교사 계정{" "}
            <span style={{color:TDS.blue500,cursor:"pointer",fontWeight:600}} onClick={()=>onNav("T01")}>신청하기</span>
            {"  ·  "}
            <span style={{color:TDS.blue500,cursor:"pointer"}} onClick={()=>onNav("A00")}>관리자 콘솔</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* S03 가입 환영 */

