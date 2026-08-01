/**
 * api/index.js — 앱 전체 API 인터페이스
 * ─────────────────────────────────────────────────────────────────────
 * 화면(screens)과 store/actions 는 모두 이 파일의 api 객체를 통해
 * 백엔드와 통신합니다.
 *
 * 📌 "실제 백엔드 연결" vs "목업" 상태 요약
 * ──────────────────────────────────────────
 * ✅ LIVE  : auth.*, graph.*, documents.*, ingest.uploadPdf,
 *            comments.*, voice.*, forms.*, notifications.*, stats.*, settings.*
 *            (통합검색 S27 = 위 LIVE API 클라이언트 집계)
 * 🔶 MOCK  : auth.signInAdmin (partial), teacher.*, admin.*
 *
 * 백엔드 라우터 참고: services/api/app/routers/
 */

import { request, setToken, clearSession } from "./client.js";
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

const DOC_TYPE = "document";

/**
 * 노드 종류.
 *
 * 생기부 문서 노드가 있으면 그게 그래프의 중심이다 (document → 핵심,
 * subject → 과목 가지, 나머지 → 말단). 문서 노드가 없는 그래프(시드만 넣은
 * 경우, 오프라인 데모)에서는 예전처럼 subject 를 핵심으로 쓴다.
 */
function nodeKind(n, hasDocument = false) {
  const t = String(n.type || "").toLowerCase();
  if (t === DOC_TYPE) return "root";
  if (hasDocument) return t === "subject" ? "topic" : "leaf";
  if (t === "subject") return "root";
  if (t === "inquiry" || t === "keyword") return "topic";
  return "leaf";
}

// 생기부에서 뽑은 노드는 external_refs.section 에 어느 과목/영역에서 나왔는지가 들어 있다.
function sectionOf(n) {
  const raw = (n.external_refs || {}).section;
  const section = typeof raw === "string" ? raw.trim() : "";
  return section || "기타";
}

// 중심(생기부 문서) / 과목 가지 / 말단의 반지름(%).
const R_HUB = 18;
// 말단은 네 겹으로 번갈아 놓는다. 겹이 적으면 큰 과목에서 원주가 모자라 붙어버린다.
// 123개 실측 기준 3겹이면 겹침 8개, 4겹이면 0개다. 바깥 45%까지만 써서 잘림을 피한다.
const R_LEAF = [26, 33, 39, 45];
// 묶음이 아무리 작아도 이만큼의 각도 몫은 준다. 없으면 2~3개짜리 과목이
// 실오라기 같은 부채꼴을 받아 옆 가지와 겹친다.
const MIN_GROUP_WEIGHT = 2.5;
// 부채꼴 양 끝 여백. 비율로만 두면 작은 과목은 여백도 같이 줄어 경계에서 맞붙는다.
// 절대 최소값을 두되, 부채꼴을 다 잡아먹지 않게 위쪽도 막는다.
const MIN_PAD_RAD = 0.10;
const CENTER_X = 50;
const CENTER_Y = 50;

function polar(angle, r) {
  const x = Math.max(4, Math.min(96, CENTER_X + r * Math.cos(angle)));
  const y = Math.max(4, Math.min(96, CENTER_Y + r * Math.sin(angle)));
  return { x: `${x.toFixed(1)}%`, y: `${y.toFixed(1)}%` };
}

/**
 * 생기부 문서를 중심에 두는 방사형 트리 배치.
 *
 *   생기부 문서(중앙) → 과목/영역(안쪽 고리) → 그 과목에서 나온 노드(바깥 고리)
 *
 * 그래프 엣지는 전부 "노드 → 문서"(MENTIONED_IN)로 붙어 있어서 그대로 그리면
 * 60개 선이 중앙으로 쏟아진다. 대신 external_refs.section 으로 과목별 묶음을
 * 만들고, 묶음마다 각도 구간을 노드 수에 비례해 나눠 준다. 비례 배분이라
 * 큰 과목도 좁은 과목도 밀도가 비슷해진다.
 *
 * 문서 노드가 없으면 null 을 돌려주고 호출부가 기존 해바라기 배치로 넘어간다.
 */
