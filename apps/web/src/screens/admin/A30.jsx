import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A30({ onNav }) {
  const [sel,setSel]=useState(null);
  const [tier,setTier]=useState("T1");
  const [reason,setReason]=useState("");
  const [done,setDone]=useState(false);
  const admins=["admin_lee (T1)","admin_park (T1)"];
  return (
    <div className="content" style={{maxWidth:540,margin:"0 auto"}}>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:16}}>
        <div style={{fontSize:20,fontWeight:700}}>관리자 Tier 변경</div><Badge t="red">[T2]</Badge>
      </div>
      <Notice type="danger" style={{marginBottom:20}}>Tier 변경은 즉시 적용됩니다. 보안팀에 통보됩니다.</Notice>
      {done
        ? <div className="card card-p" style={{textAlign:"center",padding:"40px"}}><TFI s={48}>✅</TFI><div style={{fontSize:18,fontWeight:700,marginTop:16}}>Tier 변경 완료</div><div style={{fontSize:13,color:TDS.textTertiary,marginTop:8,marginBottom:24}}>{sel} → {tier}</div><Btn v="primary" s="md" onClick={()=>onNav("A29")}>관리자 목록으로</Btn></div>
        : <div className="card card-p">
          <div className="inp-group"><label className="inp-label">대상 관리자</label>
            <select className="inp" value={sel||""} onChange={e=>setSel(e.target.value)}>
              <option value="">선택하세요</option>
              {admins.map(a=><option key={a}>{a}</option>)}
            </select>
          </div>
          <div className="inp-group"><label className="inp-label">변경할 Tier</label>
            <div style={{display:"flex",gap:8}}>
              {["T1","T2"].map(t=><Btn key={t} v={tier===t?"primary":"secondary"} s="sm" onClick={()=>setTier(t)}>{t}</Btn>)}
            </div>
          </div>
          <div className="inp-group"><label className="inp-label">변경 사유</label><textarea className="inp" rows={2} placeholder="사유..." value={reason} onChange={e=>setReason(e.target.value)} /></div>
          <Btn v="danger" s="md" fw disabled={!sel||!reason} onClick={()=>setDone(true)}>Tier 변경 적용</Btn>
        </div>
      }
    </div>
  );
}

/* A31 본인 활동 이력 */

