import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A16({ onNav }) {
  const [step,setStep]=useState(0);
  const [sel,setSel]=useState("bge-m3");
  return (
    <div className="content" style={{maxWidth:640,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("A15")}>← 목록</button>
        <div style={{fontSize:20,fontWeight:700}}>임베딩 모델 교체</div>
      </div>
      <Notice type="warning" style={{marginBottom:20}}>모델 교체 후 전체 노드 재임베딩이 수행됩니다. 처리 시간: 약 2~4시간 (노드 10만개 기준)</Notice>
      {step===0&&(
        <div className="card card-p">
          <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>새 모델 선택</div>
          {[{name:"bge-m3",provider:"BAAI",dim:1024,note:"다국어 지원, 빠른 추론"},
            {name:"text-embedding-3-small",provider:"OpenAI",dim:1536,note:"고품질, OpenAI API 필요"}].map(m=>(
            <div key={m.name} onClick={()=>setSel(m.name)} style={{padding:"12px",borderRadius:8,border:`1px solid ${sel===m.name?TDS.blue500:TDS.borderDefault}`,background:sel===m.name?TDS.blue50:"transparent",marginBottom:8,cursor:"pointer"}}>
              <div style={{fontWeight:600,fontSize:14}}>{m.name}</div>
              <div style={{fontSize:12,color:TDS.textTertiary}}>{m.provider} · {m.dim}차원 · {m.note}</div>
            </div>
          ))}
          <Btn v="primary" s="md" fw style={{marginTop:12}} onClick={()=>setStep(1)}>교체 시작</Btn>
        </div>
      )}
      {step===1&&(
        <div className="card card-p" style={{textAlign:"center",padding:"40px"}}>
          <div style={{marginBottom:16}}><TFI s={40} color={TDS.textTertiary}>⚙</TFI></div>
          <div style={{fontSize:18,fontWeight:700,marginBottom:8}}>재임베딩 진행 중</div>
          <div style={{height:8,background:TDS.bgTertiary,borderRadius:4,marginBottom:12,overflow:"hidden"}}><div style={{height:"100%",width:"34%",background:TDS.blue500,borderRadius:4,animation:"none"}} /></div>
          <div style={{fontSize:13,color:TDS.textTertiary}}>34% 완료 · 34,201 / 100,000 노드</div>
          <Btn v="secondary" s="sm" style={{marginTop:16}} onClick={()=>onNav("A15")}>백그라운드에서 계속</Btn>
        </div>
      )}
    </div>
  );
}

/* A17 시스템 공지 목록 */

