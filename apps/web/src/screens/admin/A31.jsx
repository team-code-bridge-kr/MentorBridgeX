import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A31({ onNav }) {
  const logs=[
    {action:"user.suspend","target":"이수진",sv:"high",time:"2026-01-20 15:43"},
    {action:"teacher.verify.approve",target:"김민준",sv:"medium",time:"2026-01-20 11:22"},
    {action:"user.list.read",target:"전체 조회",sv:"low",time:"2026-01-20 09:15"},
    {action:"audit.log.export",target:"7일 로그",sv:"medium",time:"2026-01-19 16:44"},
    {action:"system.config.read",target:"ML 설정",sv:"low",time:"2026-01-19 14:30"},
  ];
  return (
    <div className="content">
      <div className="sec-title mb16" style={{marginBottom:16}}>본인 활동 이력</div>
      <div className="card card-p">
        <div style={{fontSize:13,color:TDS.textTertiary,marginBottom:12}}>현재 세션 관리자: admin_kim · Tier 2</div>
        {logs.map((l,i)=>(
          <div key={i} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:i<logs.length-1?`1px solid ${TDS.bgTertiary}`:"none"}}>
            <code style={{fontSize:11,color:TDS.blue500,flexShrink:0,background:TDS.blue50,padding:"2px 6px",borderRadius:4,alignSelf:"flex-start"}}>{l.action}</code>
            <div style={{flex:1,fontSize:13,color:TDS.textSecondary}}>{l.target}</div>
            <Badge t={l.sv==="high"?"red":l.sv==="medium"?"orange":"grey"} style={{flexShrink:0}}>{l.sv}</Badge>
            <div style={{fontSize:11,color:TDS.textDisabled,flexShrink:0,minWidth:120,textAlign:"right"}}>{l.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* A32 디버깅 신청 (5단계) */

