import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function T05({ onNav }) {
  const requests=[
    {student:"김학생",grade:"2학년 3반",date:"2026-01-20",status:"학생 수락 대기"},
    {student:"이학생",grade:"2학년 5반",date:"2026-01-18",status:"승인됨"},
    {student:"최학생",grade:"3학년 2반",date:"2026-01-10",status:"만료"},
  ];
  const statusColor={
    "학생 수락 대기":{c:TDS.warning,bg:TDS.warningBg},
    "승인됨":{c:TDS.success,bg:TDS.successBg},
    "만료":{c:TDS.textTertiary,bg:TDS.bgTertiary},
    "거부됨":{c:TDS.danger,bg:TDS.dangerBg},
  };
  return (
    <div className="content" style={{maxWidth:640,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontSize:20,fontWeight:700}}>매핑 신청 상태</div>
        <Btn v="primary" s="sm" onClick={()=>onNav("T04")}>+ 신규 신청</Btn>
      </div>
      <div className="card card-p">
        {requests.map((r,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:i<requests.length-1?`1px solid ${TDS.bgTertiary}`:"none"}}>
            <Av name={r.student[0]} size="sm" />
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14}}>{r.student}</div>
              <div style={{fontSize:12,color:TDS.textTertiary}}>{r.grade} · 신청 {r.date}</div>
            </div>
            <div style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:statusColor[r.status]?.bg,color:statusColor[r.status]?.c}}>{r.status}</div>
            {r.status==="학생 수락 대기"&&<Btn v="ghost" s="sm">취소</Btn>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* T09 학생 노드 상세 R */

