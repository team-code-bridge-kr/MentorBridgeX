import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A24({ onNav }) {
  const [step,setStep]=useState(0);
  const [target,setTarget]=useState("");
  const [reason,setReason]=useState("");
  const [mfa,setMfa]=useState("");
  return (
    <div className="content" style={{maxWidth:540,margin:"0 auto"}}>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:16}}>
        <div style={{fontSize:20,fontWeight:700,color:TDS.danger}}>Investigation 발동</div><Badge t="red">[T2]</Badge>
      </div>
      <Notice type="danger" style={{marginBottom:20}}>
        <div style={{fontWeight:700,marginBottom:6}}>admin.investigation 등급 · 보안팀 즉시 통보</div>
        모든 단계가 감사 로그(severity=critical)에 기록됩니다.
      </Notice>
      <div style={{display:"flex",gap:4,marginBottom:24}}>
        {["대상","사유","MFA","실행"].map((s,i)=>(
          <div key={i} style={{flex:1,height:4,borderRadius:2,background:i<=step?TDS.danger:TDS.borderDefault}} />
        ))}
      </div>
      {step===0&&(
        <div className="card card-p">
          <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>조사 대상</div>
          <div className="inp-group"><label className="inp-label">사용자 ID 또는 이메일</label><input className="inp" placeholder="조사 대상 입력..." value={target} onChange={e=>setTarget(e.target.value)} /></div>
          <div className="inp-group"><label className="inp-label">조사 범위</label>
            <select className="inp"><option>전체 데이터</option><option>그래프</option><option>음성</option><option>코멘트</option></select>
          </div>
          <Btn v="danger" s="md" fw disabled={!target} onClick={()=>setStep(1)}>다음</Btn>
        </div>
      )}
      {step===1&&(
        <div className="card card-p">
          <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>조사 사유 (X-Investigation-Reason)</div>
          <textarea className="inp" rows={5} placeholder="상세한 조사 사유를 입력하세요..." value={reason} onChange={e=>setReason(e.target.value)} />
          <div style={{display:"flex",gap:8,marginTop:16}}>
            <Btn v="secondary" s="sm" onClick={()=>setStep(0)}>이전</Btn>
            <Btn v="danger" s="sm" disabled={reason.length<20} onClick={()=>setStep(2)}>다음</Btn>
          </div>
        </div>
      )}
      {step===2&&(
        <div className="card card-p">
          <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>MFA 재인증</div>
          <div className="inp-group"><label className="inp-label">인증 코드</label><input className="inp" placeholder="6자리 코드" maxLength={6} value={mfa} onChange={e=>setMfa(e.target.value)} /></div>
          <div style={{display:"flex",gap:8}}>
            <Btn v="secondary" s="sm" onClick={()=>setStep(1)}>이전</Btn>
            <Btn v="danger" s="sm" disabled={mfa.length!==6} onClick={()=>setStep(3)}>인증 확인</Btn>
          </div>
        </div>
      )}
      {step===3&&(
        <div className="card card-p" style={{textAlign:"center",padding:"40px"}}>
          <TFI s={48} color={TDS.blue500}>🔎</TFI>
          <div style={{fontSize:18,fontWeight:700,marginTop:16,marginBottom:8}}>Investigation 발동됨</div>
          <div style={{fontSize:13,color:TDS.textTertiary,marginBottom:8}}>대상: {target}</div>
          <div style={{fontSize:12,color:TDS.danger,marginBottom:24}}>보안팀 Slack + 이메일 통보 완료 · severity=critical</div>
          <Btn v="primary" s="md" onClick={()=>onNav("A21")}>감사 로그 확인</Btn>
        </div>
      )}
    </div>
  );
}

/* A25 학기·과목 마스터 */

