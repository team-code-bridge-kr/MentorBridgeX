import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { Back, TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function S09({ onNav }) {
  const { actions } = useStore();
  const [kws, setKws] = useState([]);
  const [inp, setInp] = useState("");
  const [busy, setBusy] = useState(false);
  const addKw = () => { const v=inp.trim(); if(v&&!kws.includes(v)&&kws.length<20){ setKws([...kws,v]); setInp(""); }};
  const generate = async () => {
    if(!kws.length) return;
    setBusy(true);
    try { await actions.generateGraph(kws); onNav("S06"); }
    finally { setBusy(false); }
  };
  return (
    <div className="rs-wrap rs-narrow">
      <div className="form-head">
        <Back onClick={()=>onNav("S06")} label="그래프" />
        <h1 className="form-title">시드 키워드 추가</h1>
      </div>
      <p className="sec-sub">낱말을 넣으면 그 낱말에서 뻗어 나가는 가지를 만들어 봅니다 ({kws.length}/20)</p>
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          <input className="inp" style={{flex:1}} placeholder="키워드 입력..." value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addKw()} disabled={busy} />
          <Btn v="primary" s="sm" onClick={addKw} disabled={busy}>추가</Btn>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {kws.map(k=>(
            <div key={k} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",background:TDS.blue50,borderRadius:20,fontSize:13,color:TDS.blue500,fontWeight:500}}>
              {k}<span style={{cursor:"pointer",opacity:.7}} onClick={()=>!busy&&setKws(kws.filter(x=>x!==k))}>×</span>
            </div>
          ))}
          {!kws.length&&<div style={{color:TDS.textDisabled,fontSize:13}}>추가한 키워드가 없습니다</div>}
        </div>
      </div>
      <Notice type="info">ML이 키워드를 분석하여 관련 노드와 관계를 자동으로 추천합니다.</Notice>
      <div style={{display:"flex",gap:8,marginTop:20}}>
        <Btn v="secondary" s="md" fw onClick={()=>onNav("S06")} disabled={busy}>취소</Btn>
        <Btn v="primary" s="md" fw disabled={!kws.length||busy} onClick={generate} style={busy?{opacity:.7,cursor:"not-allowed"}:undefined}>{busy?"생성 중…":`그래프 생성 (${kws.length}개)`}</Btn>
      </div>
    </div>
  );
}

/* S10 그래프 변경 이력 */

