import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function S16({ onNav }) {
  const [sec, setSec] = useState(347);
  useEffect(()=>{const t=setInterval(()=>setSec(s=>s+1),1000);return()=>clearInterval(t);},[]);
  const fmt2=s=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  return (
    <div className="content" style={{maxWidth:720,margin:"0 auto"}}>
      <Notice type="danger"><TFI>🔴</TFI> 녹음 중입니다. 종료하기 전에 저장하세요.</Notice>
      <Card className="mb24" style={{marginBottom:24,textAlign:"center"}}>
        <div style={{fontSize:13,color:TDS.textTertiary,marginBottom:8}}>녹음 중</div>
        <div style={{fontSize:56,fontWeight:800,color:TDS.danger,fontVariantNumeric:"tabular-nums",marginBottom:24}}>{fmt2(sec)}</div>
        <div className="row g-12" style={{gap:12,justifyContent:"center"}}>
          <Btn v="secondary" s="md">⏸️ 일시정지</Btn>
          <Btn v="danger" s="md" onClick={()=>onNav("S17")}>⏹️ 종료 및 저장</Btn>
        </div>
      </Card>
      <Card>
        <div style={{fontSize:16,fontWeight:700,marginBottom:16}}>STT 실시간 결과</div>
        <div style={{background:TDS.bgTertiary,borderRadius:10,padding:16,minHeight:180,fontSize:15,lineHeight:1.8,color:TDS.textSecondary}}>
          <span style={{color:TDS.textPrimary}}>오늘은 양자컴퓨팅의 기본 원리에 대해 이야기해 보겠습니다. 큐비트는 기존 비트와 달리 0과 1의 중첩 상태를 가질 수 있습니다...</span>
          <span style={{color:TDS.blue400}}> 이러한 특성 덕분에 양자컴퓨터는 특정 문제에서 고전 컴퓨터보다 훨씬 빠른 속도로 계산을 수행할 수 있습니다</span>
          <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
          <span style={{animation:"blink 1s infinite",color:TDS.blue500}}>█</span>
        </div>
      </Card>
    </div>
  );
}

/* S20 양식 템플릿 */

