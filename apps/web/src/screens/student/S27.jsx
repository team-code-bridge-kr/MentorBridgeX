import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function S27({ onNav }) {
  const [q, setQ] = useState(""); const [tab, setTab] = useState("전체");
  const results=[
    {type:"노드",ic:"🔵",t:"양자컴퓨팅",d:"물리학 > 양자역학 하위 노드 · 8개 연결",url:"S07"},
    {type:"텍스트",ic:"📄",t:"세부능력 및 특기사항",d:"1,240자 · 마지막 수정 3일 전",url:"S12"},
    {type:"음성",ic:"🎙️",t:"화학 세특 토론 녹음",d:"2026.05.10 · 1시간 23분",url:"S17"},
    {type:"코멘트",ic:"💬",t:"김선생님 코멘트",d:"양자컴퓨팅 노드 관련 · 10분 전",url:"S24"},
  ];
  return (
    <div className="content" style={{maxWidth:720,margin:"0 auto"}}>
      <div className="sec-title mb16" style={{marginBottom:16}}>통합 검색</div>
      <div className="search-wrap mb20" style={{marginBottom:20,height:52,fontSize:16}}>
        <span style={{fontSize:18}}><TFI s={18} color={TDS.textTertiary}>🔍</TFI></span>
        <input style={{fontSize:16}} placeholder="노드, 문서, 보고서, 코멘트 검색..." value={q} onChange={e=>setQ(e.target.value)} autoFocus />
      </div>
      <div className="tab-bar mb20" style={{marginBottom:20}}>
        {["전체","노드","텍스트","음성","코멘트"].map(t=>(
          <div key={t} className={`tab-item${tab===t?" active":""}`} onClick={()=>setTab(t)}>{t}</div>
        ))}
      </div>
      {results.filter(r=>tab==="전체"||r.type===tab).map((r,i)=>(
        <div key={i} className="list-row" style={{cursor:"pointer"}} onClick={()=>onNav(r.url)}>
          <div style={{fontSize:24}}><TFI s={24} color={TDS.textSecondary}>{r.ic}</TFI></div>
          <div className="list-row-left">
            <div className="list-row-title">{r.t}</div>
            <div className="list-row-sub">{r.d}</div>
          </div>
          <Badge t="grey">{r.type}</Badge>
        </div>
      ))}
    </div>
  );
}

/* S28 통계 */

