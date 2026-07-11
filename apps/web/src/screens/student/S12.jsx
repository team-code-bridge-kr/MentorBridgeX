import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function S12({ onNav }) {
  const [txt, setTxt] = useState("물리학 시간에 양자역학의 기초 개념인 슈뢰딩거 방정식을 학습하면서 파동함수의 의미와 측정의 불확정성에 깊은 흥미를 느꼈다. 방과 후 자발적으로 관련 논문을 탐독하고 학급 물리 스터디를 조직하여 5명의 동료 학생들과 함께 주 2회 토론 학습을 진행하였다.");
  return (
    <div style={{display:"flex",height:"100%"}}>
      <div style={{flex:1,padding:28,overflowY:"auto",background:TDS.bgSecondary}}>
        <div className="row g-12 mb24" style={{gap:12,marginBottom:24}}>
          <button className="btn-inline" onClick={()=>onNav("S11")}>← 목록</button>
          <div>
            <div style={{fontSize:18,fontWeight:700,color:TDS.textPrimary}}>세부능력 및 특기사항</div>
            <div style={{fontSize:12,color:TDS.textTertiary}}>마지막 저장: 10분 전</div>
          </div>
        </div>
        <Notice type="info" className="mb16"><TFI>💡</TFI> 내용을 편집하면 관련 그래프 노드가 자동으로 업데이트됩니다.</Notice>
        <Card>
          <textarea className="textarea" style={{minHeight:300,fontSize:15,lineHeight:1.8}} value={txt} onChange={e=>setTxt(e.target.value)} />
          <div className="row-between mt16" style={{marginTop:14}}>
            <span style={{fontSize:13,color:TDS.textTertiary}}>{txt.length}자</span>
            <div className="row g-8" style={{gap:8}}>
              <Btn v="secondary" s="sm">초기화</Btn>
              <Btn v="primary" s="sm">저장 및 그래프 동기화</Btn>
            </div>
          </div>
        </Card>
      </div>
      <div style={{width:280,flexShrink:0,background:TDS.bgPrimary,borderLeft:`1px solid ${TDS.borderDefault}`,padding:20,overflowY:"auto"}}>
        <div style={{fontSize:14,fontWeight:700,color:TDS.textPrimary,marginBottom:16}}>연결된 노드</div>
        {["양자역학","슈뢰딩거 방정식","파동함수","물리학","토론 학습"].map(n=>(
          <div key={n} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:TDS.blue50,borderRadius:10,marginBottom:8,cursor:"pointer"}}>
            <TFI s={14} color={TDS.blue500}>🔵</TFI>
            <span style={{fontSize:13,color:TDS.blue500,fontWeight:600}}>{n}</span>
          </div>
        ))}
        <div style={{marginTop:16,padding:"10px 14px",background:"#fffbeb",borderRadius:10,fontSize:12,color:"#92400e",display:"flex",alignItems:"flex-start",gap:8,border:"1px solid #fde68a"}}>
          <TFI s={14} color="#f59e0b">💡</TFI>
          <span style={{lineHeight:1.5}}>저장 시 관련 노드가 자동으로 추출됩니다</span>
        </div>
      </div>
    </div>
  );
}

/* S15 음성 세션 */

