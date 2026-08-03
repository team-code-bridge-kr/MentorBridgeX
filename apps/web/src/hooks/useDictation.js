/**
 * 마이크 받아쓰기.
 *
 * 브라우저 SpeechRecognition 을 쓰지 않는다 — 크롬 계열에만 있고, 한국어
 * 정확도도 서버 STT(Daglo)보다 떨어진다. MediaRecorder 로 녹음해서 서버에
 * 보내고 문장을 받는다.
 *
 * 상태: idle → recording → sending → idle
 */

import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/index.js";

// 이 이상 길어지면 STT 동기 변환이 버티지 못한다 (짧은 음성용 엔드포인트)
const MAX_MS = 30_000;

export function useDictation({ onText } = {}) {
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  const cleanup = useCallback(() => {
    clearTimeout(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  const start = useCallback(async () => {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("이 브라우저는 녹음을 지원하지 않습니다.");
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // 거부/장치 없음을 구분해봐야 사용자가 할 일은 같다
      setError("마이크를 사용할 수 없습니다. 브라우저 권한을 확인해 주세요.");
      return;
    }

    streamRef.current = stream;
    const chunks = [];
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = async () => {
      clearTimeout(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      if (blob.size < 1000) { // 사실상 아무 말도 안 한 경우
        setState("idle");
        setError("녹음이 너무 짧습니다.");
        return;
      }
      setState("sending");
      try {
        const text = await api.voice.dictate(blob);
        onText?.(text);
        setState("idle");
      } catch (e) {
        setError(e.message || "음성을 인식하지 못했습니다.");
        setState("idle");
      }
    };

    recorder.start();
    setState("recording");
    // 사용자가 멈추는 걸 잊어도 알아서 끊는다
    timerRef.current = setTimeout(stop, MAX_MS);
  }, [onText, stop]);

  const toggle = useCallback(() => {
    if (state === "recording") stop();
    else if (state === "idle") start();
  }, [state, start, stop]);

  return { state, error, toggle, start, stop, clearError: () => setError("") };
}
