import { useState, useEffect } from "react";
import TDS from "../../theme/tokens.js";
import { Back, Btn } from "../../components/ui.jsx";
import api from "../../api/index.js";

export function S17({ onNav }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [keywords, setKeywords] = useState([]);
  const [title, setTitle] = useState("");
  const [sttMode, setSttMode] = useState("");
  const [err, setErr] = useState("");
  const sessionId = sessionStorage.getItem("mbx_voice_session");

  useEffect(() => {
    if (!sessionId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const s = await api.voice.getSession(sessionId);
        if (cancelled) return;
        setText(s.transcript || "");
        setKeywords(s.keywords || []);
        setTitle(s.t);
        setSttMode(s.stt_mode || "");
      } catch (e) {
        if (!cancelled) setErr(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  const save = async () => {
    if (!sessionId) return;
    try {
      await api.voice.patchSession(sessionId, {
        transcript: text,
        keywords,
        status: "완료",
      });
      setEditing(false);
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="content" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Back onClick={() => onNav("S15")} label="목록" />
        <div style={{ fontSize: 20, fontWeight: 700 }}>{title || "보고서 검토·승인"}</div>
        {sttMode && <span style={{ fontSize: 12, color: TDS.textTertiary }}>STT: {sttMode}</span>}
      </div>
      {err && <div style={{ color: TDS.danger, marginBottom: 12 }}>{err}</div>}
      <div className="card card-p" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: TDS.textPrimary }}>음성 전사 결과</div>
          <Btn v="ghost" s="sm" onClick={() => (editing ? save() : setEditing(true))}>{editing ? "저장" : "편집"}</Btn>
        </div>
        {editing
          ? <textarea className="inp" rows={8} value={text} onChange={(e) => setText(e.target.value)} />
          : <div style={{ fontSize: 14, color: TDS.textSecondary, lineHeight: 1.7, padding: 12, background: TDS.bgSecondary, borderRadius: 8, whiteSpace: "pre-wrap" }}>{text || "전사 결과가 없습니다."}</div>}
      </div>
      <div className="card card-p" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>추출된 키워드</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(keywords.length ? keywords : ["(없음)"]).map((k) => (
            <div key={k} style={{ padding: "5px 12px", background: TDS.blue50, borderRadius: 20, fontSize: 13, color: TDS.blue500, fontWeight: 500 }}>{k}</div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn v="secondary" s="md" fw onClick={() => onNav("S15")}>나중에 확인</Btn>
        <Btn v="primary" s="md" fw onClick={async () => { await save(); onNav("S15"); }}>완료</Btn>
      </div>
    </div>
  );
}
