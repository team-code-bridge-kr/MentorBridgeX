import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { Back, TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function S10({ onNav }) {
  const logs=[
    {icon:"🟢",t:"노드 생성",d:'"양자컴퓨팅" 노드 자동 생성 (ML)',time:"2026-01-20 14:32"},
    {icon:"🔵",t:"엣지 추가",d:"양자컴퓨팅 → 큐비트 연결 생성",time:"2026-01-20 14:32"},
    {icon:"✏️",t:"노드 수정",d:'"물리학" 가중치 0.80 → 0.92',time:"2026-01-18 10:15"},
    {icon:"🗑️",t:"노드 삭제",d:'"쇼어 알고리즘" 거부 (가지치기)',time:"2026-01-17 16:44"},
    {icon:"📄",t:"PDF 파싱",d:"학교생활기록부.pdf 노드 12개 생성",time:"2026-01-15 09:20"},
    {icon:"🎙️",t:"음성 반영",d:"물리 토론 녹음 노드 5개 반영",time:"2026-01-12 11:00"},
  ];
  return (
    <div className="content" style={{maxWidth:700,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <Back onClick={()=>onNav("S06")} label="그래프" />
        <div style={{fontSize:20,fontWeight:700}}>그래프 변경 이력</div>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {["전체","노드","엣지","ML","수동"].map(f=><Btn key={f} v={f==="전체"?"primary":"secondary"} s="sm">{f}</Btn>)}
      </div>
      <div className="card card-p">
        {logs.map((l,i)=>(
          <div key={i} style={{display:"flex",gap:14,padding:"12px 0",borderBottom:i<logs.length-1?`1px solid ${TDS.bgTertiary}`:"none"}}>
            <div style={{fontSize:20,flexShrink:0,marginTop:2}}><TFI s={20} color={TDS.textSecondary}>{l.icon}</TFI></div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14,color:TDS.textPrimary,marginBottom:3}}>{l.t}</div>
              <div style={{fontSize:13,color:TDS.textSecondary}}>{l.d}</div>
            </div>
            <div style={{fontSize:11,color:TDS.textDisabled,flexShrink:0,textAlign:"right",lineHeight:1.4}}>{l.time.split(" ")[0]}<br/>{l.time.split(" ")[1]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* S13 PDF 업로드 */

