import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { Back, TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function T09({ onNav }) {
  const node={label:"양자컴퓨팅",type:"개념",weight:0.92,desc:"양자역학 원리를 이용해 정보를 처리하는 컴퓨팅 패러다임.",student:"김학생",edges:["큐비트","양자 알고리즘"]};
  return (
    <div className="content" style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <Back onClick={()=>onNav("T08")} label="그래프" />
        <div style={{width:40,height:40,borderRadius:"50%",background:TDS.success,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:13}}>개념</div>
        <div style={{flex:1}}>
          <div style={{fontSize:20,fontWeight:700}}>{node.label}</div>
          <div style={{fontSize:12,color:TDS.textTertiary}}>학생: {node.student} · 가중치 {node.weight}</div>
        </div>
        <Btn v="primary" s="sm" onClick={()=>onNav("T10")}>코멘트 작성</Btn>
      </div>
      <Notice type="info" style={{marginBottom:16}}>읽기 전용 뷰입니다. 학생 데이터를 직접 편집할 수 없습니다.</Notice>
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>노드 정보</div>
        <div style={{fontSize:14,color:TDS.textSecondary,lineHeight:1.7,padding:"12px",background:TDS.bgSecondary,borderRadius:8,marginBottom:12}}>{node.desc}</div>
        <div style={{fontSize:13,color:TDS.textTertiary}}>타입: {node.type}</div>
      </div>
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>연결 엣지 ({node.edges.length}개)</div>
        {node.edges.map(e=>(
          <div key={e} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:`1px solid ${TDS.bgTertiary}`}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:TDS.success}} />
            <span style={{fontSize:13,color:TDS.textSecondary}}>{e}</span>
            <span style={{fontSize:11,color:TDS.textTertiary,marginLeft:"auto"}}>하위 개념</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   ── ADMIN SCREENS ──
────────────────────────────────────────────────────────────── */

