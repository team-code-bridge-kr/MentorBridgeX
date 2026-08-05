/**
 * 어디서든 열리는 녹음 도크.
 *
 * 녹음은 원래 화면 하나(S16)였다. 그런데 녹음할 상황은 **다른 일을 하는 도중에**
 * 생긴다 — 멘토와 이야기하다가, 발표를 들으며, 그래프를 보다가. 화면을 옮기면
 * 녹음이 끊기니 결국 "녹음하려면 하던 걸 멈춰야" 했다.
 *
 * 그래서 도크를 앱 껍데기(AppShell)에 붙였다. 화면이 바뀌어도 이 컴포넌트는
 * 다시 그려지지 않으므로 **녹음이 이어진다.** 접어 두면 오른쪽 아래 단추 하나고,
 * 녹음 중에는 그 단추가 빨갛게 남아 지금 녹음 중이라는 걸 어느 화면에서든 알린다.
 *
 * 오디오는 서버에 저장하지 않는다. STT 로 글로 옮긴 뒤 버린다.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import TDS from "../../theme/tokens.js";
import { NavIcon } from "../NavIcon.jsx";
import api from "../../api/index.js";

/** 다른 화면에서 도크를 열 때 쓴다. */
export const VOICE_OPEN = "mbx:voice-open";
export function openVoiceDock() {
  window.dispatchEvent(new CustomEvent(VOICE_OPEN));
}

// 서버가 받는 한계. 넘으면 STT 요청 자체가 실패하므로 여기서 먼저 막는다.
const MAX_BYTES = 5 * 1024 * 1024;
// 5MB 를 넘기기 전에 스스로 멈춘다. 오래 녹음하다 통째로 잃는 것보다 낫다.
const MAX_SEC = 30 * 60;
const BARS = 16;
const RECENT_LIMIT = 3;

