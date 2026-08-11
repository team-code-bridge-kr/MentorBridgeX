/**
 * api/index.js — 앱 전체 API 인터페이스
 * ─────────────────────────────────────────────────────────────────────
 * 화면(screens)과 store/actions 는 모두 이 파일의 api 객체를 통해
 * 백엔드와 통신합니다.
 *
 * 📌 "실제 백엔드 연결" vs "목업" 상태 요약
 * ──────────────────────────────────────────
 * ✅ LIVE  : auth.*, graph.*, documents.*, ingest.uploadPdf,
 *            comments.*, voice.*, forms.*, notifications.*, settings.*
 *            (활동 기록 S44 의 자료 검색 = 위 LIVE API 클라이언트 집계)
 * 🔶 MOCK  : auth.signInAdmin (partial), teacher.*, admin.*
 *
 * 백엔드 라우터 참고: services/api/app/routers/
 */

import { API_BASE, request, setToken, getToken, clearSession } from "./client.js";
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
    // 원본 시각도 넘긴다. 알림 화면이 활동 기록·음성 세션과 같은 날짜 묶음
    // (오늘·어제·최근 7일·이전)을 쓰는데, 이미 "5일 전" 으로 빚어 버리면
    // 다시 날짜로 되돌릴 수가 없다.
    at: n.created_at || null,
    read: !!n.read,
  };
}

