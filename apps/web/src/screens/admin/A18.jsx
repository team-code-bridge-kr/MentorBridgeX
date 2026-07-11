import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A18({ onNav }) {
  const { actions } = useStore();
  const [title,setTitle]=useState("");
  const [content,setContent]=useState("");
  const [target,setTarget]=useState("전체");
  const [schedule,setSchedule]=useState(false);
  const [done,setDone]=useState(false);
  const [busy,setBusy]=useState(false);
  const publish = async () => {
    if(!title||!content) return;
    setBusy(true);
    try {
      await actions.publishAnnouncement({ title:title.trim(), body:content.trim(), target, status: schedule?"예약됨":"발행됨" });
      setDone(true);
    } finally { setBusy(false); }
  };
  return (
    <div className="content" style={{maxWidth:640,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("A17")}>← 목록</button>
        <div style={{fontSize:20,fontWeight:700}}>공지 발행·편집</div>
      </div>
      {done
        ? <div className="card card-p" style={{textAlign:"center",padding:"40px"}}><TFI s={48} color={TDS.blue500}>📢</TFI><div style={{fontSize:18,fontWeight:700,marginTop:16}}>공지가 {schedule?"예약":"발행"}되었습니다</div><Btn v="primary" s="md" style={{marginTop:24}} onClick={()=>onNav("A17")}>목록으로</Btn></div>
        : <div className="card card-p">
          <div className="inp-group"><label className="inp-label">제목</label><input className="inp" placeholder="공지 제목..." value={title} onChange={e=>setTitle(e.target.value)} disabled={busy} /></div>
          <div className="inp-group"><label className="inp-label">내용</label><textarea className="inp" rows={6} placeholder="공지 내용..." value={content} onChange={e=>setContent(e.target.value)} disabled={busy} /></div>
          <div className="inp-group"><label className="inp-label">대상</label>
            <select className="inp" value={target} onChange={e=>setTarget(e.target.value)} disabled={busy}>
              <option>전체</option><option>학생</option><option>교사</option>
            </select>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
            <input type="checkbox" id="schedule-chk" checked={schedule} onChange={e=>setSchedule(e.target.checked)} />
            <label htmlFor="schedule-chk" style={{fontSize:13}}>예약 발행</label>
            {schedule&&<input className="inp" type="datetime-local" style={{flex:1,marginLeft:8}} />}
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn v="secondary" s="md" fw onClick={()=>onNav("A17")} disabled={busy}>취소</Btn>
            <Btn v="primary" s="md" fw disabled={!title||!content||busy} onClick={publish} style={busy?{opacity:.7,cursor:"not-allowed"}:undefined}>{busy?"처리 중…":(schedule?"예약":"즉시 발행")}</Btn>
          </div>
        </div>
      }
    </div>
  );
}

/* A19 JWKS 키 회전 [T2] */

