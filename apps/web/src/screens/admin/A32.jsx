import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A32({ onNav }) {
  const [step,setStep]=useState(0);
  const [form,setForm]=useState({target:"",trace:"",desc:"",level:"debug"});
  const updateForm = k => e => setForm({...form,[k]:e.target.value});
  const steps=["대상 선택","정보 입력","확인","실행","완료"];
  return (
    <div className="content" style={{maxWidth:560,margin:"0 auto"}}>
      <div style={{fontSize:20,fontWeight:700,marginBottom:16}}>디버깅 신청</div>
      <div style={{display:"flex",gap:4,marginBottom:24}}>
        {steps.map((s,i)=>(
          <div key={i} style={{flex:1,textAlign:"center"}}>
            <div style={{height:4,borderRadius:2,background:i<=step?TDS.blue500:TDS.borderDefault,marginBottom:6}} />
            <div style={{fontSize:9,color:i<=step?TDS.blue500:TDS.textDisabled,fontWeight:i===step?700:400}}>{s}</div>
          </div>
        ))}
      </div>
      {step===0&&(
        <div className="card card-p">
          <div className="inp-group"><label className="inp-label">디버그 대상</label>
            <select className="inp" value={form.target} onChange={updateForm("target")}>
              <option value="">선택하세요</option>
              <option>특정 사용자</option><option>특정 그래프</option><option>ML 작업</option><option>시스템 전체</option>
            </select>
          </div>
          <div className="inp-group"><label className="inp-label">로그 레벨</label>
            <div style={{display:"flex",gap:8}}>
              {["debug","info","warn","error"].map(l=><Btn key={l} v={form.level===l?"primary":"secondary"} s="sm" onClick={()=>setForm({...form,level:l})}>{l}</Btn>)}
            </div>
          </div>
          <Btn v="primary" s="md" fw disabled={!form.target} onClick={()=>setStep(1)}>다음</Btn>
        </div>
      )}
      {step===1&&(
        <div className="card card-p">
          <div className="inp-group"><label className="inp-label">Trace ID (선택)</label><input className="inp" placeholder="01HXY..." value={form.trace} onChange={updateForm("trace")} /></div>
          <div className="inp-group"><label className="inp-label">디버그 설명</label><textarea className="inp" rows={4} placeholder="재현 방법, 예상 동작, 실제 동작..." value={form.desc} onChange={updateForm("desc")} /></div>
          <div style={{display:"flex",gap:8}}>
            <Btn v="secondary" s="sm" onClick={()=>setStep(0)}>이전</Btn>
            <Btn v="primary" s="sm" disabled={!form.desc} onClick={()=>setStep(2)}>다음</Btn>
          </div>
        </div>
      )}
      {step===2&&(
        <div className="card card-p">
          <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>디버깅 요청 확인</div>
          {[["대상",form.target],["레벨",form.level],["Trace ID",form.trace||"없음"],["설명",form.desc]].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${TDS.bgTertiary}`,fontSize:13}}>
              <span style={{color:TDS.textTertiary}}>{k}</span><span style={{maxWidth:300,textAlign:"right",overflow:"hidden",textOverflow:"ellipsis"}}>{v}</span>
            </div>
          ))}
          <div style={{display:"flex",gap:8,marginTop:16}}>
            <Btn v="secondary" s="sm" onClick={()=>setStep(1)}>이전</Btn>
            <Btn v="primary" s="sm" onClick={()=>setStep(3)}>실행 요청</Btn>
          </div>
        </div>
      )}
      {step===3&&(
        <div className="card card-p" style={{textAlign:"center",padding:"32px"}}>
          <div style={{fontSize:32,marginBottom:12}}>⏳</div>
          <div style={{fontSize:15,fontWeight:700}}>디버깅 세션 생성 중...</div>
          <div style={{fontSize:12,color:TDS.textTertiary,marginTop:8,marginBottom:24}}>세션 ID: DBG-2026-0120-001</div>
          <Btn v="primary" s="md" onClick={()=>setStep(4)}>완료 확인</Btn>
        </div>
      )}
      {step===4&&(
        <div className="card card-p" style={{textAlign:"center",padding:"40px"}}>
          <TFI s={48} color={TDS.warning}>🐛</TFI>
          <div style={{fontSize:18,fontWeight:700,marginTop:16,marginBottom:8}}>디버깅 세션 준비됨</div>
          <div style={{fontSize:13,color:TDS.textTertiary,marginBottom:24}}>세션 ID: DBG-2026-0120-001 · 24시간 유효</div>
          <div style={{display:"flex",gap:8,justifyContent:"center"}}>
            <Btn v="secondary" s="md" onClick={()=>setStep(0)}>새 요청</Btn>
            <Btn v="primary" s="md" onClick={()=>onNav("A13")}>시스템 헬스로</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Placeholder ── */

