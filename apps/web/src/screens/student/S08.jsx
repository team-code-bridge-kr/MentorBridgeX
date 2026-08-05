import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { Back, TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function S08({ onNav }) {
  return (
    <div className="content" style={{maxWidth:640,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <Back onClick={()=>onNav("S06")} label="그래프" />
        <div style={{fontSize:20,fontWeight:700}}>엣지 상세</div>
      </div>
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:16,padding:"12px 0",borderBottom:`1px solid ${TDS.borderDefault}`,marginBottom:16}}>
          <div style={{flex:1,padding:"10px 16px",background:TDS.blue50,borderRadius:10,textAlign:"center",fontWeight:700,color:TDS.blue500}}>양자컴퓨팅</div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <div style={{width:60,height:2,background:TDS.blue500}} />
            <div style={{fontSize:11,color:TDS.textTertiary,fontWeight:600}}>하위 개념</div>
          </div>
          <div style={{flex:1,padding:"10px 16px",background:TDS.successBg,borderRadius:10,textAlign:"center",fontWeight:700,color:TDS.success}}>큐비트</div>
        </div>
        <div className="inp-group"><label className="inp-label">관계 타입</label>
          <select className="inp"><option>하위 개념</option><option>상위 개념</option><option>관련</option><option>참조</option><option>대립</option></select>
        </div>
        <div className="inp-group"><label className="inp-label">가중치</label><input className="inp" type="number" min="0" max="1" step="0.01" defaultValue="0.85" /></div>
        <div className="inp-group"><label className="inp-label">메모</label><textarea className="inp" rows={2} placeholder="이 연결에 대한 메모..." /></div>
        <div style={{display:"flex",gap:8,marginTop:16}}>
          <Btn v="danger" s="sm">엣지 삭제</Btn>
          <div style={{flex:1}} />
          <Btn v="primary" s="sm">저장</Btn>
        </div>
      </div>
      <div className="card card-p">
        <div className="card-title" style={{marginBottom:12}}>엣지 생성 이력</div>
        {[["자동 생성 (ML)","2026-01-10"],["가중치 수정","2026-01-15"]].map(([a,d])=>(
          <div key={d} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${TDS.bgTertiary}`,fontSize:13}}>
            <span style={{color:TDS.textSecondary}}>{a}</span>
            <span style={{color:TDS.textTertiary}}>{d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* S09 시드 추가 */

