import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function T04({ onNav }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const students=[
    {id:"S001",name:"김학생",grade:"2학년 3반"},
    {id:"S002",name:"이학생",grade:"2학년 5반"},
    {id:"S003",name:"박학생",grade:"3학년 1반"},
  ];
  const filtered=students.filter(s=>!q||(s.name+s.id).includes(q));
  return (
    <div className="content" style={{maxWidth:560,margin:"0 auto"}}>
      <div style={{fontSize:22,fontWeight:700,marginBottom:6}}>학생 매핑 신청</div>
      <div style={{fontSize:14,color:TDS.textTertiary,marginBottom:20}}>담당할 학생을 검색하여 매핑을 요청하세요</div>
      <div className="card card-p" style={{marginBottom:16}}>
        <div className="inp-group">
          <label className="inp-label">학생 검색</label>
          <div className="search-wrap"><span>🔍</span><input placeholder="이름 또는 학번 검색..." value={q} onChange={e=>setQ(e.target.value)} /></div>
        </div>
        <div style={{marginTop:8}}>
          {filtered.map(s=>(
            <div key={s.id} onClick={()=>setSel(s)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:8,marginBottom:4,background:sel?.id===s.id?TDS.blue50:TDS.bgSecondary,border:`1px solid ${sel?.id===s.id?TDS.blue500:TDS.borderDefault}`,cursor:"pointer"}}>
              <Av name={s.name[0]} size="sm" />
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:14}}>{s.name}</div>
                <div style={{fontSize:12,color:TDS.textTertiary}}>{s.grade} · {s.id}</div>
              </div>
              {sel?.id===s.id&&<TFI s={18} style={{color:TDS.blue500}}>✓</TFI>}
            </div>
          ))}
          {!filtered.length&&<div style={{textAlign:"center",padding:"20px",color:TDS.textTertiary,fontSize:13}}>검색 결과 없음</div>}
        </div>
      </div>
      {sel&&(
        <div className="card card-p" style={{marginBottom:16}}>
          <div className="inp-group">
            <label className="inp-label">신청 사유</label>
            <textarea className="inp" rows={3} placeholder="해당 학생의 담임 교사입니다..." />
          </div>
        </div>
      )}
      <Btn v="primary" s="lg" fw disabled={!sel} onClick={()=>onNav("T05")}>매핑 신청 ({sel?sel.name:"학생 선택"})</Btn>
    </div>
  );
}

/* T05 매핑 신청 상태 */

