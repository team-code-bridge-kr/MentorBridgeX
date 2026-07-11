import { useState, useEffect, useRef } from "react";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Card, Notice } from "../../components/ui.jsx";
import api from "../../api/index.js";

export function S16({ onNav }) {
  const [sec, setSec] = useState(0);
  const [recording, setRecording] = useState(false);
  const [partial, setPartial] = useState("마이크 권한을 허용한 뒤 녹음을 시작하세요.");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const sessionId = sessionStorage.getItem("mbx_voice_session");

  useEffect(() => {
    if (!recording) return undefined;
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  useEffect(() => () => {
    mediaRef.current?.stream?.getTracks?.().forEach((tr) => tr.stop());
  }, []);

  const fmt2 = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const start = async () => {
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.start(1000);
      mediaRef.current = rec;
      setRecording(true);
      setPartial("녹음 중… 종료하면 STT가 실행됩니다.");
    } catch (e) {
      setErr(e.message || "마이크를 사용할 수 없습니다.");
    }
  };

  const stopAndSave = async () => {
    if (!sessionId) { setErr("세션이 없습니다. 목록에서 다시 시작하세요."); return; }
    setBusy(true);
    setErr("");
    try {
      const blob = await new Promise((resolve, reject) => {
        const rec = mediaRef.current;
        if (!rec) { resolve(null); return; }
        rec.onstop = () => {
          rec.stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" }));
        };
        rec.onerror = reject;
        if (rec.state !== "inactive") rec.stop();
        else resolve(new Blob(chunksRef.current, { type: "audio/webm" }));
      });
      setRecording(false);
      if (!blob || blob.size === 0) {
        // empty — still mark session with mock via tiny silence blob
        const empty = new Blob([new Uint8Array([0])], { type: "audio/webm" });
        await api.voice.transcribe(sessionId, empty, sec);
      } else {
        if (blob.size > 5 * 1024 * 1024) {
          throw new Error("녹음이 5MB를 초과했습니다. 짧게 녹음해 주세요.");
        }
        setPartial("STT 처리 중… (오디오는 서버에 저장되지 않습니다)");
        await api.voice.transcribe(sessionId, blob, sec);
      }
      onNav("S17");
    } catch (e) {
      setErr(e.message || "저장 실패");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="content" style={{ maxWidth: 720, margin: "0 auto" }}>
      <Notice type="danger"><TFI>🔴</TFI> 녹음 오디오는 디스크에 저장되지 않고 STT 후 폐기됩니다.</Notice>
      {err && <div style={{ color: TDS.danger, margin: "12px 0", fontSize: 13 }}>{err}</div>}
      <Card className="mb24" style={{ marginBottom: 24, textAlign: "center" }}>
        <div style={{ fontSize: 13, color: TDS.textTertiary, marginBottom: 8 }}>{recording ? "녹음 중" : "대기"}</div>
        <div style={{ fontSize: 56, fontWeight: 800, color: TDS.danger, fontVariantNumeric: "tabular-nums", marginBottom: 24 }}>{fmt2(sec)}</div>
        <div className="row g-12" style={{ gap: 12, justifyContent: "center" }}>
          {!recording
            ? <Btn v="primary" s="md" onClick={start} disabled={busy}>🎙️ 녹음 시작</Btn>
            : <Btn v="danger" s="md" onClick={stopAndSave} disabled={busy}>{busy ? "처리 중…" : "⏹️ 종료 및 STT"}</Btn>}
          <Btn v="secondary" s="md" onClick={() => onNav("S15")} disabled={busy}>목록</Btn>
        </div>
      </Card>
      <Card>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>상태</div>
        <div style={{ background: TDS.bgTertiary, borderRadius: 10, padding: 16, minHeight: 120, fontSize: 15, lineHeight: 1.8, color: TDS.textSecondary }}>
          {partial}
        </div>
      </Card>
    </div>
  );
}
