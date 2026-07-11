import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function S29({ onNav }) {
  const jobs=[
    {id:0,title:"전체 데이터 내보내기",fmt:"JSON",status:"완료",size:"2.4 MB",created:"2026-01-20"},
    {id:1,title:"화학과 자기소개서",fmt:"PDF",status:"완료",size:"128 KB",created:"2026-01-20"},
    {id:2,title:"그래프 스냅샷",fmt:"PNG",status:"처리 중",size:"-",created:"2026-01-20"},
  ];
  const [creating, setCreating]=useState(false);
  return (
    <div className="content" style={{maxWidth:700,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontSize:20,fontWeight:700}}>내보내기 작업</div>
        <Btn v="primary" s="sm" onClick={()=>setCreating(!creating)}>+ 새 작업</Btn>
      </div>
      {creating && (
        <div className="card card-p" style={{marginBottom:16,border:`1px solid ${TDS.blue500}`}}>
          <div style={{fontWeight:700,marginBottom:16}}>새 내보내기 작업</div>
          <div className="inp-group"><label className="inp-label">대상</label>
            <select className="inp"><option>전체 데이터</option><option>그래프만</option><option>텍스트만</option><option>양식 결과물</option></select>
          </div>
          <div className="inp-group"><label className="inp-label">포맷</label>
            <select className="inp"><option>JSON</option><option>PDF</option><option>CSV</option><option>PNG</option></select>
          </div>
          <div style={{display:"flex",gap:8,marginTop:16}}>
            <Btn v="secondary" s="sm" onClick={()=>setCreating(false)}>취소</Btn>
            <Btn v="primary" s="sm" onClick={()=>setCreating(false)}>작업 시작</Btn>
          </div>
        </div>
      )}
      <div className="card card-p">
        {jobs.map((j,i)=>(
          <div key={j.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:i<jobs.length-1?`1px solid ${TDS.bgTertiary}`:"none"}}>
            <TFI s={24} color={TDS.textSecondary}>{j.fmt==="PDF"?"📑":j.fmt==="PNG"?"🖼️":"📦"}</TFI>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14}}>{j.title}</div>
              <div style={{fontSize:12,color:TDS.textTertiary}}>{j.fmt} · {j.size} · {j.created}</div>
            </div>
            <div style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:j.status==="완료"?TDS.successBg:TDS.warningBg,color:j.status==="완료"?TDS.success:TDS.warning}}>{j.status}</div>
            {j.status==="완료"&&<Btn v="primary" s="sm">다운로드</Btn>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* S31 계정 정보 */

