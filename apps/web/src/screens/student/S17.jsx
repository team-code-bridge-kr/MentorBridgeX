import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function S17({ onNav }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("오늘 물리 토론에서 양자역학의 기초 개념에 대해 토론했습니다. 슈뢰딩거 방정식의 의미와 물리적 해석에 대해 논의하고, 코펜하겐 해석과 다세계 해석을 비교했습니다. 특히 관측 문제와 파동 함수의 붕괴에 관한 심층 토론이 이뤄졌습니다.");
  return (
    <div className="content" style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("S15")}>← 목록</button>
        <div style={{fontSize:20,fontWeight:700}}>보고서 검토·승인</div>
      </div>
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:700,color:TDS.textPrimary}}>음성 전사 결과</div>
          <Btn v="ghost" s="sm" onClick={()=>setEditing(!editing)}>{editing?"완료":"편집"}</Btn>
        </div>
        {editing
          ? <textarea className="inp" rows={6} value={text} onChange={e=>setText(e.target.value)} />
          : <div style={{fontSize:14,color:TDS.textSecondary,lineHeight:1.7,padding:"12px",background:TDS.bgSecondary,borderRadius:8}}>{text}</div>
        }
      </div>
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:10}}>추출된 키워드</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {["양자역학","슈뢰딩거 방정식","코펜하겐 해석","다세계 해석","파동 함수 붕괴","관측 문제"].map(k=>(
            <div key={k} style={{padding:"5px 12px",background:TDS.blue50,borderRadius:20,fontSize:13,color:TDS.blue500,fontWeight:500}}>{k}</div>
          ))}
        </div>
      </div>
      <div style={{display:"flex",gap:8}}>
        <Btn v="secondary" s="md" fw onClick={()=>onNav("S15")}>나중에 확인</Btn>
        <Btn v="primary" s="md" fw onClick={()=>onNav("S19")}>매칭 제안 받기</Btn>
      </div>
    </div>
  );
}

/* S18 참여자 관리 */

