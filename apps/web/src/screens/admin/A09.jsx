import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A09({ onNav }) {
  const [decision,setDecision]=useState(null);
  return (
    <div className="content" style={{maxWidth:640,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("A08")}>← 큐</button>
        <div style={{fontSize:20,fontWeight:700}}>신고 상세·처리</div>
      </div>
      {decision&&<Notice type={decision==="dismiss"?"warning":"danger"} style={{marginBottom:16}}>{decision==="dismiss"?"신고가 기각되었습니다":"처리 완료 — 해당 코멘트가 삭제되었습니다"}</Notice>}
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
          <div style={{fontWeight:700}}>R-001 · 부적절 코멘트</div>
          <Badge t="red">high</Badge>
        </div>
        {[["신고자","홍길동 (학생)"],["신고일","2026-01-20 14:32"],["대상","박교사의 코멘트 #4729"]].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${TDS.bgTertiary}`,fontSize:13}}>
            <span style={{color:TDS.textTertiary}}>{k}</span><span>{v}</span>
          </div>
        ))}
      </div>
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>신고된 코멘트 내용</div>
        <div style={{padding:"12px",background:TDS.dangerBg,borderRadius:8,fontSize:13,color:TDS.textPrimary,borderLeft:`4px solid ${TDS.danger}`}}>
          "이 정도 수준으로는 대학교도 못 가겠다. 공부 그만해."
        </div>
      </div>
      <div className="inp-group"><label className="inp-label">처리 메모</label><textarea className="inp" rows={2} placeholder="처리 사유..." /></div>
      <div style={{display:"flex",gap:8,marginTop:16}}>
        <Btn v="ghost" s="md" fw disabled={!!decision} onClick={()=>setDecision("dismiss")}>기각</Btn>
        <Btn v="secondary" s="md" fw disabled={!!decision} onClick={()=>onNav("A10")}>코멘트 검토</Btn>
        <Btn v="danger" s="md" fw disabled={!!decision} onClick={()=>setDecision("delete")}>코멘트 삭제</Btn>
      </div>
    </div>
  );
}

/* A10 신고된 코멘트 목록 */

