import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { Back, TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A22({ onNav }) {
  const log={id:"AL-2026012015432",who:"관리자",action:"user.suspend",target:"이수진 (U-1024)",severity:"high",time:"2026-01-20 15:43:21",ip:"192.168.1.1",reason:"반복적 불량 코멘트 작성",traceId:"01HXY2KQNPZ..."};
  return (
    <div className="content" style={{maxWidth:640,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <Back onClick={()=>onNav("A21")} label="감사 로그" />
        <div style={{fontSize:20,fontWeight:700}}>감사 로그 상세</div>
      </div>
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
          <code style={{fontSize:12,background:TDS.bgTertiary,padding:"4px 8px",borderRadius:4}}>{log.id}</code>
          <Badge t="red">{log.severity}</Badge>
        </div>
        {[
          ["액션",log.action],["실행자",log.who],["대상",log.target],["시각",log.time],
          ["IP",log.ip],["사유",log.reason],["Trace ID",log.traceId],
        ].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${TDS.bgTertiary}`,fontSize:13}}>
            <span style={{color:TDS.textTertiary,minWidth:80}}>{k}</span>
            <span style={{fontFamily:k==="액션"||k==="Trace ID"||k==="IP"?"monospace":"inherit",fontSize:k==="액션"||k==="Trace ID"?11:13,color:TDS.textPrimary,textAlign:"right"}}>{v}</span>
          </div>
        ))}
      </div>
      <div className="card card-p">
        <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>Raw 페이로드</div>
        <pre style={{fontSize:11,background:TDS.bgSecondary,padding:"12px",borderRadius:8,overflow:"auto",color:TDS.textSecondary}}>{JSON.stringify({action:log.action,target_id:"U-1024",reason:log.reason,severity:log.severity,timestamp:"2026-01-20T15:43:21Z"},null,2)}</pre>
      </div>
    </div>
  );
}

/* A23 감사 로그 내보내기 */

