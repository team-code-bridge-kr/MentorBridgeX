/**
 * api/client.js — fetch 헬퍼 + 토큰·세션 관리
 * ─────────────────────────────────────────
 * 모든 백엔드 요청은 여기 request() 를 통해 처리됩니다.
 * 토큰·세션은 localStorage 에 저장되어 새로고침 후에도 유지됩니다.
 */

// .env.example 참고: VITE_API_BASE_URL 설정
export const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "";
// API_BASE 가 비어있으면 vite.config.js 의 /v1 프록시가 처리합니다 (로컬 개발 시).

import { expireSession } from "../lib/sessionExpiry.js";

const TOKEN_KEY = "mbx_token";
const SESSION_KEY = "mbx_session";

// ── 토큰 저장소 ──────────────────────────────────────────────
export const getToken    = ()  => localStorage.getItem(TOKEN_KEY);
export const setToken    = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken  = ()  => localStorage.removeItem(TOKEN_KEY);

export function saveSession(session) {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  if (session.token) setToken(session.token);
}

export function loadSession() {
  try {
    const token = getToken();
    const raw = localStorage.getItem(SESSION_KEY);
    if (!token || !raw) return null;
    const session = JSON.parse(raw);
    if (!session?.user || !session?.token) return null;
    // token mismatch → stale
    if (session.token !== token) return null;
    return session;
  } catch {
    return null;
  }
}

export function clearSession() {
  clearToken();
  localStorage.removeItem(SESSION_KEY);
}

// ── 공통 fetch 래퍼 ──────────────────────────────────────────
/**
 * request(path, options)
 * @param {string} path   - ex) "/v1/auth/dev-login"
 * @param {object} opts
 *   - method    {string}  - GET | POST | DELETE | PATCH (기본 GET)
 *   - body      {object}  - JSON body
 *   - formData  {FormData}- multipart/form-data body (파일 업로드 등)
 *   - auth      {boolean} - false 이면 Authorization 헤더 생략 (기본 true)
 * @returns Promise<any>  - 응답 JSON (오류 시 throw)
 */
export async function request(path, opts = {}) {
  const { method = "GET", body, formData, auth = true } = opts;

  const headers = {};
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let bodyContent = undefined;
  if (formData) {
    // multipart — Content-Type 은 브라우저가 자동으로 boundary 포함해 설정
    bodyContent = formData;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    bodyContent = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: bodyContent,
  });

  // 204 No Content → null 반환
  if (res.status === 204) return null;

  // body 는 한 번만 읽을 수 있다 — text() 로 먼저 받고 JSON 파싱을 시도한다.
  // (res.json() 실패 후 res.text() 를 부르면 "body stream already read" 로
  //  진짜 원인(502 HTML 등)이 가려진다.)
  const raw = await res.text();

  let data;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      // JSON 이 아님 → nginx 502/504 HTML, 프록시 오류 등
      const snippet = raw.replace(/\s+/g, " ").slice(0, 200);
      const err = new Error(
        res.ok
          ? `서버 응답 파싱 실패: ${snippet}`
          : `서버 오류 (HTTP ${res.status}): ${snippet}`
      );
      err.status = res.status;
      err.code = String(res.status);
      throw err;
    }
  }

  // 토큰을 들려 보냈는데 401 이면 그 토큰은 이제 못 쓴다. 시간이 지났거나
  // 서버가 먼저 끊은 것이다. 화면에 오류만 뿌리지 말고 로그인으로 내보낸다 —
  // 여태는 "유효하지 않은 토큰입니다" 만 뜨고 로그인한 것처럼 남아 있었다.
  if (res.status === 401 && auth && getToken()) {
    expireSession();
  }

  if (!res.ok) {
    // 백엔드 에러 형식: { "error": { "code", "message" } } or { "detail": ... }
    const msg =
      data?.error?.message ||
      (typeof data?.detail === "string" ? data.detail : JSON.stringify(data?.detail)) ||
      `HTTP ${res.status}`;
    const err = new Error(msg);
    err.code  = data?.error?.code || String(res.status);
    err.status = res.status;
    throw err;
  }

  return data;
}