function fmtDur(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h}시간 ${m}분`;
  // 1분이 안 되는 녹음을 "0분" 이라고 하면 녹음이 안 된 것처럼 보인다.
  if (!m) return `${Math.round(s)}초`;
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
//
// **노드는 색을 들고 다니지 않는다.** 색은 종류(root/topic/leaf)로 정해지므로
// 그리는 쪽에서 `KIND_META[n.kind].color` 를 읽는다. 예전에는 여기서 팔레트를
// 배열 순번으로 돌려 줬는데, 그러면 색이 **배열 인덱스의 함수**가 되어 노드를
// 하나 지우기만 해도 나머지 색이 밀렸고, 종류와 아무 상관이 없었다 — 캔버스
// 범례는 그 옆에서 "색 = 노드 유형"이라 적고 있었고, 대시보드 축소판은 이미
// KIND_META 를 읽고 있어서 두 화면이 같은 그래프를 다른 색으로 그렸다.
// 색의 진리를 한 곳에 두면 두 화면이 증명 가능하게 같아진다.

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
  // 생기부 구획으로 세운 뼈대(학년·과목·영역)는 가지다. 개념과 크기가 같으면
  // 무엇이 묶음이고 무엇이 내용인지 알 수 없다.
  if ((n.external_refs || {}).source === "structure") return "topic";
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

// 깊이별 반지름(%). 문서 0, 학년 16, 과목·영역 30, 개념 44.
// 마지막 겹은 46%까지만 쓴다 — 그 밖은 캔버스에서 잘린다.
const R_DEPTH = [0, 16, 30, 44];
// 같은 부모 아래 개념이 많으면 한 겹에 다 못 놓는다. 번갈아 안팎으로 벌린다.
const R_JITTER = [0, 5, -4, 9];
// 묶음이 아무리 작아도 이만큼의 각도 몫은 준다. 없으면 2~3개짜리 과목이
// 실오라기 같은 부채꼴을 받아 옆 가지와 겹친다.
const MIN_GROUP_WEIGHT = 2.5;
// 부채꼴 양 끝 여백. 비율로만 두면 작은 묶음은 여백도 같이 줄어 경계에서 맞붙는다.
const MIN_PAD_RAD = 0.06;
const CENTER_X = 50;
const CENTER_Y = 50;

function polar(angle, r) {
  const x = Math.max(4, Math.min(96, CENTER_X + r * Math.cos(angle)));
  const y = Math.max(4, Math.min(96, CENTER_Y + r * Math.sin(angle)));
  return { x: `${x.toFixed(1)}%`, y: `${y.toFixed(1)}%` };
}

/**
 * 그래프의 **진짜 선**을 따라가며 놓는 방사형 트리.
 *
 *   내 생기부(가운데) → 학년 → 과목·영역 → 개념
 *
 * 예전에는 이 층이 그림이었다. 백엔드 선이 전부 "개념 → 문서" 하나뿐이라,
 * 화면이 `external_refs.section` 으로 과목 묶음을 **지어내서** 트리처럼
 * 그렸다. 눌러도 아무 데도 가지 않고 고칠 수도 없는 가짜 가지였다.
 * 이제 백엔드가 구획을 노드로 세우므로(`graph_structure.py`) 선을 그대로 따라간다.
 *
 * 한 개념이 두 구획에 걸릴 수 있다. 배치는 **처음 닿은 부모**를 쓰고, 나머지
 * 선은 가지가 아니라 그냥 선으로 그린다 — 트리는 자리를 정하는 규칙일 뿐이고
 * 그래프가 트리라는 뜻은 아니다.
 */
function layoutTree(rawNodes, rawEdges) {
  const rootIdx = rawNodes.findIndex(
    (n) => String(n.type || "").toLowerCase() === DOC_TYPE,
  );
  if (rootIdx < 0) return null;

  const indexOf = new Map(rawNodes.map((n, i) => [n.id, i]));
  const kids = new Map();
  for (const e of rawEdges) {
    const from = indexOf.get(e.source_id);
    const to = indexOf.get(e.target_id);
    if (from == null || to == null || from === to) continue;
    if (!kids.has(to)) kids.set(to, []);
    kids.get(to).push(from);
  }

  // 너비 우선 — 문서에서 가까운 쪽이 부모가 된다.
  const parents = new Array(rawNodes.length).fill(null);
  const depth = new Array(rawNodes.length).fill(-1);
  const order = new Map(); // 부모 → 자식(중복 없이)
  depth[rootIdx] = 0;
  const queue = [rootIdx];
  for (let head = 0; head < queue.length; head += 1) {
    const cur = queue[head];
    for (const child of kids.get(cur) || []) {
      if (depth[child] >= 0) continue;
      depth[child] = depth[cur] + 1;
      parents[child] = rawNodes[cur].id;
      if (!order.has(cur)) order.set(cur, []);
      order.get(cur).push(child);
      queue.push(child);
    }
  }

  // 자리를 각도로 나눈다. 몫은 **자기 아래 말단 수**에 비례한다 — 그래야
  // 과목 40개짜리 학년과 과목 3개짜리 학년이 같은 몫을 받지 않는다.
  const weight = new Array(rawNodes.length).fill(0);
  for (let i = queue.length - 1; i >= 0; i -= 1) {
    const idx = queue[i];
    const children = order.get(idx) || [];
    weight[idx] = children.length
      ? children.reduce((sum, c) => sum + weight[c], 0)
      : 1;
  }

  const positions = new Array(rawNodes.length).fill(null);
  positions[rootIdx] = { x: `${CENTER_X}%`, y: `${CENTER_Y}%` };

  const place = (idx, a0, a1) => {
    const children = order.get(idx) || [];
    if (!children.length) return;
    const total = children.reduce((sum, c) => sum + weight[c] + MIN_GROUP_WEIGHT, 0) || 1;
    let a = a0;
    children.forEach((child, ci) => {
      const wedge = ((weight[child] + MIN_GROUP_WEIGHT) / total) * (a1 - a0);
      const pad = Math.min(wedge * 0.3, Math.max(wedge * 0.1, MIN_PAD_RAD));
      const d = Math.min(depth[child], R_DEPTH.length - 1);
      // 말단이 여럿이면 반지름을 번갈아 줘서 원주가 모자랄 때도 붙지 않게 한다.
      const isLeaf = !(order.get(child) || []).length;
      const r = R_DEPTH[d] + (isLeaf ? R_JITTER[ci % R_JITTER.length] : 0);
      positions[child] = polar(a + wedge / 2, r);
      place(child, a + pad, a + wedge - pad);
      a += wedge;
    });
  };
  place(rootIdx, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2);

  // 문서에서 닿지 못한 노드 — 선이 하나도 없는 것들이다. 숨기지 않는다.
  // 있는데 안 보이면 학생은 노드가 사라진 줄 안다. 다만 나무와 섞이지 않게
  // 바깥에 여러 겹으로 모아 둔다(한 겹에 70개를 놓으면 화면 밖으로 밀린다).
  const stray = rawNodes.map((_, i) => i).filter((i) => positions[i] === null);
  const STRAY_R = [40, 44, 48];
  stray.forEach((idx, i) => {
    const ring = i % STRAY_R.length;
    const inRing = Math.floor(i / STRAY_R.length);
    const perRing = Math.ceil(stray.length / STRAY_R.length);
    positions[idx] = polar((inRing / Math.max(perRing, 8)) * Math.PI * 2, STRAY_R[ring]);
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
function computeLayout(rawNodes, rawEdges = []) {
  const tree = layoutTree(rawNodes, rawEdges);
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
    // 설명은 노드 상세와 편집 폼이 함께 쓴다. 없으면 편집할 때 원래 설명이
    // 빈칸으로 보여서, 저장하는 순간 조용히 지워진다.
    description: n.description ?? "",
    kind,
    // 트리 배치에서 이 노드가 어느 가지에 매달리는지 (그래프 뷰의 가지 선)
    parentId: opts.parentId ?? null,
    // 다른 이름(별칭). 생기부에 "인공지능" 이라 적혀 있는데 노드 이름이 "AI"
    // 면 출처도 관계도 못 찾는다 — 별칭이 그 간극을 메운다.
    aliases: Array.isArray(refs.aliases) ? refs.aliases.filter(Boolean) : [],
    // 아이콘 결정에 쓴다: section = 과목·영역, type = 온톨로지 노드 유형
    section: sectionOf(n),
    // 생기부 구획으로 세운 뼈대 노드면 그 구획의 id. 눌렀을 때 원문으로
    // 데려가려면 이게 있어야 한다 — 없으면 "1학년 국어" 노드가 막다른 길이다.
    sectionId: typeof refs.section_id === "string" ? refs.section_id : "",
    // 교과군 노드(수학·과학·창의적 체험활동 …). 깊이를 고를 때 이 층이 기준이다.
    familyKey: typeof refs.family_key === "string" ? refs.family_key : "",
    type: n.type ?? null,
    x:     n.x ?? refs.x ?? pos?.x ?? `${cx.toFixed(0)}%`,
    y:     n.y ?? refs.y ?? pos?.y ?? `${cy.toFixed(0)}%`,
    /* 자식(topic·leaf)을 키웠다: 46 → 56, 32 → 44.
       한 화면에 126개가 깔려 있던 시절에는 작아야 겹치지 않았다. 층마다 한
       화면을 쓰게 되면서 한 번에 뜨는 것이 열 안팎으로 줄었으니, 남는 자리를
       노드에 준다 — 안의 아이콘(과목 표시)이 이 크기에서야 알아볼 만해진다.
       뿌리는 그대로 68. 자식이 커진 만큼 차이가 줄어 "가운데가 뿌리"라는 것은
       여전히 첫눈에 보인다. */
    size:  n.size ?? (kind === "root" ? 68 : kind === "topic" ? 56 : 44),
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
// 서버가 역할을 모를 때만 쓴다. 온보딩에서 한 번 고르면 서버 값이 이긴다.
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
          id:        data.user_id,
          email:     data.email,
          name:      displayName,
          role:      data.role || inferRole(email),
          onboarded: Boolean(data.onboarded),
          provider:  "password",
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
            role: data.role || "student",
            onboarded: Boolean(data.onboarded),
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
          role: data.role || inferRole(data.email),
          onboarded: Boolean(data.onboarded),
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
      const rawEdges = data.edges ?? [];
      const { positions, parents, hasDocument } = computeLayout(raw, rawEdges);
      return {
        nodes: raw.map((n, i) =>
          mapNode(n, i, raw.length, positions[i], { parentId: parents[i], hasDocument }),
        ),
        edges: rawEdges.map(mapEdge),
      };
    },

    /**
     * ✅ LIVE — POST /v1/students/me/graph/rebuild
     *
     * 생기부 구획으로 그래프의 층(개념 → 구획 → 학년 → 문서)을 다시 세운다.
     * 저장된 글에서 만들기 때문에 원본 PDF 가 없어도 되고, 여러 번 눌러도 안전하다.
     */
    async rebuild() {
      return request("/v1/students/me/graph/rebuild", { method: "POST" });
    },

    /**
     * ✅ LIVE — POST /v1/students/me/graph/nodes
     *
     * 과목·분야(section)는 external_refs 에 넣는다 — 아이콘과 배치가 그 값으로
     * 정해진다(sectionOf). 학생이 직접 만드는 노드도 AI 가 만든 노드와 같은
     * 자리에 같은 모양으로 서야 한다.
     */
    async addNode(node) {
      // source 를 남겨야 "출처 문장이 없는 이유" 를 말할 수 있다. 직접 만든
      // 노드에 생기부 문장이 없는 건 오류가 아니라 당연한 일이다.
      const refs = { source: "student" };
      if (node.section) refs.section = node.section;
      if (node.aliases?.length) refs.aliases = node.aliases;
      const data = await request("/v1/students/me/graph/nodes", {
        method: "POST",
        body: {
          label: node.label,
          type: node.type || "Keyword",
          description: node.description ?? "",
          external_refs: refs,
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

    /**
     * ✅ LIVE — 노드 고치기. **보낸 항목만** 바뀐다.
     * `section` 은 external_refs 로 옮겨 담는다(서버가 그 안을 본다).
     */
    async updateNode(id, patch) {
      const body = {};
      if (patch.label !== undefined) body.label = patch.label;
      if (patch.description !== undefined) body.description = patch.description;
      if (patch.type !== undefined) body.type = patch.type;
      // external_refs 는 보낸 열쇠만 덮어쓴다(서버가 병합한다). 그래서 과목과
      // 별칭을 따로 보내도 서로를 지우지 않는다.
      if (patch.section !== undefined || patch.aliases !== undefined) {
        body.external_refs = {};
        if (patch.section !== undefined) body.external_refs.section = patch.section;
        if (patch.aliases !== undefined) body.external_refs.aliases = patch.aliases;
      }
      return request(`/v1/students/me/graph/nodes/${id}`, { method: "PATCH", body });
    },

    /**
     * ✅ LIVE — GET /v1/students/me/graph/nodes/{id}/evidence
     *
     * 이 노드 이름이 적혀 있던 생기부 문장. 저장된 값이 아니라 서버가 그때그때
     * 원문에서 찾아 준다 — 생기부를 고치면 출처도 따라 바뀐다.
     */
    async nodeEvidence(id) {
      const data = await request(`/v1/students/me/graph/nodes/${id}/evidence`);
      return {
        origin: data.origin || "document",
        total: data.total ?? 0,
        quotes: (data.quotes ?? []).map((q) => ({
          sectionLabel: q.section_label || "",
          text: q.text || "",
          start: q.match_start ?? 0,
          end: q.match_end ?? 0,
        })),
      };
    },

    /**
     * ✅ LIVE — GET /v1/students/me/graph/links/suggested
     *
     * 생기부 같은 문장에 함께 나온 노드 짝. 잇지는 않는다 — 근거 문장을 함께
     * 돌려주고 결정은 학생이 한다.
     */
    async suggestedLinks(limit = 30, nodeId = null) {
      const q = new URLSearchParams({ limit: String(limit) });
      if (nodeId) q.set("node_id", nodeId);
      const data = await request(`/v1/students/me/graph/links/suggested?${q}`);
      return Array.isArray(data) ? data : [];
    },

    /**
     * ✅ LIVE — GET /v1/students/me/graph/gaps
     *
     * 그래프의 빈 곳 — 없는 과목 / 이어지지 않은 개념 / 요즘 안 보이는 주제.
     */
    async gaps() {
      return request("/v1/students/me/graph/gaps");
    },

    /** ✅ LIVE — DELETE /v1/students/me/graph/edges/{id} — 연결 끊기 */
    async removeEdge(id) {
      await request(`/v1/students/me/graph/edges/${id}`, { method: "DELETE" });
      return { id };
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
    /**
     * 영역 하나를 새로 만든다.
     * @param extra 세특일 때만 쓴다 — `{ subject_id, period_id }`. 세특은 한
     *   영역이 아니라 학년별 과목이라, 이름표 없이 만들면 다른 세특들 사이에서
     *   어느 과목 것인지 알 수 없다.
     */
    async create(sectionType, content, extra) {
      return request("/v1/students/me/documents", {
        method: "POST",
        body: { section_type: sectionType, content, ...(extra || {}) },
      });
    },
    async patch(sectionId, content) {
      return request(`/v1/students/me/documents/${sectionId}`, {
        method: "PATCH",
        body: { content },
      });
    },
    /** 영역 하나를 지운다. 그래프 노드는 남는다(손으로 고친 것일 수 있다). */
    async remove(sectionId) {
      return request(`/v1/students/me/documents/${sectionId}`, { method: "DELETE" });
    },
    /**
     * ✅ LIVE — POST /v1/students/me/documents/split-subjects
     *
     * 한 덩어리로 저장된 세특을 과목별 영역으로 가른다. 글자는 버리지 않고
     * `[과목]` 표시를 되짚어 나누기만 한다. 여러 번 불러도 안전하다.
     */
    async splitSubjects() {
      return request("/v1/students/me/documents/split-subjects", { method: "POST" });
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

  // ══ 생기부 원본 PDF ═══════════════════════════════════════
  // 학생당 최신본 한 개만 보관한다. 민감 정보라 본인만 읽을 수 있고
  // 응답에 Cache-Control: no-store 가 붙는다 (서버 쪽 규칙).
  documentFile: {
    async meta() {
      return request("/v1/students/me/documents/file/meta");
    },
    async put(file) {
      const fd = new FormData();
      fd.append("file", file, file.name || "record.pdf");
      return request("/v1/students/me/documents/file", { method: "PUT", formData: fd });
    },
    async remove() {
      return request("/v1/students/me/documents/file", { method: "DELETE" });
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
    /**
     * ✅ LIVE — DELETE /v1/students/me/voice/sessions/{id}
     *
     * 소리는 애초에 저장하지 않으므로 여기서 사라지는 것은 옮겨 적은 글이다.
     */
    async removeSession(id) {
      await request(`/v1/students/me/voice/sessions/${id}`, { method: "DELETE" });
      return { id };
    },
    /**
     * ✅ LIVE — 받아쓰기. 저장하지 않고 인식 결과 문장만 돌려준다.
     * AI 입력창의 마이크가 쓴다 (녹음 세션과 별개).
     */
    async dictate(blob) {
      const fd = new FormData();
      fd.append("file", blob, "dictation.webm");
      const data = await request("/v1/students/me/voice/dictation", {
        method: "POST",
        formData: fd,
      });
      return data.text || "";
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
    /**
     * ✅ LIVE — POST /v1/students/me/forms/fill (multipart)
     *
     * 학교에서 받은 양식을 올리면 항목을 찾아 채운다. 파일은 보관하지 않는다 —
     * 글자만 뽑아 쓰고 바이트는 버린다.
     */
    async fillFromFile(file) {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/v1/students/me/forms/fill`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });
      const raw = await res.text();
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { msg = JSON.parse(raw)?.error?.message || msg; } catch { /* 상태코드로 */ }
        throw new Error(msg);
      }
      return JSON.parse(raw);
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

  // ══ 설정 ✅ LIVE ═════════════════════════════════════════
  settings: {
    async get() {
      return request("/v1/students/me/settings");
    },
    async patch(body) {
      return request("/v1/students/me/settings", { method: "PATCH", body });
    },
  },

  account: {
    /**
     * 계정과 딸린 모든 기록을 지운다. 되돌릴 수 없다.
     *
     * 서버가 이메일을 다시 확인한다 — 화면에서만 막으면 주소창으로 부르는
     * 것을 막을 수 없다.
     */
    async remove(email) {
      return request(
        `/v1/students/me/account?confirm_email=${encodeURIComponent(email)}`,
        { method: "DELETE" },
      );
    },
  },

  // ══ 탐구주제 피드 (✅ LIVE) ═════════════════════════════
  // 백엔드: services/api/app/features/research/
  research: {
    /** 학과 프리셋 목록 (계열별 그룹은 화면에서 묶는다) */
    async tracks() {
      const data = await request("/v1/research/tracks", { auth: false });
      return data.tracks || [];
    },
    /** 온보딩 여부 + 선택한 트랙 */
    async profile() {
      return request("/v1/research/profile");
    },
    /** 트랙 선택 → 프리셋 키워드가 내 키워드로 복사된다 */
    async setTrack(trackId) {
      return request("/v1/research/profile", {
        method: "PUT",
        body: { track_id: trackId },
      });
    },
    async keywords() {
      const data = await request("/v1/research/keywords");
      return data.keywords || [];
    },
    async addKeyword(keyword) {
      const data = await request("/v1/research/keywords", {
        method: "POST",
        body: { keyword },
      });
      return data.keywords || [];
    },
    async removeKeyword(keyword) {
      return request(`/v1/research/keywords/${encodeURIComponent(keyword)}`, {
        method: "DELETE",
      });
    },
    /**
     * 피드. cursor 는 이전 응답의 next_cursor 를 그대로 넘긴다 (keyset 페이지네이션).
     * OFFSET 이 아니라서 수집이 도는 중에도 중복·누락이 생기지 않는다.
     */
    async feed({
      tab = "all", cursor = null, limit = 20,
      query = "", days = 0, keywords = [], from = "", to = "", sort = "latest",
    } = {}) {
      const q = new URLSearchParams({ tab, limit: String(limit) });
      if (cursor) q.set("cursor", cursor);
      // 검색어가 있으면 내 키워드 울타리를 넘어 전체에서 찾는다 (백엔드 규칙)
      if (query) q.set("q", query);
      if (days) q.set("days", String(days));
      if (from) q.set("from", from);
      if (to) q.set("to", to);
      if (sort && sort !== "latest") q.set("sort", sort);
      // 고른 키워드는 반복 파라미터로 — 서버가 OR 로 묶는다
      for (const k of keywords) q.append("keyword", k);
      return request(`/v1/research/feed?${q}`);
    },
    async markRead(articleId) {
      return request("/v1/research/reads", {
        method: "POST",
        body: { article_id: articleId },
      });
    },
    async setSaved(articleId, saved) {
      return request("/v1/research/saves", {
        method: "POST",
        body: { article_id: articleId, saved },
      });
    },
    /**
     * ✅ LIVE — POST /v1/research/feedback
     *
     * 취향 표시. `like` 는 정렬 "취향순"이 그 주제를 앞으로 올리는 근거가 되고,
     * `hide` 는 목록에서 빼고 다시 보여주지 않는다. `none` 은 표시를 지운다.
     */
    async setFeedback(articleId, value) {
      return request("/v1/research/feedback", {
        method: "POST",
        body: { article_id: articleId, value: value || "none" },
      });
    },
    /** 읽은 글에서 자주 나온 개념 상위 N개 */
    async discover(limit = 20) {
      return request(`/v1/research/discover?limit=${limit}`);
    },
    async runIngest() {
      return request("/v1/research/ingest/run", { method: "POST" });
    },
    async ingestLogs() {
      return request("/v1/research/ingest/logs");
    },
  },

  // ══ MBX AI 어시스턴트 (✅ LIVE) ══════════════════════════
  // 백엔드: services/api/app/features/assistant/
  assistant: {
    /** 대시보드가 필요한 요약을 한 번에 (주간 활동 · 그래프 · 피드백 · 알림) */
    async dashboard() {
      return request("/v1/assistant/dashboard");
    },

    /**
     * SSE 스트리밍 대화.
     *
     * EventSource 는 Authorization 헤더를 못 붙여서 fetch + ReadableStream 으로 읽는다.
     * onEvent 로 {type:"delta"|"card"|"error"|"start"|"done"} 이 순서대로 넘어온다.
     * 반환되는 abort() 로 중간에 끊을 수 있다.
     */
    chatStream({ message, conversationId = null, context = [], onEvent }) {
      const controller = new AbortController();

      const run = async () => {
        const res = await fetch(`${API_BASE}/v1/assistant/chat`, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            message,
            conversation_id: conversationId,
            context: context.map((c) => ({ type: c.type, id: c.id ?? null })),
          }),
        });

        if (!res.ok || !res.body) {
          const raw = await res.text();
          let msg = `HTTP ${res.status}`;
          try {
            msg = JSON.parse(raw)?.error?.message || msg;
          } catch { /* 본문이 JSON 이 아니면 상태코드로 */ }
          onEvent({ type: "error", message: msg });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // SSE 프레임은 빈 줄로 구분된다. 청크 경계가 프레임 가운데를 자를 수
        // 있으므로 마지막 미완성 프레임은 버퍼에 남겨둔다.
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            const line = frame.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            try {
              onEvent(JSON.parse(line.slice(6)));
            } catch { /* 깨진 프레임은 버린다 */ }
          }
        }
      };

      const promise = run().catch((e) => {
        if (e.name !== "AbortError") {
          onEvent({ type: "error", message: e.message || "연결이 끊겼습니다." });
        }
      });

      return { abort: () => controller.abort(), done: promise };
    },

    async conversations(limit = 3) {
      const data = await request(`/v1/assistant/conversations?limit=${limit}`);
      return data.conversations || [];
    },
    async conversation(id) {
      return request(`/v1/assistant/conversations/${id}`);
    },
    /** 대화 이름 바꾸기. 서버가 앞뒤 공백을 다듬어 최종 이름을 돌려준다. */
    async renameConversation(id, title) {
      return request(`/v1/assistant/conversations/${id}`, {
        method: "PATCH",
        body: { title },
      });
    },
    async removeConversation(id) {
      return request(`/v1/assistant/conversations/${id}`, { method: "DELETE" });
    },
  },

  // ══ 최근 활동 (✅ LIVE) ═══════════════════════════════════
  // 백엔드: services/api/app/features/activity/
  // 사이드바와 대시보드가 **같은 엔드포인트**를 쓴다 — 두 곳이 각자 목록을
  // 만들면 정렬이 갈리고, 한쪽에서 바꾼 이름이 다른 쪽에 반영되지 않는다.
  activity: {
    async recent({ limit = 8, kind = "all", q = "" } = {}) {
      const params = new URLSearchParams({ limit: String(limit), kind });
      if (q) params.set("q", q);
      return request(`/v1/activity/recent?${params}`);
    },
    /** 이름 변경 · 고정 */
    async update(key, patch) {
      return request(`/v1/activity/${encodeURIComponent(key)}`, {
        method: "PATCH",
        body: patch,
      });
    },
    /**
     * 목록에서 숨긴다. `deleteSource` 를 켜야 대화까지 지워진다 —
     * 그래프·기사·문서 원본은 어떤 경우에도 지우지 않는다.
     */
    async remove(key, { deleteSource = false } = {}) {
      const qs = deleteSource ? "?delete_source=true" : "";
      return request(`/v1/activity/${encodeURIComponent(key)}${qs}`, { method: "DELETE" });
    },
  },

  // ══ 온보딩 (✅ LIVE) ═════════════════════════════════════
  // 백엔드: services/api/app/features/onboarding/
  onboarding: {
    /** 서버가 기억하는 진행 상태. 화면을 닫았다 들어와도 여기서부터 이어간다. */
    async state() {
      return request("/v1/onboarding");
    },
    /**
     * 바뀐 것만 보낸다. 보내지 않은 항목은 서버에서 그대로 둔다.
     * majors 는 `[]` 도 뜻이 있다("아직 모르겠어요") — undefined 와 구분해서 보낼 것.
     */
    async patch(patch) {
      return request("/v1/onboarding", { method: "PATCH", body: patch });
    },
    /** STEP 4 — 프리셋에서 고른 것 + 직접 적은 것 */
    async setKeywords(preset, manual) {
      return request("/v1/onboarding/keywords", {
        method: "POST",
        body: { preset, manual },
      });
    },
    /** 완료 직전 미리보기. matched=false 면 최신글로 대신 채운 것이다. */
    async preview() {
      return request("/v1/onboarding/preview");
    },
    async complete() {
      return request("/v1/onboarding/complete", { method: "POST" });
    },
  },

  // ══ 학급 (✅ LIVE) ═══════════════════════════════════════
  classrooms: {
    async mine() {
      const data = await request("/v1/classrooms");
      return data.classrooms || [];
    },
    /** 교사만. 6자리 참여 코드를 서버가 만들어 준다. */
    async create(name, school) {
      return request("/v1/classrooms", { method: "POST", body: { name, school } });
    },
    async join(joinCode) {
      return request("/v1/classrooms/join", {
        method: "POST",
        body: { join_code: joinCode },
      });
    },
  },

  // ══ 교사 (🔶 MOCK) ═══════════════════════════════════════
  teacher: mockApi.teacher,

  // ══ 관리자 (🔶 MOCK) ══════════════════════════════════════
  admin: mockApi.admin,
};

export default api;
