import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A25({ onNav }) {
  const [adding,setAdding]=useState(false);
  const semesters=[
    {id:"S-2026-1",name:"2026년 1학기",start:"2026-03-01",end:"2026-08-31",subjects:8},
    {id:"S-2025-2",name:"2025년 2학기",start:"2025-09-01",end:"2026-02-28",subjects:12},
  ];
  return (
    <div className="content">
      <div className="row-between mb16" style={{marginBottom:16}}>
        <div className="sec-title">학기·과목 마스터</div>
        <Btn v="primary" s="sm" onClick={()=>setAdding(!adding)}>+ 추가</Btn>
      </div>
      {adding&&(
        <div className="card card-p" style={{marginBottom:16,border:`1px solid ${TDS.blue500}`}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div className="inp-group"><label className="inp-label">학기명</label><input className="inp" placeholder="2026년 2학기" /></div>
            <div className="inp-group"><label className="inp-label">과목 수</label><input className="inp" type="number" placeholder="10" /></div>
            <div className="inp-group"><label className="inp-label">시작일</label><input className="inp" type="date" /></div>
            <div className="inp-group"><label className="inp-label">종료일</label><input className="inp" type="date" /></div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn v="secondary" s="sm" onClick={()=>setAdding(false)}>취소</Btn>
            <Btn v="primary" s="sm">저장</Btn>
          </div>
        </div>
      )}
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>ID</th><th>학기명</th><th>시작</th><th>종료</th><th>과목 수</th><th>수정</th></tr></thead>
          <tbody>
            {semesters.map((s,i)=>(
              <tr key={i}>
                <td><code style={{fontSize:11}}>{s.id}</code></td>
                <td style={{fontWeight:500}}>{s.name}</td>
                <td style={{color:TDS.textTertiary}}>{s.start}</td>
                <td style={{color:TDS.textTertiary}}>{s.end}</td>
                <td><Badge t="blue">{s.subjects}개</Badge></td>
                <td><Btn v="ghost" s="sm">편집</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* A26 양식 템플릿 마스터 */

