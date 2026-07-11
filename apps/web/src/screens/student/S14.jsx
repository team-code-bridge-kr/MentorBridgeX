import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function S14({ onNav }) {
  const [sel, setSel] = useState(new Set([0,1,2,3]));
  const nodes=[
    {id:0,label:"양자역학",type:"개념",src:"세특 물리학 1p"},
    {id:1,label:"슈뢰딩거 방정식",type:"수식",src:"세특 물리학 2p"},
    {id:2,label:"전자기유도",type:"개념",src:"세특 물리학 3p"},
    {id:3,label:"광전효과",type:"개념",src:"세특 물리학 3p"},
    {id:4,label:"맥스웰",type:"인물",src:"세특 물리학 4p"},
  ];
  const toggle = id => { const s=new Set(sel); s.has(id)?s.delete(id):s.add(id); setSel(s); };
  return (
    <div className="content" style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{fontSize:22,fontWeight:700,marginBottom:6}}>PDF 파싱 결과 검토</div>
      <div style={{fontSize:14,color:TDS.textTertiary,marginBottom:20}}>파싱된 노드 {nodes.length}개를 확인하고 반영할 항목을 선택하세요</div>
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:600,color:TDS.textPrimary}}>{sel.size}/{nodes.length}개 선택</div>
          <div style={{display:"flex",gap:8}}>
            <Btn v="ghost" s="sm" onClick={()=>setSel(new Set(nodes.map(n=>n.id)))}>전체 선택</Btn>
            <Btn v="ghost" s="sm" onClick={()=>setSel(new Set())}>전체 해제</Btn>
          </div>
        </div>
        {nodes.map(n=>(
          <div key={n.id} onClick={()=>toggle(n.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:8,marginBottom:6,background:sel.has(n.id)?TDS.blue50:TDS.bgSecondary,border:`1px solid ${sel.has(n.id)?TDS.blue500:TDS.borderDefault}`,cursor:"pointer",transition:"all .15s"}}>
            <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${sel.has(n.id)?TDS.blue500:TDS.borderDefault}`,background:sel.has(n.id)?TDS.blue500:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {sel.has(n.id)&&<div style={{width:8,height:6,borderLeft:"2px solid #fff",borderBottom:"2px solid #fff",transform:"rotate(-45deg)",marginTop:-2}} />}
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14,color:TDS.textPrimary}}>{n.label}</div>
              <div style={{fontSize:11,color:TDS.textTertiary}}>{n.type} · {n.src}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:8}}>
        <Btn v="secondary" s="md" fw onClick={()=>onNav("S11")}>취소</Btn>
        <Btn v="primary" s="md" fw disabled={!sel.size} onClick={()=>onNav("S06")}>선택한 {sel.size}개 그래프에 반영</Btn>
      </div>
    </div>
  );
}

/* S17 보고서 검토·승인 */

