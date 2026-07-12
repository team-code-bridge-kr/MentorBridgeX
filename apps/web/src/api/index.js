/**
 * api/index.js — 앱 전체 API 인터페이스
 * ─────────────────────────────────────────────────────────────────────
 * 화면(screens)과 store/actions 는 모두 이 파일의 api 객체를 통해
 * 백엔드와 통신합니다.
 *
 * 📌 "실제 백엔드 연결" vs "목업" 상태 요약
 * ──────────────────────────────────────────
 * ✅ LIVE  : auth.*, graph.*, ingest.uploadPdf,
 *            comments.*, voice.*, forms.*, notifications.*, stats.*, settings.*
 * 🔶 MOCK  : auth.signInAdmin (partial), teacher.*, admin.*
 *
 * 백엔드 라우터 참고: services/api/app/routers/
 */

import { request, setToken, clearToken, getToken } from "./client.js";
import { mockApi } from "./mockData.js";

const _uid = (p = "id") =>
  `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const _sleep = (ms = 400) => new Promise((r) => setTimeout(r, ms));

function mapComment(c) {
  const createdAt = c.createdAt ?? (c.created_at ? Date.parse(c.created_at) : Date.now());
  return {
    id: c.id,
    author: c.author,
    type: c.type,
    target: c.target,
    content: c.content,
    reports: c.reports ?? 0,
    replied: c.replied ?? false,
    createdAt: typeof createdAt === "number" ? createdAt : Date.parse(createdAt),
  };
}

function mapNotif(n) {
  const createdAt = n.created_at ? Date.parse(n.created_at) : Date.now();
  const agoMs = Date.now() - createdAt;
  const time =
    agoMs < 3600_000 ? `${Math.max(1, Math.floor(agoMs / 60_000))}분 전` :
    agoMs < 86400_000 ? `${Math.floor(agoMs / 3600_000)}시간 전` :
    `${Math.floor(agoMs / 86400_000)}일 전`;
  return {
    id: n.id,
    ic: n.icon || "bell",
    t: n.title,
    d: n.body,
    time,
    read: !!n.read,
  };
}

function fmtDur(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h}시간 ${m}분`;
  return `${m}분`;
}

function mapVoice(v) {
  const created = v.created_at ? new Date(v.created_at) : new Date();
  const date = `${created.getFullYear()}.${String(created.getMonth()+1).padStart(2,"0")}.${String(created.getDate()).padStart(2,"0")}`;
  return {
    id: v.id,
    t: v.title,
    date,
    dur: fmtDur(v.duration_sec),
    duration_sec: v.duration_sec || 0,
    st: v.status,
    ppl: (v.participants || []).length || 1,
    transcript: v.transcript || "",
    keywords: v.keywords || [],
    participants: v.participants || [],
    stt_mode: v.stt_mode,
    raw: v,
  };
}

// ── 노드 매퍼: 백엔드 → UI 형태 ─────────────────────────────
const PALETTE = ["#3182f6","#4593fc","#22c55e","#f59e0b","#8b95a1","#f04452"];
function mapNode(n, idx) {
  // 백엔드 GraphNode: { id, label, type, description, ... }
  // UI 기대: { id, label, kind, x, y, color, size, cat }
  const angle  = (idx / 8) * Math.PI * 2;
  const cx     = 50 + Math.cos(angle) * 28;
  const cy     = 48 + Math.sin(angle) * 30;
  const t = String(n.type || "").toLowerCase();
  const kind =
    t === "root" ? "root" :
    t === "keyword" || t === "inquiry" || t === "subject" ? "topic" :
    "leaf";
  return {
    id:    n.id,
    label: n.label,
    kind,
    x:     n.x ?? `${cx.toFixed(0)}%`,
    y:     n.y ?? `${cy.toFixed(0)}%`,
    color: n.color ?? PALETTE[idx % PALETTE.length],
    size:  n.size ?? (kind === "root" ? 64 : kind === "topic" ? 44 : 38),
    cat:   n.cat  ?? (kind === "root" ? "핵심 노드" : kind === "topic" ? "연결 노드" : "말단 노드"),
  };
}
function mapEdge(e) {
  // 백엔드 GraphEdge: { id, source_id, target_id, relation }
  // UI 기대: { id, from, to }
  return { id: e.id, from: e.source_id ?? e.from, to: e.target_id ?? e.to };
}

