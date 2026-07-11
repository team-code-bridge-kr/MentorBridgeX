import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A14({ onNav }) {
  const metrics=[
    {label:"일평균 API 요청",value:"247,832",trend:"+12%",color:TDS.blue500},
    {label:"P95 응답 시간",value:"142ms",trend:"-8ms",color:TDS.success},
    {label:"에러율",value:"0.03%",trend:"-0.01%",color:TDS.success},
    {label:"동시 활성 사용자",value:"1,284",trend:"+87",color:TDS.blue500},
    {label:"ML 처리 대기열",value:"23개",trend:"+5",color:TDS.warning},
    {label:"스토리지 사용량",value:"2.4 TB / 10 TB",trend:"+0.1 TB",color:TDS.textPrimary},
  ];
  const endpoints=[
    {path:"/v1/graph/nodes",rps:824,p95:"89ms",err:"0.01%"},
    {path:"/v1/voice/sessions",rps:312,p95:"234ms",err:"0.05%"},
    {path:"/v1/format/generate",rps:156,p95:"1.2s",err:"0.12%"},
    {path:"/v1/auth/login",rps:89,p95:"320ms",err:"0.08%"},
  ];
  return (
    <div className="content">
      <div className="sec-title mb16" style={{marginBottom:16}}>운영 메트릭</div>
      <div className="grid4 mb24" style={{marginBottom:24}}>
        {metrics.map(m=>(
          <div key={m.label} className="card card-p" style={{position:"relative"}}>
            <div style={{fontSize:12,color:TDS.textTertiary,marginBottom:6}}>{m.label}</div>
            <div style={{fontSize:22,fontWeight:700,color:m.color}}>{m.value}</div>
            <div style={{fontSize:11,color:m.trend.startsWith("-")||m.trend==="0.01%"?TDS.success:TDS.warning,marginTop:4}}>{m.trend}</div>
          </div>
        ))}
      </div>
      <div className="card card-p mb24" style={{marginBottom:24}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>엔드포인트별 트래픽</div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>엔드포인트</th><th>RPS</th><th>P95</th><th>에러율</th></tr></thead>
            <tbody>
              {endpoints.map((e,i)=>(
                <tr key={i}>
                  <td><code style={{fontSize:11}}>{e.path}</code></td>
                  <td style={{fontWeight:600}}>{e.rps}</td>
                  <td style={{color:parseInt(e.p95)>500?TDS.warning:TDS.success}}>{e.p95}</td>
                  <td><Badge t={parseFloat(e.err)>0.1?"orange":"grey"}>{e.err}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* A15 임베딩 모델 목록 */

