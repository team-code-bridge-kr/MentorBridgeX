import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function S15({ onNav }) {
  const sessions=[
    {id:1,t:"화학 세특 토론 녹음",date:"2026.05.10",dur:"1시간 23분",st:"완료",ppl:5},
    {id:2,t:"물리 실험 발표 준비",date:"2026.05.08",dur:"45분",st:"검토 대기",ppl:3},
    {id:3,t:"동아리 활동 회의",date:"2026.05.06",dur:"2시간 10분",st:"완료",ppl:8},
    {id:4,t:"진로 상담 녹음",date:"2026.05.03",dur:"32분",st:"완료",ppl:2},
  ];
  const stType={완료:"green","검토 대기":"orange"};
  return (
    <div className="content">
      <div className="row-between mb24" style={{marginBottom:24}}>
        <div><div className="sec-title">음성 활동 기록</div><div className="sec-sub">녹음 세션을 관리하고 STT 결과를 확인하세요</div></div>
        <Btn v="primary" onClick={()=>onNav("S16")}><TFI>🎙️</TFI> 새 녹음 시작</Btn>
      </div>
      {sessions.map(s=>(
        <div key={s.id} className="sess-card">
          <div className="sess-icon" style={{background:s.st==="검토 대기"?TDS.warningBg:TDS.blue50}}><TFI s={20} color={s.st==="검토 대기"?TDS.warning:TDS.blue500}>{s.st==="검토 대기"?"⏳":"🎙️"}</TFI></div>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:600,color:TDS.textPrimary,marginBottom:4}}>{s.t}</div>
            <div style={{fontSize:13,color:TDS.textTertiary}}>{s.date} · {s.dur} · 참여자 {s.ppl}명</div>
          </div>
          <Badge t={stType[s.st]||"grey"}>{s.st}</Badge>
          {s.st==="검토 대기"
            ?<Btn v="primary" s="sm" onClick={()=>onNav("S17")}>검토하기</Btn>
            :<Btn v="secondary" s="sm" onClick={()=>onNav("S17")}>보기</Btn>}
        </div>
      ))}
    </div>
  );
}

/* S16 녹음 중 */

