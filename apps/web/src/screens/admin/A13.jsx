import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A13({ onNav }) {
  const services=[
    {n:"API 서버",st:"정상",c:TDS.success,up:"99.98%",resp:"142ms",req:"48,291"},
    {n:"ML 파이프라인",st:"정상",c:TDS.success,up:"99.95%",resp:"8.3s",req:"1,203"},
    {n:"STT 서버",st:"정상",c:TDS.success,up:"99.90%",resp:"2.1s",req:"342"},
    {n:"Redis 캐시",st:"경고",c:TDS.warning,up:"99.82%",resp:"0.8ms",req:"892K"},
    {n:"PostgreSQL",st:"정상",c:TDS.success,up:"100%",resp:"12ms",req:"128K"},
    {n:"임베딩 모델",st:"정상",c:TDS.success,up:"99.97%",resp:"1.2s",req:"892"},
  ];
  return (
    <div className="content">
      <Notice type="success" className="mb24"><TFI>✅</TFI> 모든 시스템 정상 운영 중 · 마지막 확인: 2026.06.02 15:47:23</Notice>
      <div className="grid3 g-16 mb24" style={{gap:16,marginBottom:24}}>
        {services.map(sv=>(
          <Card key={sv.n}>
            <div className="row g-8 mb12" style={{gap:8,marginBottom:12}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:sv.c}} />
              <span style={{fontSize:15,fontWeight:700}}>{sv.n}</span>
              <Badge t={sv.st==="정상"?"green":"orange"}>{sv.st}</Badge>
            </div>
            <div className="grid3 g-8" style={{gap:8}}>
              {[["업타임",sv.up],["응답",sv.resp],["오늘",sv.req]].map(([l,v])=>(
                <div key={l}><div style={{fontSize:10,color:TDS.textTertiary}}>{l}</div><div style={{fontSize:13,fontWeight:700}}>{v}</div></div>
              ))}
            </div>
            <div className="prog-wrap mt12" style={{marginTop:12}}>
              <div className="prog-fill" style={{width:sv.st==="경고"?"78%":"95%",background:sv.c}} />
            </div>
          </Card>
        ))}
      </div>
      <Card>
        <div className="card-hdr"><div className="card-title">시스템 로그</div><Btn v="ghost" s="sm" onClick={()=>onNav("A21")}>감사 로그 →</Btn></div>
        {[["INFO","API","GET /v1/students/me/graph — 142ms"],["WARN","Redis","메모리 사용량 75% 초과 경보"],["INFO","ML","양자컴퓨팅 시드 처리 완료"],["ERROR","DB","Connection pool exhausted — retrying..."]].map(([lv,svc,msg],i)=>(
          <div key={i} className="log-item">
            <span className={`log-lv log-${lv==="INFO"?"info":lv==="WARN"?"warn":"error"}`}>{lv}</span>
            <span style={{color:TDS.blue500,fontWeight:600}}>[{svc}]</span>
            <span style={{color:TDS.textSecondary}}>{msg}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

