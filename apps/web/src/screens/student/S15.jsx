import { useState, useEffect } from "react";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Empty } from "../../components/ui.jsx";
import api from "../../api/index.js";
import { openVoiceDock } from "../../components/voice/VoiceDock.jsx";

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

  // 녹음은 이 화면이 아니라 도크에서 한다. 녹음할 상황은 다른 일을 하는 도중에
  // 생기는데, 녹음 화면으로 옮겨 가야 하면 하던 일을 멈춰야 하기 때문이다.
  // 이 화면은 지난 녹음을 모아 보는 자리로 남는다.
  const startNew = () => openVoiceDock();

  const open = (s) => {
    sessionStorage.setItem("mbx_voice_session", s.id);
    onNav("S17");
  };

  return (
    <div className="content">
      <div className="row-between mb24" style={{ marginBottom: 24 }}>
        <div className="sec-sub" style={{ marginBottom: 0 }}>오른쪽 아래 마이크 단추로 어느 화면에서든 녹음할 수 있습니다. 소리는 저장하지 않고 옮겨 적은 글만 남습니다 (≤5MB)</div>
        <Btn v="primary" onClick={startNew}><TFI>🎙️</TFI> 새 녹음 시작</Btn>
      </div>
      {err && <div style={{ color: TDS.danger, marginBottom: 12, fontSize: 13 }}>{err}</div>}
      {loading && <div style={{ color: TDS.textTertiary }}>불러오는 중…</div>}
      {!loading && !sessions.length && (
        <Empty
          title="아직 녹음 세션이 없습니다."
          hint="멘토링이나 발표를 녹음하면 STT로 글로 옮겨 탐구 기록에 쓸 수 있습니다."
          cta="새 녹음 시작"
          onCta={startNew}
        />
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
