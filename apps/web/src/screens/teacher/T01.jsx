import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function T01({ onNav }) {
  const { state, actions } = useStore();
  const [school, setSchool] = useState("");
  const [subject, setSubject] = useState("");
  const [teacherNo, setTeacherNo] = useState("");
  const [file, setFile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async () => {
    setErr("");
    if(!school.trim()||!subject.trim()||!teacherNo.trim()){ setErr("모든 항목을 입력하세요."); return; }
    if(!file){ setErr("증빙 서류를 첨부하세요."); return; }
    setBusy(true);
    try { await actions.submitTeacherVerification({ school:school.trim(), subject:subject.trim(), teacherNo:teacherNo.trim() }); onNav("T02"); }
    finally { setBusy(false); }
  };
  return (
    <div className="content" style={{maxWidth:560,margin:"0 auto"}}>
      <div className="sec-title mb4" style={{marginBottom:4}}>교사 자격 검증 신청</div>
      <div className="sec-sub">교직원 증빙 서류를 첨부하여 신청하세요</div>
      <Card>
        <Notice type="info" className="mb24">교사 자격 검증은 영업일 기준 1~3일이 소요됩니다. 승인 후 담당 학생 매핑이 가능합니다.</Notice>
        {err && <div style={{marginBottom:16,padding:"10px 12px",borderRadius:10,background:"rgba(240,68,68,.08)",border:`1px solid rgba(240,68,68,.25)`,color:TDS.danger,fontSize:13,fontWeight:500}}>{err}</div>}
        <div className="inp-group"><label className="inp-label">소속 학교</label><input className="inp" placeholder="○○고등학교" value={school} onChange={e=>setSchool(e.target.value)} disabled={busy} /></div>
        <div className="inp-group"><label className="inp-label">교과목</label><input className="inp" placeholder="물리학, 화학, 수학..." value={subject} onChange={e=>setSubject(e.target.value)} disabled={busy} /></div>
        <div className="inp-group"><label className="inp-label">교원번호</label><input className="inp" placeholder="00000000" value={teacherNo} onChange={e=>setTeacherNo(e.target.value)} disabled={busy} /></div>
        <div className="inp-group">
          <label className="inp-label">증빙 서류 첨부</label>
          <div onClick={()=>!busy&&setFile(true)} style={{border:`2px dashed ${file?TDS.blue500:TDS.borderStrong}`,borderRadius:12,padding:28,textAlign:"center",color:file?TDS.blue500:TDS.textTertiary,cursor:"pointer",background:file?TDS.blue50:"transparent"}}>
            <div style={{fontSize:32,marginBottom:8}}>{file?"✅":"📎"}</div>
            <div style={{fontSize:14}}>{file?"재직증명서.pdf 첨부됨 (클릭하여 변경)":"클릭하거나 파일을 드래그하세요"}</div>
            <div style={{fontSize:12,marginTop:4}}>재직증명서, 교원 자격증 (PDF, JPG, PNG · 최대 10MB)</div>
          </div>
        </div>
        <Btn v="primary" fw onClick={submit} disabled={busy} style={busy?{opacity:.7,cursor:"not-allowed"}:undefined}>{busy?"제출 중…":"신청 제출"}</Btn>
      </Card>
    </div>
  );
}