const fmt = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function VoiceDock({ onNav }) {
  const [open, setOpen] = useState(false);
  // idle | recording | saving | done
  const [phase, setPhase] = useState("idle");
  const [sec, setSec] = useState(0);
  const [levels, setLevels] = useState(() => Array(BARS).fill(0));
  const [recent, setRecent] = useState([]);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const audioRef = useRef(null);   // { ctx, analyser, raf }
  const sessionRef = useRef(null);
  const recording = phase === "recording";

  // 다른 화면에서 "녹음 시작"을 누르면 여기가 열린다.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(VOICE_OPEN, onOpen);
    return () => window.removeEventListener(VOICE_OPEN, onOpen);
  }, []);

  // 최근 녹음은 도크를 열 때만 불러온다. 접혀 있는 동안 부를 이유가 없다.
  useEffect(() => {
    if (!open || phase !== "idle") return;
    let alive = true;
    api.voice
      .listSessions()
      .then((all) => alive && setRecent(all.slice(0, RECENT_LIMIT)))
      .catch(() => {});
    return () => { alive = false; };
  }, [open, phase]);

  useEffect(() => {
    if (!recording) return undefined;
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  // 녹음 중에 창을 닫으면 그때까지의 말이 사라진다. 한 번 물어본다.
  useEffect(() => {
    if (!recording) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [recording]);

  const teardownMeter = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    cancelAnimationFrame(a.raf);
    a.ctx.close().catch(() => {});
    audioRef.current = null;
    setLevels(Array(BARS).fill(0));
  }, []);

  /** 소리 크기를 막대로 보여준다. 녹음이 실제로 들어오고 있다는 유일한 신호다. */
  const startMeter = useCallback((stream) => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += (v - 128) ** 2;
      const rms = Math.sqrt(sum / buf.length) / 128;
      setLevels((prev) => [...prev.slice(1), Math.min(1, rms * 3.2)]);
      audioRef.current.raf = requestAnimationFrame(tick);
    };
    audioRef.current = { ctx, analyser, raf: requestAnimationFrame(tick) };
  }, []);

  const start = useCallback(async () => {
    setErr("");
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined;
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.start(1000);
      recRef.current = rec;
      // 세션은 녹음이 실제로 시작된 뒤에 만든다. 마이크를 거절당했는데 빈
      // 세션만 남는 일이 없도록.
      const s = await api.voice.createSession(
        `녹음 ${new Date().toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}`,
      );
      sessionRef.current = s.id;
      setSec(0);
      setPhase("recording");
      setOpen(true);
      startMeter(stream);
    } catch (e) {
      recRef.current?.stream?.getTracks?.().forEach((t) => t.stop());
      recRef.current = null;
      setErr(
        e?.name === "NotAllowedError"
          ? "마이크 사용이 거절되었습니다. 브라우저 주소창의 자물쇠에서 허용해 주세요."
          : e.message || "마이크를 사용할 수 없습니다.",
      );
    }
  }, [startMeter]);

  const stop = useCallback(async () => {
    const rec = recRef.current;
    const sessionId = sessionRef.current;
    setPhase("saving");
    teardownMeter();
    try {
      const blob = await new Promise((resolve, reject) => {
        if (!rec) { resolve(null); return; }
        rec.onstop = () => {
          rec.stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" }));
        };
        rec.onerror = reject;
        if (rec.state !== "inactive") rec.stop();
        else resolve(new Blob(chunksRef.current, { type: "audio/webm" }));
      });
      recRef.current = null;
      if (!blob || !blob.size) throw new Error("녹음된 소리가 없습니다.");
      if (blob.size > MAX_BYTES) throw new Error("녹음이 5MB를 넘었습니다. 짧게 나눠 녹음해 주세요.");
      const saved = await api.voice.transcribe(sessionId, blob, sec);
      setResult(saved);
      setPhase("done");
    } catch (e) {
      setErr(e.message || "글로 옮기지 못했습니다.");
      setPhase("idle");
    }
  }, [sec, teardownMeter]);

  // 시간이 너무 길어지면 스스로 멈춘다(5MB 한계에 걸리기 전에).
  useEffect(() => {
    if (recording && sec >= MAX_SEC) stop();
  }, [recording, sec, stop]);

  useEffect(() => () => {
    recRef.current?.stream?.getTracks?.().forEach((t) => t.stop());
    teardownMeter();
  }, [teardownMeter]);

  const openReview = (id) => {
    sessionStorage.setItem("mbx_voice_session", id);
    setOpen(false);
    onNav("S17");
  };

  return (
    <>
      {open && (
        <div className="vdock" role="dialog" aria-label="음성 기록">
          <div className="vdock-head">
            <span className="vdock-title">
              <NavIcon name="voice" size={15} color={TDS.primary} /> 음성 기록
            </span>
            <button type="button" className="vdock-x" onClick={() => setOpen(false)} aria-label="닫기">
              <NavIcon name="close" size={14} color={TDS.textSecondary} />
            </button>
          </div>

          <div className="vdock-body">
            {phase === "recording" && (
              <div className="vdock-live">
                <div className="vdock-wave" aria-hidden>
                  {levels.map((v, i) => (
                    <span key={i} style={{ height: `${8 + v * 46}px` }} />
                  ))}
                </div>
                <div className="vdock-time">{fmt(sec)}</div>
                <div className="vdock-hint">녹음 중입니다. 다른 화면으로 옮겨도 계속됩니다.</div>
              </div>
            )}

            {phase === "saving" && (
              <div className="vdock-live">
                <div className="spinner" />
                <div className="vdock-hint" style={{ marginTop: 12 }}>글로 옮기는 중… 소리는 저장하지 않습니다.</div>
              </div>
            )}

            {phase === "done" && result && (
              <div className="vdock-done">
                <div className="vdock-done-title">{fmt(result.duration_sec || sec)} 녹음을 글로 옮겼어요</div>
                <p className="vdock-quote">{result.transcript || "인식된 말이 없습니다."}</p>
                {!!result.keywords?.length && (
                  <div className="vdock-kws">
                    {result.keywords.slice(0, 5).map((k) => <span key={k} className="vdock-kw">{k}</span>)}
                  </div>
                )}
                <div className="vdock-actions">
                  <button type="button" className="vdock-btn is-primary" onClick={() => openReview(result.id)}>
                    검토하고 다듬기
                  </button>
                  <button type="button" className="vdock-btn" onClick={() => { setPhase("idle"); setResult(null); setSec(0); }}>
                    새로 녹음
                  </button>
                </div>
              </div>
            )}

            {phase === "idle" && (
              <div className="vdock-idle">
                <p className="vdock-hint">
                  멘토링·발표를 녹음하면 글로 옮겨 탐구 기록에 씁니다.
                  <br />소리는 서버에 남기지 않습니다.
                </p>
                {!!recent.length && (
                  <>
                    <div className="vdock-sub">최근 녹음</div>
                    {recent.map((s) => (
                      <button key={s.id} type="button" className="vdock-item" onClick={() => openReview(s.id)}>
                        <span className="vdock-item-t">{s.t}</span>
                        <span className="vdock-item-m">{s.date} · {s.dur}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}

            {err && <p className="vdock-err">{err}</p>}
          </div>

          {/* 아래 줄은 늘 같은 자리다 — 녹음 단추가 어디로도 옮겨 다니지 않는다. */}
          <div className="vdock-bar">
            <button
              type="button"
              className="vdock-link"
              onClick={() => { setOpen(false); onNav("S15"); }}
            >
              전체 보기
            </button>
            <button
              type="button"
              className={`vdock-rec${recording ? " is-on" : ""}`}
              onClick={recording ? stop : start}
              disabled={phase === "saving"}
              title={recording ? "녹음 멈추고 글로 옮기기" : "녹음 시작"}
              aria-label={recording ? "녹음 멈추기" : "녹음 시작"}
            >
              {recording ? <span className="vdock-stop" /> : <NavIcon name="voice" size={19} color="#fff" />}
            </button>
          </div>
        </div>
      )}

      {/* 접힌 단추. 녹음 중에는 빨갛게 남아 어느 화면에서든 눈에 띈다. */}
      <button
        type="button"
        className={`vdock-fab${recording ? " is-rec" : ""}${open ? " is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title={recording ? `녹음 중 ${fmt(sec)}` : "음성 기록"}
        aria-label={recording ? `녹음 중 ${fmt(sec)}` : "음성 기록"}
      >
        {recording
          ? <><span className="vdock-dot" /><span className="vdock-fab-time">{fmt(sec)}</span></>
          : <NavIcon name={open ? "close" : "voice"} size={21} color="#fff" />}
      </button>
    </>
  );
}
