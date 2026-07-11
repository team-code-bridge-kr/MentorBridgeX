import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function S22({ onNav }) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(`저는 물리학과 화학에 깊은 관심을 가지고 있으며, 특히 양자역학 분야에서 독창적인 연구를 수행하고자 합니다.

고등학교 시절 양자역학 스터디를 직접 조직하여 슈뢰딩거 방정식의 의미를 탐구했습니다. 코펜하겐 해석과 다세계 해석을 비교 분석하면서 물리학적 사고를 심화시켰습니다.

이러한 경험을 바탕으로 귀 대학 화학과에서 양자화학 분야를 전공하여 미래 신소재 개발에 기여하고자 합니다.`);
  const usedNodes=["양자역학","슈뢰딩거 방정식","코펜하겐 해석","다세계 해석","물리학"];
  return (
    <div className="content" style={{maxWidth:760,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("S21")}>← 목록</button>
        <div style={{flex:1,fontSize:20,fontWeight:700}}>화학과 지원 자기소개서</div>
        <Btn v="ghost" s="sm" onClick={()=>setEditing(!editing)}>{editing?"저장":"편집"}</Btn>
        <Btn v="secondary" s="sm" onClick={()=>onNav("S29")}>내보내기</Btn>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:16}}>
        <div className="card card-p">
          {editing
            ? <textarea className="inp" rows={14} value={content} onChange={e=>setContent(e.target.value)} style={{fontFamily:"inherit",lineHeight:1.8}} />
            : <div style={{fontSize:14,color:TDS.textSecondary,lineHeight:1.85,whiteSpace:"pre-line"}}>{content}</div>
          }
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div className="card card-p">
            <div style={{fontSize:13,fontWeight:700,marginBottom:10}}>사용된 노드 ({usedNodes.length}개)</div>
            {usedNodes.map(n=>(
              <div key={n} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:`1px solid ${TDS.bgTertiary}`,cursor:"pointer"}} onClick={()=>onNav("S07")}>
                <div style={{width:6,height:6,borderRadius:"50%",background:TDS.blue500}} />
                <span style={{fontSize:13,color:TDS.textSecondary}}>{n}</span>
              </div>
            ))}
          </div>
          <div className="card card-p">
            <div style={{fontSize:13,fontWeight:700,marginBottom:10}}>템플릿 정보</div>
            <div style={{fontSize:13,color:TDS.textTertiary}}>자기소개서 A</div>
            <div style={{fontSize:12,color:TDS.textDisabled,marginTop:4}}>생성: 2026-01-20</div>
            <Btn v="ghost" s="sm" style={{marginTop:12}}>재생성</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* S23 가지치기 추천 */

