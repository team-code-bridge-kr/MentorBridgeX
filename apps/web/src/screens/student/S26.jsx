import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function S26({ onNav }) {
  const feed=[
    {type:"node",icon:"🟢",t:"노드 생성","d":'"양자컴퓨팅" 노드를 생성했습니다',time:"5분 전"},
    {type:"comment",icon:"💬",t:"코멘트 수신",d:"김선생님이 코멘트를 남겼습니다",time:"1시간 전"},
    {type:"doc",icon:"📄",t:"텍스트 수정",d:"세특 물리학 영역을 수정했습니다",time:"3시간 전"},
    {type:"voice",icon:"🎙️",t:"음성 녹음",d:"물리 토론 세션 (48분)을 완료했습니다",time:"어제"},
    {type:"form",icon:"📝",t:"양식 생성",d:"화학과 자기소개서를 생성했습니다",time:"2일 전"},
    {type:"node",icon:"🗑️",t:"노드 삭제",d:'"단순 암기" 노드를 삭제했습니다 (가지치기)',time:"3일 전"},
    {type:"pdf",icon:"📎",t:"PDF 업로드",d:"학교생활기록부.pdf를 업로드했습니다",time:"5일 전"},
  ];
  return (
    <div className="content" style={{maxWidth:600,margin:"0 auto"}}>
      <div style={{fontSize:20,fontWeight:700,marginBottom:20}}>활동 피드</div>
      <div className="card card-p">
        {feed.map((f,i)=>(
          <div key={i} style={{display:"flex",gap:14,padding:"14px 0",borderBottom:i<feed.length-1?`1px solid ${TDS.bgTertiary}`:"none"}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:TDS.bgTertiary,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}><TFI s={18} color={TDS.textSecondary}>{f.icon}</TFI></div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14,color:TDS.textPrimary,marginBottom:3}}>{f.t}</div>
              <div style={{fontSize:13,color:TDS.textSecondary}}>{f.d}</div>
            </div>
            <div style={{fontSize:11,color:TDS.textDisabled,flexShrink:0}}>{f.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* S29 내보내기 작업 */

