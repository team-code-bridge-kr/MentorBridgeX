import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A23({ onNav }) {
  const [fmt,setFmt]=useState("JSON");
  const [range,setRange]=useState("7일");
  const [filters,setFilters]=useState({severity:"전체",action:""});
  const [done,setDone]=useState(false);
  return (
    <div className="content" style={{maxWidth:560,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("A21")}>← 감사 로그</button>
        <div style={{fontSize:20,fontWeight:700}}>감사 로그 내보내기</div>
      </div>
      {done
        ? <div className="card card-p" style={{textAlign:"center",padding:"40px"}}><TFI s={48} color={TDS.blue500}>📤</TFI><div style={{fontSize:18,fontWeight:700,marginTop:16}}>내보내기 완료</div><div style={{fontSize:13,color:TDS.textTertiary,marginTop:8,marginBottom:24}}>audit_log_20260120.{fmt.toLowerCase()} · 2.4 MB</div><Btn v="primary" s="md" onClick={()=>setDone(false)}>다운로드</Btn></div>
        : <div className="card card-p">
          <div className="inp-group"><label className="inp-label">기간</label>
            <select className="inp" value={range} onChange={e=>setRange(e.target.value)}>
              {["24시간","7일","30일","90일","사용자 정의"].map(r=><option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="inp-group"><label className="inp-label">심각도 필터</label>
            <select className="inp" value={filters.severity} onChange={e=>setFilters({...filters,severity:e.target.value})}>
              {["전체","critical","high","medium","low"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="inp-group"><label className="inp-label">액션 필터 (선택)</label>
            <input className="inp" placeholder="예: user.suspend" value={filters.action} onChange={e=>setFilters({...filters,action:e.target.value})} />
          </div>
          <div className="inp-group"><label className="inp-label">포맷</label>
            <div style={{display:"flex",gap:8}}>
              {["JSON","CSV"].map(f=><Btn key={f} v={fmt===f?"primary":"secondary"} s="sm" onClick={()=>setFmt(f)}>{f}</Btn>)}
            </div>
          </div>
          <Btn v="primary" s="md" fw onClick={()=>setDone(true)}>내보내기 시작</Btn>
        </div>
      }
    </div>
  );
}

/* A24 Investigation 발동 [T2] */

