import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A19({ onNav }) {
  const [step,setStep]=useState(0);
  const [mfa,setMfa]=useState("");
  const [reason,setReason]=useState("");
  return (
    <div className="content" style={{maxWidth:540,margin:"0 auto"}}>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:20}}>
        <div style={{fontSize:20,fontWeight:700}}>JWKS 키 회전 승인</div><Badge t="red">[T2]</Badge>
      </div>
      <Notice type="danger" style={{marginBottom:20}}>키 회전 후 모든 활성 세션이 무효화됩니다. 사용자는 재로그인이 필요합니다.</Notice>
      {step===0&&(
        <div className="card card-p">
          <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>현재 키 상태</div>
          {[["현재 키 ID","key-2026-01-001"],["생성일","2026-01-01"],["만료 예정","2026-07-01"],["서명 알고리즘","RS256"]].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${TDS.bgTertiary}`,fontSize:13}}>
              <span style={{color:TDS.textTertiary}}>{k}</span><span style={{fontFamily:"monospace",fontSize:12}}>{v}</span>
            </div>
          ))}
          <div className="inp-group" style={{marginTop:16}}><label className="inp-label">회전 사유</label><textarea className="inp" rows={2} placeholder="키 회전 사유..." value={reason} onChange={e=>setReason(e.target.value)} /></div>
          <div className="inp-group"><label className="inp-label">MFA 인증 코드</label><input className="inp" placeholder="6자리 코드" value={mfa} onChange={e=>setMfa(e.target.value)} /></div>
          <Btn v="danger" s="md" fw disabled={!reason||mfa.length!==6} onClick={()=>setStep(1)}>키 회전 실행</Btn>
        </div>
      )}
      {step===1&&(
        <div className="card card-p" style={{textAlign:"center",padding:"40px"}}>
          <TFI s={48} color={TDS.warning}>🔑</TFI>
          <div style={{fontSize:18,fontWeight:700,marginTop:16,marginBottom:8}}>키 회전 완료</div>
          <div style={{fontSize:13,color:TDS.textTertiary,marginBottom:24}}>새 키: key-2026-01-002 · 보안팀에 통보됨</div>
          <Btn v="primary" s="md" onClick={()=>onNav("A13")}>시스템 헬스로</Btn>
        </div>
      )}
    </div>
  );
}

/* A20 Redis fail-close 토글 [T2] */

