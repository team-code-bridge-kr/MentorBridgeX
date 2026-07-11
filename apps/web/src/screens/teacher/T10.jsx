import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function T10({ onNav }) {
  const { state, actions } = useStore();
  const stu = state.selectedStudent;
  const [type, setType] = useState("노드");
  const [target, setTarget] = useState("양자컴퓨팅 노드");
  const [txt, setTxt] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if(!txt.trim()) return;
    setBusy(true);
    try {
      await actions.postComment({
        author: state.session?.user?.name || "교사",
        type, target,
        content: txt.trim(),
        student: stu?.name,
        replied: false,
      });
      onNav("T11");
    } finally { setBusy(false); }
  };
  return (
    <div className="content" style={{maxWidth:640,margin:"0 auto"}}>
      <div className="sec-title mb24" style={{marginBottom:24}}>코멘트 작성{stu?` · ${stu.name}`:""}</div>
      <Card>
        <div className="inp-group">
          <label className="inp-label">코멘트 대상 유형</label>
          <div className="row g-8" style={{gap:8}}>
            {["노드","텍스트","음성 보고서","양식 결과물"].map(t=>(
              <Btn key={t} v={type===t?"primary":"secondary"} s="sm" onClick={()=>setType(t)}>{t}</Btn>
            ))}
          </div>
        </div>
        <div className="inp-group">
          <label className="inp-label">대상 선택</label>
          <select className="inp" style={{cursor:"pointer"}} value={target} onChange={e=>setTarget(e.target.value)}>
            <option>양자컴퓨팅 노드</option><option>물리학 노드</option><option>세특 영역</option>
          </select>
        </div>
        <div className="inp-group">
          <label className="inp-label">코멘트 내용</label>
          <textarea className="textarea" rows={5} value={txt} onChange={e=>setTxt(e.target.value)} placeholder="학생에게 전달할 코멘트를 작성하세요..." disabled={busy} />
        </div>
        <div className="row-between">
          <span style={{fontSize:13,color:TDS.textTertiary}}>학생이 즉시 알림을 받습니다</span>
          <div className="row g-8" style={{gap:8}}>
            <Btn v="secondary" onClick={()=>onNav("T11")} disabled={busy}>취소</Btn>
            <Btn v="primary" onClick={send} disabled={!txt.trim()||busy} style={busy?{opacity:.7,cursor:"not-allowed"}:undefined}>{busy?"전송 중…":"코멘트 전송"}</Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   ── TEACHER SCREENS (미구현 분) ──
────────────────────────────────────────────────────────────── */

/* T02 자격 검증 상태 */

