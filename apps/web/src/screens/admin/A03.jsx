import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A03({ onNav }) {
  const user={id:"U-1024",name:"이수진",email:"sujin@school.ac.kr",role:"교사",status:"정지됨",joined:"2025-11-01",lastLogin:"2026-01-19",nodes:1204,tier:"T1"};
  return (
    <div className="content">
      <div className="row-between mb16" style={{marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>onNav("A02")}>← 목록</button>
          <div className="sec-title">{user.name} 상세</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn v="secondary" s="sm" onClick={()=>onNav("A04")}>정지/해제</Btn>
          <Btn v="danger" s="sm" onClick={()=>onNav("A05")}>강제 삭제 [T2]</Btn>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"280px 1fr",gap:16}}>
        <div className="card card-p">
          <div style={{textAlign:"center",marginBottom:16}}>
            <div style={{width:72,height:72,borderRadius:"50%",background:TDS.success,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:30,fontWeight:700,margin:"0 auto 12px"}}>{user.name[0]}</div>
            <div style={{fontSize:18,fontWeight:700}}>{user.name}</div>
            <div style={{fontSize:13,color:TDS.textTertiary}}>{user.email}</div>
            <div style={{marginTop:8,padding:"3px 12px",borderRadius:20,background:TDS.dangerBg,color:TDS.danger,fontSize:12,fontWeight:600,display:"inline-block"}}>{user.status}</div>
          </div>
          {[["역할",user.role],["가입일",user.joined],["마지막 로그인",user.lastLogin],["총 노드",`${user.nodes.toLocaleString()}개`],["사용자 ID",user.id]].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${TDS.bgTertiary}`,fontSize:13}}>
              <span style={{color:TDS.textTertiary}}>{k}</span><span style={{fontWeight:500}}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div className="card card-p">
            <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>교사 자격 정보</div>
            <div style={{padding:"12px",background:TDS.warningBg,borderRadius:8,fontSize:13,color:TDS.warning}}>⚠️ 자격 정지 상태 - A04에서 해제 가능</div>
          </div>
          <div className="card card-p">
            <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>최근 감사 로그</div>
            {[["user.suspend","계정 정지 처리","high","1일 전"],["teacher.verify.approve","자격 검증 승인","medium","15일 전"]].map(([ac,d,sv,t])=>(
              <div key={ac} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:`1px solid ${TDS.bgTertiary}`,fontSize:13}}>
                <code style={{fontSize:11,background:TDS.bgTertiary,padding:"2px 6px",borderRadius:4,flexShrink:0}}>{ac}</code>
                <span style={{color:TDS.textSecondary,flex:1}}>{d}</span>
                <span style={{color:TDS.textTertiary}}>{t}</span>
              </div>
            ))}
          </div>
          <div className="card card-p">
            <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>담당 학생 ({user.role==="교사"?"3명":"-"})</div>
            {user.role==="교사"?["김학생 (2학년 3반)","이학생 (2학년 5반)","박학생 (3학년 1반)"].map(s=>(
              <div key={s} style={{padding:"6px 0",borderBottom:`1px solid ${TDS.bgTertiary}`,fontSize:13,color:TDS.textSecondary}}>{s}</div>
            )):<div style={{color:TDS.textTertiary,fontSize:13}}>해당 없음 (학생 계정)</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* A04 계정 정지·해제 */

