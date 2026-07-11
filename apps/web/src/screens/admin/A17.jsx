import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A17({ onNav }) {
  const { state, actions } = useStore();
  const notices = state.announcements;
  useEffect(()=>{ if(!notices.length) actions.loadAnnouncements(); /* eslint-disable-next-line */ }, []);
  const fmt = ts => ts ? new Date(ts).toISOString().slice(0,10) : "—";
  return (
    <div className="content">
      <div className="row-between mb16" style={{marginBottom:16}}>
        <div className="sec-title">시스템 공지 목록 ({notices.length})</div>
        <Btn v="primary" s="sm" onClick={()=>onNav("A18")}>+ 새 공지</Btn>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>ID</th><th>제목</th><th>대상</th><th>발행일</th><th>상태</th><th>수정</th></tr></thead>
          <tbody>
            {notices.map((n)=>(
              <tr key={n.id}>
                <td><code style={{fontSize:11}}>{n.id}</code></td>
                <td style={{fontWeight:500}}>{n.title}</td>
                <td style={{color:TDS.textTertiary}}>{n.target}</td>
                <td style={{color:TDS.textTertiary}}>{fmt(n.publishedAt)}</td>
                <td><Badge t={n.status==="발행됨"?"blue":n.status==="예약됨"?"orange":"grey"}>{n.status}</Badge></td>
                <td><Btn v="ghost" s="sm" onClick={()=>onNav("A18")}>편집</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* A18 공지 발행·편집 */

