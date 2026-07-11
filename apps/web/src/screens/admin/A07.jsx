import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A07({ onNav }) {
  const [decision,setDecision]=useState(null);
  return (
    <div className="content" style={{maxWidth:640,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("A06")}>← 큐</button>
        <div style={{fontSize:20,fontWeight:700}}>자격 상세 검토</div>
      </div>
      {decision&&<Notice type={decision==="approve"?"success":"danger"} style={{marginBottom:16}}>{decision==="approve"?"✅ 승인 완료":"❌ 거부 완료"} — 감사 로그 기록됨</Notice>}
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{display:"flex",gap:12,marginBottom:16}}>
          <Av name="김" size="md" />
          <div><div style={{fontSize:16,fontWeight:700}}>김선생</div><div style={{fontSize:13,color:TDS.textTertiary}}>teacher@school.ac.kr · 신청 2026-01-20</div></div>
        </div>
        {[["소속 학교","○○고등학교"],["교과목","물리학"],["교원 자격증 번호","KR-EDU-2020-XXXXX"]].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${TDS.bgTertiary}`,fontSize:13}}>
            <span style={{color:TDS.textTertiary}}>{k}</span><span style={{fontWeight:500}}>{v}</span>
          </div>
        ))}
      </div>
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>첨부 서류</div>
        {[["📎 교원자격증.pdf","428 KB","PDF"],["📎 재직증명서_2026.pdf","215 KB","PDF"]].map(([n,sz,t])=>(
          <div key={n} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",background:TDS.bgSecondary,borderRadius:8,marginBottom:8}}>
            <TFI s={20}>{n.split(" ")[0]}</TFI>
            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{n.split(" ").slice(1).join(" ")}</div><div style={{fontSize:11,color:TDS.textTertiary}}>{sz} · {t}</div></div>
            <Btn v="ghost" s="sm">열기</Btn>
          </div>
        ))}
      </div>
      <div className="inp-group"><label className="inp-label">검토 메모</label><textarea className="inp" rows={2} placeholder="내부 메모..." /></div>
      <div style={{display:"flex",gap:8,marginTop:16}}>
        <Btn v="danger" s="md" fw disabled={!!decision} onClick={()=>{setDecision("reject");setTimeout(()=>onNav("A06"),1500);}}>거부</Btn>
        <Btn v="primary" s="md" fw disabled={!!decision} onClick={()=>{setDecision("approve");setTimeout(()=>onNav("A06"),1500);}}>승인</Btn>
      </div>
    </div>
  );
}

/* A08 신고 큐 */

