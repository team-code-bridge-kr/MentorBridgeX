import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function S32({ onNav }) {
  const [step, setStep] = useState(0);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="content" style={{maxWidth:540,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("S30")}>← 설정</button>
        <div style={{fontSize:20,fontWeight:700}}>계정 삭제 요청</div>
      </div>
      {step===0 && (
        <>
          <Notice type="danger" style={{marginBottom:20}}>
            <div style={{fontWeight:700,marginBottom:8}}>⚠️ 삭제 전 반드시 읽어주세요</div>
            <ul style={{paddingLeft:18,fontSize:13,lineHeight:2}}>
              <li>삭제 요청 후 <strong>30일 이내</strong> 철회 가능</li>
              <li>30일 경과 시 모든 데이터가 <strong>완전 삭제</strong>됩니다</li>
              <li>그래프·텍스트·음성 데이터 포함 모든 정보 삭제</li>
              <li>삭제 후 같은 이메일로 재가입 가능 (데이터는 복구 불가)</li>
            </ul>
          </Notice>
          <div className="card card-p" style={{marginBottom:16}}>
            <div className="inp-group"><label className="inp-label">삭제 사유 (선택)</label>
              <textarea className="inp" rows={3} placeholder="삭제 이유를 알려주시면 서비스 개선에 도움이 됩니다..." value={reason} onChange={e=>setReason(e.target.value)} />
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginTop:12}}>
              <input type="checkbox" id="del-confirm" checked={confirm} onChange={e=>setConfirm(e.target.checked)} />
              <label htmlFor="del-confirm" style={{fontSize:13,color:TDS.textSecondary}}>위 내용을 모두 이해했으며 계정 삭제를 요청합니다</label>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn v="secondary" s="md" fw onClick={()=>onNav("S30")}>취소</Btn>
            <Btn v="danger" s="md" fw disabled={!confirm} onClick={()=>setStep(1)}>삭제 요청 제출</Btn>
          </div>
        </>
      )}
      {step===1 && (
        <div className="card card-p" style={{textAlign:"center",padding:"48px 24px"}}>
          <TFI s={56}>⏳</TFI>
          <div style={{fontSize:20,fontWeight:700,marginTop:16,marginBottom:8}}>삭제 요청이 접수되었습니다</div>
          <div style={{fontSize:14,color:TDS.textTertiary,lineHeight:1.7,marginBottom:24}}>
            30일 이내에는 언제든지 철회할 수 있습니다.<br/>
            <strong style={{color:TDS.danger}}>2026-02-20</strong> 이후 데이터가 완전히 삭제됩니다.
          </div>
          <Btn v="danger" s="lg" fw onClick={()=>setStep(2)}>철회하기</Btn>
        </div>
      )}
      {step===2 && (
        <div className="card card-p" style={{textAlign:"center",padding:"48px 24px"}}>
          <TFI s={56}>✅</TFI>
          <div style={{fontSize:20,fontWeight:700,marginTop:16,marginBottom:8}}>삭제 요청이 철회되었습니다</div>
          <div style={{fontSize:14,color:TDS.textTertiary,marginBottom:24}}>계정이 정상적으로 유지됩니다.</div>
          <Btn v="primary" s="lg" onClick={()=>onNav("S05")}>대시보드로</Btn>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   ── TEACHER SCREENS ──
────────────────────────────────────────────────────────────── */

