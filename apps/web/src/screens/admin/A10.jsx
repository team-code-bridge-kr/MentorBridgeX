import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A10({ onNav }) {
  const comments=[
    {id:"C-4729",author:"박교사",content:"이 정도 수준으로는...",reports:3,status:"검토 중"},
    {id:"C-4401",author:"김학생",content:"스팸 메시지입니다",reports:1,status:"검토 중"},
    {id:"C-4110",author:"이강사",content:"개인 연락처가 포함된...",reports:2,status:"삭제됨"},
  ];
  return (
    <div className="content">
      <div className="row-between mb16" style={{marginBottom:16}}>
        <div className="sec-title">신고된 코멘트</div>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>코멘트 ID</th><th>작성자</th><th>내용 (발췌)</th><th>신고 수</th><th>상태</th><th>처리</th></tr></thead>
          <tbody>
            {comments.map((c,i)=>(
              <tr key={i}>
                <td><code style={{fontSize:11}}>{c.id}</code></td>
                <td>{c.author}</td>
                <td style={{color:TDS.textSecondary,fontSize:12,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.content}</td>
                <td><Badge t="red">{c.reports}건</Badge></td>
                <td><Badge t={c.status==="삭제됨"?"grey":"orange"}>{c.status}</Badge></td>
                <td><Btn v={c.status==="삭제됨"?"ghost":"danger"} s="sm" disabled={c.status==="삭제됨"} onClick={()=>onNav("A11")}>삭제 확인</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* A11 코멘트 강제 삭제 확인 */

