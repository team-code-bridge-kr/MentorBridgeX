import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A06({ onNav }) {
  const { state, actions } = useStore();
  const mockQueue=[
    {id:"tapp_m1",name:"김선생",school:"○○고",subject:"물리학",submittedAt:Date.parse("2026-01-20"),docs:2,status:"검토 중"},
    {id:"tapp_m2",name:"박교사",school:"△△고",subject:"수학",submittedAt:Date.parse("2026-01-19"),docs:2,status:"검토 중"},
    {id:"tapp_m3",name:"이강사",school:"□□중",subject:"화학",submittedAt:Date.parse("2026-01-18"),docs:1,status:"검토 중"},
  ];
  // store 신청(교사가 T01에서 제출한 것) 우선 + 목업 큐
  const queue = [...state.teacherApplications, ...mockQueue];
  const pending = queue.filter(q=>q.status==="검토 중").length;
  return (
    <div className="content">
      <div className="row-between mb16" style={{marginBottom:16}}>
        <div className="sec-title">교사 자격 검증 큐 ({pending}건 대기)</div>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>신청자</th><th>소속</th><th>교과목</th><th>신청일</th><th>서류</th><th>상태</th><th>처리</th></tr></thead>
          <tbody>
            {queue.map((q)=>(
              <tr key={q.id}>
                <td><div style={{display:"flex",gap:8,alignItems:"center"}}><Av name={(q.name||"?")[0]} size="xs"/>{q.name}</div></td>
                <td style={{color:TDS.textSecondary}}>{q.school}</td>
                <td style={{color:TDS.textSecondary}}>{q.subject}</td>
                <td style={{color:TDS.textTertiary}}>{q.submittedAt?new Date(q.submittedAt).toISOString().slice(0,10):"—"}</td>
                <td><Badge t="blue">{q.docs||1}개</Badge></td>
                <td><Badge t={q.status==="승인됨"?"green":q.status==="반려됨"?"red":"orange"}>{q.status}</Badge></td>
                <td>
                  {q.status==="검토 중" ? (
                    <div className="row g-8" style={{gap:6}}>
                      <Btn v="primary" s="sm" onClick={()=>actions.approveTeacherApp(q.id,true)}>승인</Btn>
                      <Btn v="secondary" s="sm" style={{color:TDS.danger}} onClick={()=>actions.approveTeacherApp(q.id,false)}>반려</Btn>
                    </div>
                  ) : <span style={{fontSize:12,color:TDS.textTertiary}}>완료</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* A07 교사 자격 상세 검토 */

