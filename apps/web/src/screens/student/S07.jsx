/**
 * S07 노드 상세 — **잠들어 있다.** 어디서도 이 화면으로 오지 않는다.
 *
 * 아래 `node` 는 하드코딩된 가짜다. 그래서 어떤 노드를 골랐든 늘 "양자컴퓨팅"이
 * 떴다. 진짜 노드 상세는 그래프 화면(S06)의 옆 패널이고, 디자인 가이드 §14 도
 * "고치기는 그래프 화면 안에서 한다"고 못 박는다 — 화면을 옮기면 방금 본 그림과
 * 고치는 자리가 떨어져서 무엇을 고치는 중인지 잊는다.
 *
 * 파일을 남겨 둔 것은 되살릴 여지 때문이다. 되살리려면 (1) S06 이 고른 노드를
 * 넘기는 배선과 (2) 저장 단추의 실제 동작이 필요하다. 그 둘이 없으면 지금처럼
 * 보기만 그럴듯한 화면이 된다. 디버그 화면 고르개(ScreenPicker)로는 열린다.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { Back, TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function S07({ onNav }) {
  const [tab, setTab] = useState("정보");
  const node = { id:"node-001", label:"양자컴퓨팅", type:"개념", weight:0.92, desc:"양자역학 원리를 이용해 정보를 처리하는 컴퓨팅 패러다임.", edges:["큐비트","양자 알고리즘","얽힘","중첩"], docs:["세특 물리학","세특 화학"], created:"2026-01-10" };
  return (
    <div className="content" style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <Back onClick={()=>onNav("S06")} label="그래프" />
        <div style={{width:40,height:40,borderRadius:"50%",background:TDS.blue500,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:14}}>개념</div>
        <div>
          <div style={{fontSize:20,fontWeight:700,color:TDS.textPrimary}}>{node.label}</div>
          <div style={{fontSize:12,color:TDS.textTertiary}}>가중치 {node.weight} · {node.created} 생성</div>
        </div>
      </div>
      <div className="tab-pill-wrap" style={{marginBottom:20}}>
        {["정보","연결 엣지","관련 문서","코멘트"].map(t=><div key={t} className={`tab-pill${tab===t?" active":""}`} onClick={()=>setTab(t)}>{t}</div>)}
      </div>
      {tab==="정보" && (
        <div className="card card-p">
          <div className="inp-group"><label className="inp-label">노드 설명</label><textarea className="inp" rows={3} defaultValue={node.desc} /></div>
          <div className="inp-group"><label className="inp-label">노드 타입</label>
            <select className="inp"><option>개념</option><option>사건</option><option>인물</option><option>장소</option></select>
          </div>
          <div style={{display:"flex",gap:8,marginTop:16}}>
            <Btn v="secondary" s="sm" fw onClick={()=>onNav("S10")}>변경 이력</Btn>
            <Btn v="primary" s="sm" fw>저장</Btn>
          </div>
        </div>
      )}
      {tab==="연결 엣지" && (
        <div className="card card-p">
          {node.edges.map(e=>(
            <div key={e} className="list-row" style={{cursor:"pointer"}} onClick={()=>onNav("S08")}>
              <div style={{width:8,height:8,borderRadius:"50%",background:TDS.blue500,marginTop:6}} />
              <div className="list-row-left"><div className="list-row-title">{e}</div><div className="list-row-sub">관계: 하위 개념</div></div>
              <span style={{color:TDS.textTertiary}}>›</span>
            </div>
          ))}
          <Btn v="ghost" s="sm" style={{marginTop:12}} onClick={()=>onNav("S09")}>+ 연결 추가</Btn>
        </div>
      )}
      {tab==="관련 문서" && (
        <div className="card card-p">
          {node.docs.map(d=>(
            <div key={d} className="list-row" style={{cursor:"pointer"}} onClick={()=>onNav("S12")}>
              <TFI s={20} color={TDS.textSecondary}>📄</TFI>
              <div className="list-row-left"><div className="list-row-title">{d}</div></div>
              <span style={{color:TDS.textTertiary}}>›</span>
            </div>
          ))}
        </div>
      )}
      {tab==="코멘트" && <div className="card card-p"><div className="empty"><TFI s={36} color={TDS.textDisabled}>💬</TFI><div className="empty-title">코멘트 없음</div><div className="empty-sub">교사의 코멘트가 표시됩니다</div></div></div>}
    </div>
  );
}

/* S08 엣지 상세 */

