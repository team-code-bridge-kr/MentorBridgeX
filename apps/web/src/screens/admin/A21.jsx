import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A21({ onNav }) {
  const logs=[
    {who:"관리자",ac:"user.suspend",tgt:"이수진 (teacher)",sv:"high",t:"15분 전"},
    {who:"admin_kim",ac:"user.list.read",tgt:"전체 목록",sv:"low",t:"1시간 전"},
    {who:"관리자",ac:"teacher.verify.approve",tgt:"김민준",sv:"medium",t:"2시간 전"},
    {who:"admin_lee",ac:"system.config.read",tgt:"ML 모델 설정",sv:"low",t:"3시간 전"},
    {who:"관리자",ac:"comment.force_delete",tgt:"코멘트 #4729",sv:"high",t:"어제"},
  ];
  const svType={high:"red",medium:"orange",low:"grey"};
  return (
    <div className="content">
      <div className="row-between mb16" style={{marginBottom:16}}>
        <div className="sec-title">감사 로그</div>
        <Btn v="ghost" s="sm" onClick={()=>onNav("A23")}>내보내기</Btn>
      </div>
      <div className="row g-12 mb16" style={{gap:12,marginBottom:16}}>
        <div className="search-wrap" style={{flex:1}}><span>🔍</span><input placeholder="관리자, 액션, 대상 검색..." /></div>
        <input className="inp" style={{width:200}} type="date" defaultValue="2026-06-02" />
        <select className="inp" style={{width:160}}>
          <option>모든 심각도</option><option>High</option><option>Medium</option><option>Low</option>
        </select>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>관리자</th><th>액션</th><th>대상</th><th>심각도</th><th>시각</th></tr></thead>
          <tbody>
            {logs.map((l,i)=>(
              <tr key={i} style={{cursor:"pointer"}} onClick={()=>onNav("A22")}>
                <td><div className="row g-8" style={{gap:8}}><Av name={l.who[0]} size="xs"/>{l.who}</div></td>
                <td><code style={{fontSize:12,background:TDS.bgTertiary,padding:"2px 6px",borderRadius:4}}>{l.ac}</code></td>
                <td style={{color:TDS.textSecondary}}>{l.tgt}</td>
                <td><Badge t={svType[l.sv]}>{l.sv}</Badge></td>
                <td style={{color:TDS.textTertiary}}>{l.t}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Admin 미구현 화면들 ── */

/* A03 사용자 상세 */

