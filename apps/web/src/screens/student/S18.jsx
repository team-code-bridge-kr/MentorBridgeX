import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function S18({ onNav }) {
  const [participants,setParticipants]=useState([
    {name:"홍길동",role:"호스트",status:"참여 중"},
    {name:"이지은",role:"참여자",status:"참여 중"},
    {name:"김철수",role:"참여자",status:"초대됨"},
  ]);
  return (
    <div className="content" style={{maxWidth:560,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("S15")}>← 목록</button>
        <div style={{fontSize:20,fontWeight:700}}>참여자 관리</div>
      </div>
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>참여자 ({participants.length}명)</div>
        {participants.map((p,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:i<participants.length-1?`1px solid ${TDS.bgTertiary}`:"none"}}>
            <Av name={p.name[0]} size="sm" />
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14}}>{p.name}</div>
              <div style={{fontSize:12,color:TDS.textTertiary}}>{p.role}</div>
            </div>
            <div style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:p.status==="참여 중"?TDS.successBg:TDS.warningBg,color:p.status==="참여 중"?TDS.success:TDS.warning}}>{p.status}</div>
            {p.role!=="호스트"&&<button style={{background:"none",border:"none",color:TDS.textTertiary,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center"}} onClick={()=>setParticipants(participants.filter((_,j)=>j!==i))}><NavIcon name="close" size={14} color={TDS.textTertiary}/></button>}
          </div>
        ))}
      </div>
      <div className="card card-p">
        <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>참여자 초대</div>
        <div style={{display:"flex",gap:8}}>
          <input className="inp" style={{flex:1}} placeholder="이름 또는 학번 검색..." />
          <Btn v="primary" s="sm">초대</Btn>
        </div>
      </div>
    </div>
  );
}

/* S19 그래프 매칭 제안 */

