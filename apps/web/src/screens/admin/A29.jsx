import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A29({ onNav }) {
  const admins=[
    {name:"admin_kim",email:"kim@admin.ac.kr",tier:"T2",last:"2026-01-20",actions:342},
    {name:"admin_lee",email:"lee@admin.ac.kr",tier:"T1",last:"2026-01-20",actions:128},
    {name:"admin_park",email:"park@admin.ac.kr",tier:"T1",last:"2026-01-18",actions:89},
  ];
  return (
    <div className="content">
      <div className="row-between mb16" style={{marginBottom:16}}>
        <div className="sec-title">관리자 목록 ({admins.length}명)</div>
        <Btn v="secondary" s="sm" onClick={()=>onNav("A30")}>Tier 변경 [T2]</Btn>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>관리자</th><th>이메일</th><th>Tier</th><th>마지막 접속</th><th>총 액션 수</th><th>이력</th></tr></thead>
          <tbody>
            {admins.map((a,i)=>(
              <tr key={i}>
                <td><div style={{display:"flex",gap:8,alignItems:"center"}}><Av name={a.name[6]} size="xs"/>{a.name}</div></td>
                <td style={{color:TDS.textTertiary}}>{a.email}</td>
                <td><Badge t={a.tier==="T2"?"red":"blue"}>{a.tier}</Badge></td>
                <td style={{color:TDS.textTertiary}}>{a.last}</td>
                <td style={{fontWeight:600}}>{a.actions.toLocaleString()}</td>
                <td><Btn v="ghost" s="sm" onClick={()=>onNav("A31")}>이력</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* A30 Tier 변경 [T2] */

