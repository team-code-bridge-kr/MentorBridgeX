import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A05({ onNav }) {
  const [step, setStep] = useState(0);
  const [reason, setReason] = useState("");
  const [mfa, setMfa] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const steps=["1차 확인","사유 입력","MFA 재인증","최종 확인","실행"];
  return (
    <div className="content" style={{maxWidth:560,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("A03")}>← 사용자 상세</button>
        <div style={{fontSize:20,fontWeight:700,color:TDS.danger}}>강제 삭제 [Tier 2]</div>
      </div>
      <Notice type="danger" style={{marginBottom:20}}>
        <div style={{fontWeight:700,marginBottom:6}}>⚠️ admin.investigation 등급 작업</div>
        보안팀에 즉시 통보됩니다. 모든 단계가 감사 로그에 기록됩니다.
      </Notice>
      {/* 5단계 진행 표시 */}
      <div style={{display:"flex",gap:4,marginBottom:24}}>
        {steps.map((s,i)=>(
          <div key={i} style={{flex:1,height:4,borderRadius:2,background:i<=step?TDS.danger:TDS.borderDefault,transition:"background .3s"}} />
        ))}
      </div>
      {step===0&&(
        <div className="card card-p">
          <div style={{fontSize:15,fontWeight:700,marginBottom:12}}>1단계: 삭제 대상 확인</div>
          <div style={{padding:"12px",background:TDS.dangerBg,borderRadius:8,marginBottom:16}}>
            <div style={{fontWeight:700,color:TDS.danger,marginBottom:4}}>이수진 (sujin@school.ac.kr)</div>
            <div style={{fontSize:13,color:TDS.danger}}>교사 · 노드 1,204개 · 가입 2025-11-01</div>
          </div>
          <div style={{fontSize:13,color:TDS.textTertiary,marginBottom:16,lineHeight:1.6}}>이 작업은 사용자의 모든 데이터를 즉시 삭제합니다. 30일 복구 유예가 없으며 즉시 crypto-shredding이 실행됩니다.</div>
          <Btn v="danger" s="md" fw onClick={()=>setStep(1)}>다음 단계</Btn>
        </div>
      )}
      {step===1&&(
        <div className="card card-p">
          <div style={{fontSize:15,fontWeight:700,marginBottom:12}}>2단계: 삭제 사유 입력 (X-Investigation-Reason)</div>
          <div className="inp-group"><label className="inp-label">사유 (필수)</label>
            <textarea className="inp" rows={4} placeholder="강제 삭제 사유를 상세히 입력하세요..." value={reason} onChange={e=>setReason(e.target.value)} />
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn v="secondary" s="sm" onClick={()=>setStep(0)}>이전</Btn>
            <Btn v="danger" s="sm" disabled={reason.length<10} onClick={()=>setStep(2)}>다음 단계</Btn>
          </div>
        </div>
      )}
      {step===2&&(
        <div className="card card-p">
          <div style={{fontSize:15,fontWeight:700,marginBottom:12}}>3단계: MFA 재인증</div>
          <div className="inp-group"><label className="inp-label">인증 코드 (6자리)</label>
            <input className="inp" placeholder="000000" maxLength={6} value={mfa} onChange={e=>setMfa(e.target.value)} />
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn v="secondary" s="sm" onClick={()=>setStep(1)}>이전</Btn>
            <Btn v="danger" s="sm" disabled={mfa.length!==6} onClick={()=>setStep(3)}>인증 확인</Btn>
          </div>
        </div>
      )}
      {step===3&&(
        <div className="card card-p">
          <div style={{fontSize:15,fontWeight:700,marginBottom:12,color:TDS.danger}}>4단계: 최종 확인 — 되돌릴 수 없습니다</div>
          <div style={{padding:"16px",background:TDS.dangerBg,borderRadius:8,marginBottom:16,fontSize:13,color:TDS.danger,lineHeight:1.7}}>
            이수진 (sujin@school.ac.kr)의 모든 데이터가 즉시 삭제됩니다.<br/>
            보안팀에 Slack + 이메일로 즉시 통보됩니다.<br/>
            audit_logs.severity = critical로 기록됩니다.
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
            <input type="checkbox" id="final-confirm" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} />
            <label htmlFor="final-confirm" style={{fontSize:13,color:TDS.danger,fontWeight:600}}>위 내용을 이해했으며 영구 삭제를 실행합니다</label>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn v="secondary" s="sm" onClick={()=>setStep(2)}>이전</Btn>
            <Btn v="danger" s="sm" disabled={!confirmed} onClick={()=>setStep(4)}>강제 삭제 실행</Btn>
          </div>
        </div>
      )}
      {step===4&&(
        <div className="card card-p" style={{textAlign:"center",padding:"40px 24px"}}>
          <TFI s={48}>✅</TFI>
          <div style={{fontSize:18,fontWeight:700,marginTop:16,marginBottom:8}}>강제 삭제 완료</div>
          <div style={{fontSize:13,color:TDS.textTertiary,marginBottom:24}}>보안팀에 통보 완료 · 감사 로그 기록 완료</div>
          <Btn v="primary" s="md" onClick={()=>onNav("A02")}>사용자 목록으로</Btn>
        </div>
      )}
    </div>
  );
}

/* A06 교사 자격 검증 큐 */