function layoutRadialTree(rawNodes) {
  const docIdx = rawNodes.findIndex(
    (n) => String(n.type || "").toLowerCase() === DOC_TYPE,
  );
  if (docIdx < 0) return null;

  const docId = rawNodes[docIdx].id;
  const positions = new Array(rawNodes.length).fill(null);
  const parents = new Array(rawNodes.length).fill(null);
  positions[docIdx] = { x: `${CENTER_X}%`, y: `${CENTER_Y}%` };

  // 1. 과목/영역별로 묶는다
  const groups = new Map();
  rawNodes.forEach((n, i) => {
    if (i === docIdx) return;
    const key = sectionOf(n);
    if (!groups.has(key)) groups.set(key, { key, members: [] });
    groups.get(key).members.push(i);
  });

  // 2. 묶음마다 가지의 뿌리를 정한다: 이름이 같은 Subject > 아무 Subject >
  //    (3개 이상이면) 첫 노드. 없는 노드를 만들어 넣지는 않는다.
  for (const g of groups.values()) {
    const subjects = g.members.filter(
      (i) => String(rawNodes[i].type || "").toLowerCase() === "subject",
    );
    const exact = subjects.find((i) => rawNodes[i].label === g.key);
    g.hub = exact ?? subjects[0] ?? (g.members.length >= 3 ? g.members[0] : -1);
    g.leaves = g.members.filter((i) => i !== g.hub);
  }

  // 3. 큰 묶음부터 배치 (같은 크기면 이름순 — 새로고침해도 자리가 그대로다)
  const list = [...groups.values()].sort(
    (a, b) => b.members.length - a.members.length || (a.key < b.key ? -1 : 1),
  );
  const weightOf = (g) => g.members.length + MIN_GROUP_WEIGHT;
  const totalWeight = list.reduce((sum, g) => sum + weightOf(g), 0) || 1;

  let angle = -Math.PI / 2; // 12시 방향부터
  list.forEach((g, gi) => {
    const wedge = (weightOf(g) / totalWeight) * Math.PI * 2;
    const pad = Math.min(wedge * 0.35, Math.max(wedge * 0.12, MIN_PAD_RAD));
    const a0 = angle + pad;
    const a1 = angle + wedge - pad;
    // 말단은 고리를 번갈아 쓴다. 같은 고리에 연달아 놓이지 않으므로
    // 부채꼴이 좁아도 이웃과 반지름이 달라 떨어져 보인다.
    const spread = (items, radiusAt) => {
      items.forEach((idx, i) => {
        const t = items.length === 1 ? 0.5 : i / (items.length - 1);
        positions[idx] = polar(a0 + (a1 - a0) * t, radiusAt(i));
      });
    };

    if (g.hub >= 0) {
      positions[g.hub] = polar(angle + wedge / 2, R_HUB);
      parents[g.hub] = docId;
      const hubId = rawNodes[g.hub].id;
      g.leaves.forEach((idx) => { parents[idx] = hubId; });
    } else {
      // 뿌리로 삼을 노드가 없는 묶음은 문서에 바로 매단다
      g.leaves.forEach((idx) => { parents[idx] = docId; });
    }
    // 고리 순서를 묶음마다 한 칸씩 밀어, 이웃 부채꼴의 경계에서 만나는 두 노드가
    // 같은 고리에 놓이지 않게 한다 (남는 겹침은 대부분 여기서 생겼다).
    spread(g.leaves, (i) => R_LEAF[(i + gi) % R_LEAF.length]);

    angle += wedge;
  });

  return { positions, parents };
}

// 황금각. 해바라기 씨앗 배열과 같은 원리로, 어떤 개수에서도 겹치지 않고
// 원판을 고르게 채운다.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * 노드 전체의 배치 좌표를 한 번에 계산한다.
 *
 * 이전에는 모든 노드를 반지름 32% 인 원 하나에 올려서, 노드가 수십 개만 되어도
 * 원주에 몰려 라벨이 서로 겹쳤다. 여기서는 원판 안쪽까지 사용하고(반지름을
 * sqrt 로 키워 면적당 밀도를 균일하게 유지), 같은 유형끼리 인접하도록 종류
 * 순으로 정렬해 시각적 군집이 생기게 한다.
 */
function layoutPositions(rawNodes) {
  const KIND_ORDER = { root: 0, topic: 1, leaf: 2 };
  const order = rawNodes.map((_, i) => i);
  order.sort((a, b) => {
    const ka = KIND_ORDER[nodeKind(rawNodes[a])] ?? 3;
    const kb = KIND_ORDER[nodeKind(rawNodes[b])] ?? 3;
    return ka - kb || a - b;
  });

  const count = order.length;
  // 노드가 적으면 굳이 넓게 벌리지 않는다.
  const maxR = count <= 12 ? 28 : 42;
  const positions = new Array(count);

  order.forEach((originalIdx, rank) => {
    const r = count <= 1 ? 0 : Math.sqrt((rank + 0.5) / count) * maxR;
    const angle = rank * GOLDEN_ANGLE;
    positions[originalIdx] = {
      x: `${(50 + r * Math.cos(angle)).toFixed(1)}%`,
      y: `${(48 + r * Math.sin(angle)).toFixed(1)}%`,
    };
  });
  return positions;
}