// ── 역할 추론 (email 기반 데모용) ─────────────────────────
function inferRole(email) {
  const e = email.toLowerCase();
  if (e.includes("admin"))   return "admin";
  if (e.includes("teacher") || e.includes("sujin") || e.includes("minjun")) return "teacher";
  return "student";
}

// ─────────────────────────────────────────────────────────────
const api = {
  // ══ 인증 ══════════════════════════════════════════════════
  auth: {
    /**
     * ✅ LIVE — POST /v1/auth/dev-login
     * 비밀번호는 MVP에서 검증하지 않음. email 로컬파트로 display_name 생성.
     */
    async signInWithPassword(email, password) {
      const displayName = email.split("@")[0].replace(/[._-]/g, " ");
      const data = await request("/v1/auth/dev-login", {
        method: "POST",
        body:   { email: email.trim().toLowerCase(), display_name: displayName },
        auth:   false,
      });
      setToken(data.access_token);
      return {
        token: data.access_token,
        user: {
          id:       data.user_id,
          email:    data.email,
          name:     displayName,
          role:     inferRole(email),
          provider: "password",
        },
      };
    },

    /**
     * ✅ LIVE — Google OAuth 시작 (redirect). 세션은 /oauth/callback 에서 완성.
     * GOOGLE 미설정 시 기존처럼 dev-login fallback.
     */
    async signInWithGoogle() {
      const clientId =
        import.meta.env.VITE_GOOGLE_CLIENT_ID ||
        (await this._fetchGoogleConfig()).client_id;
      const redirectUri =
        import.meta.env.VITE_GOOGLE_REDIRECT_URI ||
        `${window.location.origin}/oauth/callback`;

      if (!clientId) {
        // 로컬/미설정: 기존 데모 경로 유지
        const data = await request("/v1/auth/dev-login", {
          method: "POST",
          body:   { email: "student@gmail.com", display_name: "김학생" },
          auth:   false,
        });
        setToken(data.access_token);
        return {
          token: data.access_token,
          user:  {
            id: data.user_id,
            email: data.email,
            name: data.display_name || "김학생",
            role: "student",
            provider: "google",
          },
        };
      }

      const state = _uid("gstate");
      sessionStorage.setItem("mbx_oauth_state", state);
      sessionStorage.setItem("mbx_oauth_redirect", redirectUri);

      const params = new URLSearchParams({
        client_id:     clientId,
        redirect_uri:  redirectUri,
        response_type: "code",
        scope:         "openid email profile",
        state,
        prompt:        "select_account",
        access_type:   "online",
      });
      window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
      // redirect 중 — 호출부에서 세션을 기대하지 않음
      return null;
    },

    async _fetchGoogleConfig() {
      try {
        return await request("/v1/auth/google/config", { auth: false });
      } catch {
        return { enabled: false, client_id: "", redirect_uri: "" };
      }
    },

    /** ✅ LIVE — OAuth callback code → JWT */
    async exchangeOAuthCode(code, redirectUri) {
      const data = await request("/v1/auth/google/callback", {
        method: "POST",
        body: {
          code,
          redirect_uri: redirectUri || `${window.location.origin}/oauth/callback`,
        },
        auth: false,
      });
      setToken(data.access_token);
      const name = data.display_name || data.email.split("@")[0];
      return {
        token: data.access_token,
        user: {
          id: data.user_id,
          email: data.email,
          name,
          role: inferRole(data.email),
          provider: "google",
        },
      };
    },

    /**
     * 🔶 MOCK/LIVE — 관리자 로그인 (MFA 포함)
     * admin@ 이메일은 dev-login 으로 토큰 발급 후 role 강제 주입.
     */
    async signInAdmin(email, password, mfaCode) {
      if (!mfaCode || mfaCode.length < 6) {
        const e = new Error("MFA 코드 6자리를 입력하세요."); e.code = "auth/mfa-required"; throw e;
      }
      try {
        const data = await request("/v1/auth/dev-login", {
          method: "POST",
          body:   { email: email.trim().toLowerCase(), display_name: "시스템 관리자" },
          auth:   false,
        });
        setToken(data.access_token);
        return {
          token: data.access_token,
          user:  { id: data.user_id, email: data.email, name: "시스템 관리자", role: "admin", provider: "password", mfa: true },
        };
      } catch (err) {
        const e = new Error("관리자 인증 실패"); e.code = "auth/invalid-credential"; throw e;
      }
    },

    async signOut() {
      clearToken();
      return true;
    },
  },

  // ══ 그래프 ════════════════════════════════════════════════
  graph: {
    /** ✅ LIVE — GET /v1/students/me/graph (빈 그래프면 빈 배열 그대로) */
    async fetch(userId) {
      const data = await request("/v1/students/me/graph");
      return {
        nodes: (data.nodes ?? []).map(mapNode),
        edges: (data.edges ?? []).map(mapEdge),
      };
    },

    /** ✅ LIVE — POST /v1/students/me/graph/nodes */
    async addNode(node) {
      const data = await request("/v1/students/me/graph/nodes", {
        method: "POST",
        body: {
          label: node.label,
          type: "Keyword",
          description: node.description ?? "",
        },
      });
      return mapNode(data, Math.floor(Math.random() * 8));
    },

    /** ✅ LIVE — POST /v1/students/me/graph/edges */
    async addEdge(edge) {
      const data = await request("/v1/students/me/graph/edges", {
        method: "POST",
        body: {
          source_id: edge.from,
          target_id: edge.to,
          relation: "RELATES_TO",
        },
      });
      return mapEdge(data);
    },

    /** ✅ LIVE — DELETE /v1/students/me/graph/nodes/{id} */
    async removeNode(id) {
      await request(`/v1/students/me/graph/nodes/${id}`, { method: "DELETE" });
      return { id };
    },

    /**
     * ✅ LIVE — POST /v1/students/me/graph/seed
     * 시드 키워드들을 백엔드에 등록하고 생성된 노드 배열 반환
     */
    async generateFromSeeds(keywords) {
      const data = await request("/v1/students/me/graph/seed", {
        method: "POST",
        body: { seeds: keywords },
      });
      return (Array.isArray(data) ? data : data.nodes ?? []).map(mapNode);
    },

    /**
     * ✅ LIVE — POST /v1/students/me/recommendations/branch
     */
    async pruneSuggestions(userId) {
      const data = await request("/v1/students/me/recommendations/branch", {
        method: "POST",
        body: { seeds: [], max_results: 8 },
      });
      const sugs = data.suggestions ?? data ?? [];
      return sugs.map((s, i) => ({
        id: s.id || `rec_${i}`,
        label: s.label ?? String(s),
        reason: s.rationale ?? s.reason ?? "추천 키워드",
        action: "추가",
      }));
    },

    /** ✅ LIVE — POST /v1/students/me/recommendations/accept */
    async acceptSuggestion(label) {
      return request("/v1/students/me/recommendations/accept", {
        method: "POST",
        body: { label },
      });
    },
  },

  // ══ 문서 / PDF ════════════════════════════════════════════
  documents: {
    async list() {
      return request("/v1/students/me/documents");
    },
    async create(sectionType, content) {
      return request("/v1/students/me/documents", {
        method: "POST",
        body: { section_type: sectionType, content },
      });
    },
    async patch(sectionId, content) {
      return request(`/v1/students/me/documents/${sectionId}`, {
        method: "PATCH",
        body: { content },
      });
    },
  },

  jobs: {
    async get(jobId) {
      return request(`/v1/jobs/${jobId}`);
    },
    async wait(jobId, { intervalMs = 800, timeoutMs = 120000 } = {}) {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        const job = await this.get(jobId);
        if (job.status === "completed" || job.status === "failed" || job.status === "error") {
          return job;
        }
        await _sleep(intervalMs);
      }
      throw new Error("PDF 처리 시간이 초과되었습니다.");
    },
  },

  ingest: {
    /**
     * ✅ LIVE — POST /v1/students/me/documents/import-pdf
     * multipart/form-data, field name: "file"
     */
    async uploadPdf(file) {
      const fd = new FormData();
      fd.append("file", file);
      const data = await request("/v1/students/me/documents/import-pdf", {
        method: "POST",
        formData: fd,
      });
      return { jobId: data.job_id };
    },

    /** ✅ LIVE — voice session + STT (audio ≤5MB, not stored on disk) */
    async uploadAudio(blob) {
      throw new Error("use voice.createSession + voice.transcribe");
    },
    async transcribe() {
      throw new Error("use voice.transcribe");
    },
  },

  // ══ 음성 ══════════════════════════════════════════════════
  voice: {
    async listSessions() {
      const data = await request("/v1/students/me/voice/sessions");
      return (data || []).map(mapVoice);
    },
    async createSession(title = "새 녹음 세션") {
      const data = await request("/v1/students/me/voice/sessions", {
        method: "POST",
        body: { title },
      });
      return mapVoice(data);
    },
    async getSession(id) {
      const data = await request(`/v1/students/me/voice/sessions/${id}`);
      return mapVoice(data);
    },
    async patchSession(id, patch) {
      const data = await request(`/v1/students/me/voice/sessions/${id}`, {
        method: "PATCH",
        body: patch,
      });
      return mapVoice(data);
    },
    async transcribe(sessionId, blob, durationSec = 0) {
      const fd = new FormData();
      fd.append("file", blob, "recording.webm");
      fd.append("duration_sec", String(Math.floor(durationSec)));
      const data = await request(`/v1/students/me/voice/sessions/${sessionId}/transcribe`, {
        method: "POST",
        formData: fd,
      });
      return mapVoice(data);
    },
  },

  // ══ 코멘트 ✅ LIVE ════════════════════════════════════════
  comments: {
    async list() {
      const data = await request("/v1/students/me/comments");
      return (data || []).map(mapComment);
    },
    async create(c) {
      const data = await request("/v1/students/me/comments", {
        method: "POST",
        body: {
          content: c.content,
          type: c.type || "그래프",
          target: c.target || "전체 그래프",
          author: c.author,
        },
      });
      return mapComment(data);
    },
    async report(id) {
      const data = await request(`/v1/students/me/comments/${id}/report`, { method: "POST" });
      return mapComment(data);
    },
    async remove(id) {
      await request(`/v1/students/me/comments/${id}`, { method: "DELETE" });
      return { id };
    },
  },

  // ══ 양식 ✅ LIVE ══════════════════════════════════════════
  forms: {
    async listTemplates() {
      return request("/v1/students/me/forms/templates");
    },
    async list() {
      return request("/v1/students/me/forms");
    },
    async generate(templateId, title) {
      return request("/v1/students/me/forms/generate", {
        method: "POST",
        body: { template_id: templateId, title },
      });
    },
    async get(id) {
      return request(`/v1/students/me/forms/${id}`);
    },
    async patch(id, patch) {
      return request(`/v1/students/me/forms/${id}`, { method: "PATCH", body: patch });
    },
  },

  // ══ 알림 ✅ LIVE ══════════════════════════════════════════
  notifications: {
    async list() {
      const data = await request("/v1/students/me/notifications");
      return (data || []).map(mapNotif);
    },
    async readAll() {
      return request("/v1/students/me/notifications/read-all", { method: "POST" });
    },
    async read(id) {
      const data = await request(`/v1/students/me/notifications/${id}/read`, { method: "PATCH" });
      return mapNotif(data);
    },
  },

  // ══ 통계 / 설정 ✅ LIVE ═══════════════════════════════════
  stats: {
    async get() {
      return request("/v1/students/me/stats");
    },
  },
  settings: {
    async get() {
      return request("/v1/students/me/settings");
    },
    async patch(body) {
      return request("/v1/students/me/settings", { method: "PATCH", body });
    },
  },

  // ══ 교사 (🔶 MOCK) ═══════════════════════════════════════
  teacher: mockApi.teacher,

  // ══ 관리자 (🔶 MOCK) ══════════════════════════════════════
  admin: mockApi.admin,
};

export default api;
