import { useState, useEffect } from "react";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge } from "../../components/ui.jsx";
import api from "../../api/index.js";

export function S15({ onNav }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const stType = { 완료: "green", "검토 대기": "orange", "녹음 중": "blue" };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items = await api.voice.listSessions();
        if (!cancelled) setSessions(items);
      } catch (e) {
        if (!cancelled) setErr(e.message || "세션을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const startNew = async () => {
    try {
      const s = await api.voice.createSession(`녹음 ${new Date().toLocaleString("ko-KR")}`);
      sessionStorage.setItem("mbx_voice_session", s.id);
      onNav("S16");
    } catch (e) {
      setErr(e.message);
    }
  };

  const open = (s) => {
    sessionStorage.setItem("mbx_voice_session", s.id);
    onNav("S17");
  };

  return (
    <div className="content">
      <div className="row-between mb24" style={{ marginBottom: 24 }}>
        <div className="sec-sub" style={{ marginBottom: 0 }}>녹음은 서버에 저장되지 않고 STT 텍스트만 보관합니다 (≤5MB)</div>
        <Btn v="primary" onClick={startNew}><TFI>🎙️</TFI> 새 녹음 시작</Btn>
      </div>
      {err && <div style={{ color: TDS.danger, marginBottom: 12, fontSize: 13 }}>{err}</div>}
      {loading && <div style={{ color: TDS.textTertiary }}>불러오는 중…</div>}
      {!loading && !sessions.length && (
        <div style={{ textAlign: "center", padding: 48, color: TDS.textTertiary }}>아직 녹음 세션이 없습니다</div>
      )}
      {sessions.map((s) => (
        <div key={s.id} className="sess-card">
          <div className="sess-icon" style={{ background: s.st === "검토 대기" ? TDS.warningBg : TDS.blue50 }}>
            <TFI s={20} color={s.st === "검토 대기" ? TDS.warning : TDS.blue500}>
              {s.st === "검토 대기" ? "⏳" : "🎙️"}
            </TFI>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: TDS.textPrimary, marginBottom: 4 }}>{s.t}</div>
            <div style={{ fontSize: 13, color: TDS.textTertiary }}>
              {s.date} · {s.dur} · 참여자 {s.ppl}명{s.stt_mode ? ` · ${s.stt_mode}` : ""}
            </div>
          </div>
          <Badge t={stType[s.st] || "grey"}>{s.st}</Badge>
          {s.st !== "완료" && (
            <Btn v={s.st === "검토 대기" ? "primary" : "secondary"} s="sm" onClick={() => open(s)}>
              {s.st === "검토 대기" ? "검토하기" : "보기"}
            </Btn>
          )}
        </div>
      ))}
    </div>
  );
}