/**
 * 배치 계산 진입점. 생기부 문서가 있으면 방사형 트리, 없으면 해바라기 배치.
 */
function computeLayout(rawNodes) {
  const tree = layoutRadialTree(rawNodes);
  if (tree) return { ...tree, hasDocument: true };
  return {
    positions: layoutPositions(rawNodes),
    parents: new Array(rawNodes.length).fill(null),
    hasDocument: false,
  };
}

function mapNode(n, idx, total = 8, pos = null, opts = {}) {
  // 백엔드 GraphNode: { id, label, type, description, external_refs, ... }
  // UI 기대: { id, label, kind, x, y, color, size, cat, parentId }
  // pos 가 없을 때(단건 생성 등)만 쓰는 원형 폴백
  const angle  = (idx / Math.max(total, 8)) * Math.PI * 2;
  const cx     = 50 + Math.cos(angle) * 32;
  const cy     = 48 + Math.sin(angle) * 32;
  const kind = nodeKind(n, opts.hasDocument ?? false);
  const refs = n.external_refs || {};
  return {
    id:    n.id,
    label: n.label,
    kind,
    // 트리 배치에서 이 노드가 어느 가지에 매달리는지 (그래프 뷰의 가지 선)
    parentId: opts.parentId ?? null,
    // 아이콘 결정에 쓴다: section = 과목·영역, type = 온톨로지 노드 유형
    section: sectionOf(n),
    type: n.type ?? null,
    x:     n.x ?? refs.x ?? pos?.x ?? `${cx.toFixed(0)}%`,
    y:     n.y ?? refs.y ?? pos?.y ?? `${cy.toFixed(0)}%`,
    color: n.color ?? refs.color ?? PALETTE[idx % PALETTE.length],
    size:  n.size ?? (kind === "root" ? 68 : kind === "topic" ? 46 : 32),
    cat:   n.cat  ?? (kind === "root" ? "핵심 노드" : kind === "topic" ? "연결 노드" : "말단 노드"),
  };
}
function mapEdge(e) {
  // 백엔드 GraphEdge: { id, source_id, target_id, relation }
  // UI 기대: { id, from, to, relation }
  return {
    id: e.id,
    from: e.source_id ?? e.from,
    to: e.target_id ?? e.to,
    relation: e.relation ?? null,
  };
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
          picture: data.picture || null,
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
      clearSession();
      return true;
    },
  },

  // ══ 그래프 ════════════════════════════════════════════════
  graph: {
    /** ✅ LIVE — GET /v1/students/me/graph (빈 그래프면 빈 배열 그대로) */
    async fetch(userId) {
      const data = await request("/v1/students/me/graph");
      const raw = data.nodes ?? [];
      const { positions, parents, hasDocument } = computeLayout(raw);
      return {
        nodes: raw.map((n, i) =>
          mapNode(n, i, raw.length, positions[i], { parentId: parents[i], hasDocument }),
        ),
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

    /** ✅ LIVE — PATCH /v1/students/me/graph/nodes/{id} — 노드 이름 변경 */
    async renameNode(id, label) {
      return request(`/v1/students/me/graph/nodes/${id}`, {
        method: "PATCH",
        body: { label },
      });
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
      const arr = Array.isArray(data) ? data : data.nodes ?? [];
      const { positions, parents, hasDocument } = computeLayout(arr);
      return arr.map((n, i) =>
        mapNode(n, i, arr.length, positions[i], { parentId: parents[i], hasDocument }),
      );
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

  // ══ 가지치기 추천 (2단계) ══════════════════════════════════
  // 1단계(recommend)는 웹 검색을 하지 않습니다.
  // 2단계(research)는 학생이 '관련 자료 찾기'를 눌렀을 때만 호출하세요.
  pruning: {
    /** ✅ LIVE — POST /v1/students/me/recommendations/pruning */
    async recommend(nodeId, grade) {
      return request("/v1/students/me/recommendations/pruning", {
        method: "POST",
        body: { node_id: nodeId, grade: grade ?? null },
      });
    },

    /** ✅ LIVE — POST .../pruning/{id}/research — 여기서만 웹 검색이 실행됩니다 */
    async research(recommendationId, nodeId, grade) {
      return request(
        `/v1/students/me/recommendations/pruning/${encodeURIComponent(recommendationId)}/research`,
        { method: "POST", body: { node_id: nodeId, grade: grade ?? null } },
      );
    },

    /** ✅ LIVE — POST .../pruning/{id}/expand — 추천을 그래프 노드로 저장 */
    async expand(recommendationId, nodeId, grade) {
      return request(
        `/v1/students/me/recommendations/pruning/${encodeURIComponent(recommendationId)}/expand`,
        { method: "POST", body: { node_id: nodeId, grade: grade ?? null } },
      );
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
