import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function S19({ onNav }) {
  const [decisions, setDecisions] = useState({});
  const proposals=[
    {id:0,from:"보고서",node:"양자역학",rel:"관련",score:0.95},
    {id:1,from:"보고서",node:"슈뢰딩거 방정식",rel:"하위 개념",score:0.91},
    {id:2,from:"보고서",node:"코펜하겐 해석",rel:"이론",score:0.88},
    {id:3,from:"보고서",node:"다세계 해석",rel:"이론",score:0.82},
    {id:4,from:"보고서",node:"파동 함수 붕괴",rel:"관련",score:0.79},
  ];
  const decide=(id,v)=>setDecisions({...decisions,[id]:v});
  const pending = proposals.filter(p=>!decisions[p.id]);
  return (
    <div className="content" style={{maxWidth:700,margin:"0 auto"}}>
      <div style={{fontSize:22,fontWeight:700,marginBottom:6}}>그래프 매칭 제안</div>
      <div style={{fontSize:14,color:TDS.textTertiary,marginBottom:20}}>ML이 분석한 {proposals.length}개 제안 · 미결정 {pending.length}개</div>
      <div className="card card-p" style={{marginBottom:16}}>
        {proposals.map((p,i)=>(
          <div key={p.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:i<proposals.length-1?`1px solid ${TDS.bgTertiary}`:"none",opacity:decisions[p.id]?0.5:1}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <div style={{fontWeight:600,fontSize:14}}>{p.node}</div>
                <div style={{padding:"2px 8px",background:TDS.bgTertiary,borderRadius:10,fontSize:11,color:TDS.textTertiary}}>{p.rel}</div>
                <div style={{fontSize:11,color:TDS.textTertiary,marginLeft:"auto"}}>신뢰도 {Math.round(p.score*100)}%</div>
              </div>
              <div style={{fontSize:11,color:TDS.textTertiary}}>{p.from} → 그래프 노드</div>
            </div>
            {decisions[p.id]
              ? <div style={{padding:"4px 12px",borderRadius:20,fontSize:12,fontWeight:600,background:decisions[p.id]==="accept"?TDS.successBg:TDS.dangerBg,color:decisions[p.id]==="accept"?TDS.success:TDS.danger}}>{decisions[p.id]==="accept"?"채택":"거부"}</div>
              : <div style={{display:"flex",gap:6}}>
                  <Btn v="primary" s="sm" onClick={()=>decide(p.id,"accept")}>채택</Btn>
                  <Btn v="danger" s="sm" onClick={()=>decide(p.id,"reject")}>거부</Btn>
                </div>
            }
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:8}}>
        <Btn v="secondary" s="md" fw onClick={()=>onNav("S17")}>이전</Btn>
        <Btn v="primary" s="md" fw onClick={()=>onNav("S06")}>그래프에 반영</Btn>
      </div>
    </div>
  );
}

/* S21 양식 결과물 목록 */

