import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A04({ onNav }) {
  const [step, setStep] = useState(0);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("7일");
  const isSuspended = false;
  return (
    <div className="content" style={{maxWidth:560,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("A03")}>← 사용자 상세</button>
        <div style={{fontSize:20,fontWeight:700}}>계정 {isSuspended?"해제":"정지"}</div>
      </div>
      {step===0&&(
        <>
          <div className="card card-p" style={{marginBottom:16}}>
            <div style={{display:"flex",gap:12,marginBottom:16}}>
              <Av name="이" size="sm" />
              <div><div style={{fontWeight:700}}>이수진</div><div style={{fontSize:12,color:TDS.textTertiary}}>sujin@school.ac.kr · 교사</div></div>
            </div>
            {!isSuspended&&(
              <>
                <div className="inp-group"><label className="inp-label">정지 기간</label>
                  <select className="inp" value={duration} onChange={e=>setDuration(e.target.value)}>
                    {["3일","7일","14일","30일","무기한"].map(d=><option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="inp-group"><label className="inp-label">정지 사유 (필수)</label>
                  <textarea className="inp" rows={3} placeholder="사유를 입력하세요..." value={reason} onChange={e=>setReason(e.target.value)} />
                </div>
              </>
            )}
            {isSuspended&&<Notice type="warning">현재 정지 상태입니다. 해제하면 즉시 로그인이 가능해집니다.</Notice>}
          </div>
          <Notice type="danger" style={{marginBottom:16}}>이 액션은 감사 로그에 기록됩니다.</Notice>
          <div style={{display:"flex",gap:8}}>
            <Btn v="secondary" s="md" fw onClick={()=>onNav("A03")}>취소</Btn>
            <Btn v={isSuspended?"primary":"danger"} s="md" fw disabled={!isSuspended&&!reason} onClick={()=>setStep(1)}>
              {isSuspended?"계정 해제 확인":"정지 확인"}
            </Btn>
          </div>
        </>
      )}
      {step===1&&(
        <div className="card card-p" style={{textAlign:"center",padding:"40px 24px"}}>
          <TFI s={48}>{isSuspended?"✅":"🚫"}</TFI>
          <div style={{fontSize:18,fontWeight:700,marginTop:16,marginBottom:8}}>계정 {isSuspended?"해제":"정지"}가 완료되었습니다</div>
          <div style={{fontSize:13,color:TDS.textTertiary,marginBottom:24}}>사유: {reason||"해제 처리"} · 기간: {!isSuspended?duration:"—"}</div>
          <Btn v="primary" s="md" onClick={()=>onNav("A02")}>목록으로</Btn>
        </div>
      )}
    </div>
  );
}

/* A05 강제 삭제 [T2] */

