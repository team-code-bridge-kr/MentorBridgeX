import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A08({ onNav }) {
  const { state, actions } = useStore();
  useEffect(()=>{ if(!state.reports.length) actions.loadReports(); /* eslint-disable-next-line */ }, []);

  // store 신고(학생이 S24에서 신고한 것 포함) → 표 행으로 정규화
  const rows = state.reports.map(r=>({
    id:r.id,
    type:r.reason || r.type || "신고",
    reporter:r.reporter || "학생",
    target:r.content ? `${r.author||""}의 코멘트: "${(r.content||"").slice(0,20)}…"` : (r.target||"—"),
    date:r.date || new Date().toISOString().slice(0,10),
    priority:r.priority || (String(r.reason||"").includes("개인정보")?"high":"medium"),
    status:r.status || "검토 중",
  }));
  const highCount = rows.filter(r=>r.priority==="high").length;

  return (
    <div className="content">
      <div className="row-between mb16" style={{marginBottom:16}}>
        <div className="sec-title">신고 큐 ({rows.length}건)</div>
        <div style={{display:"flex",gap:8}}>
          {highCount>0 && <Badge t="red">고우선순위 {highCount}건</Badge>}
        </div>
      </div>
      {!rows.length && <div style={{textAlign:"center",padding:"48px 0",color:TDS.textTertiary,fontSize:14}}>처리할 신고가 없습니다</div>}
      {!!rows.length && (
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>신고 ID</th><th>유형</th><th>신고자</th><th>대상</th><th>신고일</th><th>우선순위</th><th>상태</th><th>처리</th></tr></thead>
          <tbody>
            {rows.map((r)=>(
              <tr key={r.id}>
                <td><code style={{fontSize:11}}>{r.id}</code></td>
                <td><Badge t={String(r.type).includes("개인정보")?"red":"grey"}>{r.type}</Badge></td>
                <td style={{color:TDS.textSecondary}}>{r.reporter}</td>
                <td style={{color:TDS.textTertiary,fontSize:12}}>{r.target}</td>
                <td style={{color:TDS.textTertiary}}>{r.date}</td>
                <td><Badge t={r.priority==="high"?"red":"orange"}>{r.priority}</Badge></td>
                <td><Badge t={r.status==="처리됨"?"green":"grey"}>{r.status}</Badge></td>
                <td>
                  {r.status==="처리됨"
                    ? <span style={{fontSize:12,color:TDS.textTertiary}}>완료</span>
                    : <Btn v="primary" s="sm" onClick={()=>actions.resolveReport(r.id,"처리")}>처리</Btn>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

/* A09 신고 상세·처리 */

