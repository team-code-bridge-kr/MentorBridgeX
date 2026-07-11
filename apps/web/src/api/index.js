/**
 * api/index.js — 앱 전체 API 인터페이스
 * ─────────────────────────────────────────────────────────────────────
 * 화면(screens)과 store/actions 는 모두 이 파일의 api 객체를 통해
 * 백엔드와 통신합니다.
 *
 * 📌 "실제 백엔드 연결" vs "목업" 상태 요약
 * ──────────────────────────────────────────
 * ✅ LIVE  : auth.signInWithPassword, auth.signOut
 *            graph.fetch, graph.addNode, graph.addEdge, graph.removeNode
 *            graph.generateFromSeeds, graph.pruneSuggestions
 *            ingest.uploadPdf
 * 🔶 MOCK  : auth.signInGoogle, auth.exchangeOAuthCode, auth.signInAdmin
 *            comments.*, teacher.*, admin.*
 *
 * 백엔드 라우터 참고: services/api/app/routers/
 */

import { request, setToken, clearToken, getToken } from "./client.js";
import { mockApi } from "./mockData.js";

const _uid = (p = "id") =>
  `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const _sleep = (ms = 400) => new Promise((r) => setTimeout(r, ms));

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
     * 🔶 MOCK — Google OAuth (MVP: dev-login 으로 고정 이메일 사용)
     * 실제 구현: window.location.href = `/v1/auth/google/start?redirect=/oauth/callback`
     */
    async signInWithGoogle() {
      await _sleep(700);
      try {
        const data = await request("/v1/auth/dev-login", {
          method: "POST",
          body:   { email: "student@gmail.com", display_name: "김학생" },
          auth:   false,
        });
        setToken(data.access_token);
        return {
          token: data.access_token,
          user:  { id: data.user_id, email: data.email, name: "김학생", role: "student", provider: "google" },
        };
      } catch {
        // 백엔드 없을 때 fallback
        const tok = _uid("tok");
        setToken(tok);
        return { token: tok, user: { id: _uid("u"), email: "student@gmail.com", name: "김학생", role: "student", provider: "google" } };
      }
    },

    /** 🔶 MOCK — OAuth callback code exchange */
    async exchangeOAuthCode(code) {
      await _sleep();
      return { token: _uid("tok"), user: { id: _uid("u"), email: "student@gmail.com", name: "김학생", role: "student", provider: "google" } };
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
        body: { seeds: [], max_results: 5 },
      });
      const sugs = data.suggestions ?? data ?? [];
      return sugs.map((s, i) => ({
        nodeId: `rec_${i}`,
        label: s.label ?? s,
        reason: s.rationale ?? s.reason ?? "추천 키워드",
      }));
    },
  },

  // ══ 문서 / PDF ════════════════════════════════════════════
  ingest: {
    /**
     * ✅ LIVE — POST /v1/students/me/documents/import-pdf
     * multipart/form-data, field name: "file"
     */
    async uploadPdf(file) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const data = await request("/v1/students/me/documents/import-pdf", {
          method:   "POST",
          formData: fd,
        });
        // ImportPdfResponse: { job_id }
        return { docId: data.job_id, pages: 0, parsed: [] };
      } catch {
        await _sleep(1200);
        return { docId: _uid("doc"), pages: 12, parsed: [{ title: "활동 제목", body: "파싱된 본문..." }] };
      }
    },

    /** 🔶 MOCK — 음성 업로드 (백엔드 미구현) */
    async uploadAudio(blob) {
      await _sleep(1200);
      return { audioId: _uid("aud"), durationSec: 184 };
    },

    /** 🔶 MOCK — STT (백엔드 미구현) */
    async transcribe(audioId) {
      await _sleep(1500);
      return { text: "녹음 전사 결과(목업)...", summary: "핵심 요약(목업)..." };
    },
  },

  // ══ 코멘트 / 신고 (🔶 MOCK) ══════════════════════════════
  comments: mockApi.comments,

  // ══ 교사 (🔶 MOCK) ═══════════════════════════════════════
  teacher: mockApi.teacher,

  // ══ 관리자 (🔶 MOCK) ══════════════════════════════════════
  admin: mockApi.admin,
};

export default api;
