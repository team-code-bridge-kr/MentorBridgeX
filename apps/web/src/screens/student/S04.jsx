import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function S04({ onNav }) {
  const [kws, setKws] = useState(["양자컴퓨팅","물리학","화학","인공지능","수학"]);
  const [inp, setInp] = useState("");
  const sugg = ["유기화학","고전역학","선형대수","알고리즘","생명과학","데이터구조","통계학"].filter(s=>!kws.includes(s));
  const add = (k)=>{ if(k&&kws.length<20&&!kws.includes(k)){ setKws([...kws,k]); setInp(""); }};
  const del = (k)=>setKws(kws.filter(x=>x!==k));
  return (
    <div style={{minHeight:"100vh",background:TDS.bgSecondary,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:TDS.bgPrimary,borderRadius:24,padding:"44px 48px",maxWidth:640,width:"90%",boxShadow:"0 16px 48px rgba(0,0,0,.10)"}}>
        <div style={{height:4,background:TDS.bgTertiary,borderRadius:2,marginBottom:32}}>
          <div style={{height:4,background:TDS.blue500,borderRadius:2,width:"67%"}} />
        </div>
        <h2 style={{fontSize:22,fontWeight:800,color:TDS.textPrimary,marginBottom:8}}>나의 관심 키워드를 입력해주세요</h2>
        <p style={{fontSize:13,color:TDS.textTertiary,marginBottom:28}}>1~20개 키워드를 입력하면 AI가 자동으로 지식 그래프를 생성합니다</p>
        <div className="row g-10 mb20" style={{gap:10,marginBottom:20}}>
          <input className="inp" style={{flex:1}} placeholder="키워드 입력 후 Enter" value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add(inp)} />
          <Btn v="primary" s="sm" onClick={()=>add(inp)}>추가</Btn>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,minHeight:48,padding:"12px 0",borderBottom:`1px solid ${TDS.borderDefault}`,marginBottom:20}}>
          {kws.map(k=>(
            <span key={k} className="chip active">{k}<span className="chip-x" onClick={()=>del(k)}>✕</span></span>
          ))}
          {kws.length===0&&<span style={{color:TDS.textDisabled,fontSize:13}}>키워드를 입력하세요...</span>}
        </div>
        <p style={{fontSize:12,color:TDS.textTertiary,marginBottom:12,display:"flex",alignItems:"center",gap:5}}><TFI s={13} color="#f59e0b">💡</TFI> 추천 키워드</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:32}}>
          {sugg.map(s=><span key={s} className="chip" onClick={()=>add(s)}>+ {s}</span>)}
        </div>
        <div className="row g-12" style={{gap:12}}>
          <Btn v="secondary" s="md" onClick={()=>onNav("S05")}>나중에 입력</Btn>
          <Btn v="primary" s="md" style={{flex:1}} onClick={()=>onNav("S05")}>그래프 생성하기 ({kws.length}개)</Btn>
        </div>
      </div>
    </div>
  );
}

/* ── S05 도넛 차트 헬퍼 ── */

