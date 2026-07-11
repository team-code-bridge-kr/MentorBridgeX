import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function S31({ onNav }) {
  return (
    <div className="content" style={{maxWidth:560,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("S30")}>← 설정</button>
        <div style={{fontSize:20,fontWeight:700}}>계정 정보</div>
      </div>
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:16,paddingBottom:20,marginBottom:20,borderBottom:`1px solid ${TDS.borderDefault}`}}>
          <div style={{width:64,height:64,borderRadius:"50%",background:TDS.blue500,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:28,fontWeight:700}}>홍</div>
          <div>
            <div style={{fontSize:20,fontWeight:700}}>홍길동</div>
            <div style={{fontSize:13,color:TDS.textTertiary}}>hong@school.ac.kr</div>
          </div>
        </div>
        {[
          ["역할","학생"],
          ["가입일","2026-01-01"],
          ["마지막 로그인","2026-01-20 14:32"],
          ["OAuth 제공자","Google"],
        ].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${TDS.bgTertiary}`,fontSize:14}}>
            <span style={{color:TDS.textTertiary}}>{k}</span>
            <span style={{color:TDS.textPrimary,fontWeight:500}}>{v}</span>
          </div>
        ))}
      </div>
      <div className="card card-p">
        <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>활동 통계</div>
        {[["총 노드","2,847개"],["총 엣지","4,231개"],["음성 녹음","23회 / 18시간"],["생성한 양식","6개"]].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${TDS.bgTertiary}`,fontSize:13}}>
            <span style={{color:TDS.textTertiary}}>{k}</span>
            <span style={{fontWeight:600,color:TDS.textPrimary}}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* S32 계정 삭제 요청 */

