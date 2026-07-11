import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function S03({ onNav }) {
  const [role, setRole] = useState("student");
  return (
    <div style={{minHeight:"100vh",background:TDS.bgSecondary,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:TDS.bgPrimary,borderRadius:24,padding:"44px 52px",maxWidth:500,width:"90%",boxShadow:"0 20px 60px rgba(0,0,0,.12)",textAlign:"center"}}>
        <div style={{fontSize:52,marginBottom:16}}><TFI s={52}>🎉</TFI></div>
        <h2 style={{fontSize:24,fontWeight:800,marginBottom:10,color:TDS.textPrimary}}>환영합니다!</h2>
        <p style={{fontSize:14,color:TDS.textTertiary,marginBottom:32}}>어떤 역할로 사용하실 건가요?</p>
        <div className="grid2 g12 mb24" style={{gap:12,marginBottom:28}}>
          {[["student","🎓","학생","지식 그래프 구축\n생기부 텍스트 관리"],
            ["teacher","👩‍🏫","교사","담당 학생 관리\n코멘트 작성"]].map(([v,ic,t,d])=>(
            <div key={v} onClick={()=>setRole(v)} style={{padding:"20px 16px",borderRadius:14,border:`2px solid ${role===v?TDS.blue500:TDS.borderDefault}`,background:role===v?TDS.blue50:TDS.bgPrimary,cursor:"pointer",transition:"all .14s"}}>
              <div style={{fontSize:30,marginBottom:10}}><TFI s={30} color={role===v?TDS.blue500:TDS.textTertiary}>{ic}</TFI></div>
              <div style={{fontSize:15,fontWeight:700,color:TDS.textPrimary,marginBottom:6}}>{t}</div>
              <div style={{fontSize:12,color:TDS.textTertiary,whiteSpace:"pre-line"}}>{d}</div>
            </div>
          ))}
        </div>
        <Btn v="primary" fw onClick={()=>onNav(role==="teacher"?"T01":"S04")}>계속하기</Btn>
      </div>
    </div>
  );
}

/* S04 시드 입력 */

