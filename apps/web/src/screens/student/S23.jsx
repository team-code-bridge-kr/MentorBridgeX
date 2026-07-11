import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function S23({ onNav }) {
  const [decisions,setDecisions]=useState({});
  const recs=[
    {id:0,node:"단순 암기",reason:"연결 수 1개 · 가중치 0.21 · 비활성",action:"삭제"},
    {id:1,node:"참고문헌 A",reason:"중복 노드 감지 (참고문헌 B와 유사도 0.94)",action:"병합"},
    {id:2,node:"미분방정식",reason:"연결 수 0개 · 고아 노드",action:"삭제"},
    {id:3,node:"물리실험 1",reason:"6개월 이상 비활성",action:"아카이브"},
  ];
  const decide=(id,v)=>setDecisions({...decisions,[id]:v});
  return (
    <div className="content" style={{maxWidth:700,margin:"0 auto"}}>
      <div style={{fontSize:22,fontWeight:700,marginBottom:6}}>가지치기 추천</div>
      <div style={{fontSize:14,color:TDS.textTertiary,marginBottom:16}}>ML이 정리를 추천한 노드 {recs.length}개</div>
      <Notice type="warning" style={{marginBottom:20}}>삭제된 노드는 30일 안에 복구할 수 있습니다.</Notice>
      <div className="card card-p" style={{marginBottom:16}}>
        {recs.map((r,i)=>(
          <div key={r.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:i<recs.length-1?`1px solid ${TDS.bgTertiary}`:"none",opacity:decisions[r.id]?0.5:1}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                <div style={{fontWeight:600,fontSize:14}}>{r.node}</div>
                <div style={{padding:"2px 8px",background:r.action==="삭제"?TDS.dangerBg:r.action==="병합"?TDS.blue50:TDS.warningBg,borderRadius:10,fontSize:11,fontWeight:600,color:r.action==="삭제"?TDS.danger:r.action==="병합"?TDS.blue500:TDS.warning}}>{r.action} 추천</div>
              </div>
              <div style={{fontSize:12,color:TDS.textTertiary}}>{r.reason}</div>
            </div>
            {decisions[r.id]
              ? <div style={{fontSize:12,color:TDS.textTertiary}}>{decisions[r.id]}</div>
              : <div style={{display:"flex",gap:6}}>
                  <Btn v={r.action==="삭제"?"danger":"primary"} s="sm" onClick={()=>decide(r.id,"채택")}>{r.action}</Btn>
                  <Btn v="ghost" s="sm" onClick={()=>decide(r.id,"거부")}>거부</Btn>
                </div>
            }
          </div>
        ))}
      </div>
      <Btn v="primary" s="md" fw onClick={()=>onNav("S06")}>그래프에 반영</Btn>
    </div>
  );
}

/* S26 피드 */

