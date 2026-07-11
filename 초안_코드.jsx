import { useState, useEffect, useCallback, useReducer, useContext, createContext, useMemo, useRef } from "react";

/* ══════════════════════════════════════════════════════════════════════
   ██  API LAYER  ██  ── 백엔드 연결 지점 (BACKEND INTEGRATION POINT) ──
   ──────────────────────────────────────────────────────────────────────
   ▸ 지금은 전부 목업(가짜 데이터 + 지연)으로 동작합니다.
   ▸ 백엔드팀: 각 함수 "내부"만 실제 fetch/SDK 호출로 교체하세요.
     함수 시그니처(인자/리턴 형태)는 그대로 두면 화면 코드는 손댈 필요 없음.
   ▸ 예)  return mock(...)  →  const r = await fetch('/v1/...'); return r.json();
   ══════════════════════════════════════════════════════════════════════ */
const API_BASE = "/v1";                 // TODO(backend): 실제 API 베이스 URL
const NET_DELAY = 500;                   // 목업 네트워크 지연(ms) — 백엔드 연결 시 제거
const _sleep = (ms=NET_DELAY) => new Promise(r=>setTimeout(r, ms));
const _uid   = (p="id") => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`;

/* 목업 사용자 디렉터리 (백엔드 연결 시 삭제) */
const _MOCK_USERS = [
  { email:"hong@school.ac.kr",     password:"1234", name:"홍길동",   role:"student" },
  { email:"sujin@school.ac.kr",    password:"1234", name:"이수진",   role:"teacher" },
  { email:"admin@school.ac.kr",    password:"admin",name:"시스템 관리자", role:"admin", mfa:true },
];

const api = {
  auth: {
    /** 이메일+비밀번호 로그인 → { token, user } */
    async signInWithPassword(email, password) {
      await _sleep();
      const u = _MOCK_USERS.find(x => x.email===email.trim().toLowerCase());
      if (!u || u.password!==password) { const e=new Error("이메일 또는 비밀번호가 올바르지 않습니다."); e.code="auth/invalid-credential"; throw e; }
      return { token:_uid("tok"), user:{ id:_uid("u"), email:u.email, name:u.name, role:u.role, provider:"password" } };
    },
    /** Google OAuth 시작 — 프론트는 백엔드 OAuth 시작 URL로 "리다이렉트"만 함.
     *  실제 토큰 교환은 백엔드에서 이뤄지고 S02(OAuth 콜백)로 돌아옴.
     *  지금은 목업이라 콜백 없이 바로 세션을 만들어 반환. */
    async signInWithGoogle() {
      await _sleep(700);
      // TODO(backend): window.location.href = `${API_BASE}/auth/google/start?redirect=/oauth/callback`
      return { token:_uid("tok"), user:{ id:_uid("u"), email:"student@gmail.com", name:"김학생", role:"student", provider:"google" } };
    },
    /** OAuth 콜백에서 code→token 교환 (S02에서 호출) */
    async exchangeOAuthCode(code) {
      await _sleep();
      return { token:_uid("tok"), user:{ id:_uid("u"), email:"student@gmail.com", name:"김학생", role:"student", provider:"google" } };
    },
    /** 관리자 로그인 (MFA 포함) */
    async signInAdmin(email, password, mfaCode) {
      await _sleep();
      const u = _MOCK_USERS.find(x => x.email===email.trim().toLowerCase() && x.role==="admin");
      if (!u || u.password!==password) { const e=new Error("관리자 인증 실패"); e.code="auth/invalid-credential"; throw e; }
      if (!mfaCode || mfaCode.length<6) { const e=new Error("MFA 코드 6자리를 입력하세요."); e.code="auth/mfa-required"; throw e; }
      return { token:_uid("tok"), user:{ id:_uid("u"), email:u.email, name:u.name, role:"admin", provider:"password", mfa:true } };
    },
    async signOut() { await _sleep(150); return true; },
  },

  /* ── 그래프 (학생) ── */
  graph: {
    async fetch(userId) { await _sleep(); return { nodes:[...SEED_NODES], edges:[...SEED_EDGES] }; },
    async addNode(node)  { await _sleep(); return { ...node, id:_uid("n"), createdAt:Date.now() }; },
    async addEdge(edge)  { await _sleep(); return { ...edge, id:_uid("e") }; },
    async removeNode(id) { await _sleep(); return { id }; },
    /** 시드 키워드 → 그래프 생성 (백엔드: 임베딩/추천 모델) */
    async generateFromSeeds(keywords) {
      await _sleep(900);
      const palette = ["#3182f6","#4593fc","#22c55e","#f59e0b","#8b95a1","#f04452"];
      const N = keywords.length;
      return keywords.map((k,i)=>{
        const angle = (i / Math.max(N,1)) * Math.PI * 2;
        const cx = 50 + Math.cos(angle) * 28;   // 원형 배치
        const cy = 48 + Math.sin(angle) * 30;
        return { id:_uid("n"), label:k, kind:i===0?"root":"topic",
          x:`${cx.toFixed(0)}%`, y:`${cy.toFixed(0)}%`,
          color:palette[i%palette.length], size:i===0?60:44,
          cat:i===0?"핵심 노드":"연결 노드" };
      });
    },
    /** 가지치기 추천 (백엔드: 추천 모델) */
    async pruneSuggestions(userId) { await _sleep(700); return [...SEED_NODES].slice(0,3).map(n=>({ nodeId:n.id, reason:"최근 6개월 활동 없음" })); },
  },

  /* ── PDF / 음성 (백엔드: 파싱·STT·요약) ── */
  ingest: {
    async uploadPdf(file)   { await _sleep(1200); return { docId:_uid("doc"), pages:12, parsed:[{ title:"활동 제목", body:"파싱된 본문..." }] }; },
    async uploadAudio(blob) { await _sleep(1200); return { audioId:_uid("aud"), durationSec:184 }; },
    async transcribe(audioId){ await _sleep(1500); return { text:"녹음 전사 결과(목업)...", summary:"핵심 요약(목업)..." }; },
  },

  /* ── 코멘트 / 신고 ── */
  comments: {
    async list(targetId) { await _sleep(); return [...MOCK_COMMENTS]; },
    async create(c)      { await _sleep(); return { ...c, id:_uid("c"), createdAt:Date.now(), reports:0, status:"active" }; },
    async report(id, reason){ await _sleep(); return { id, reason, status:"검토 중" }; },
    async remove(id)     { await _sleep(); return { id }; },
  },

  /* ── 교사 자격 검증 / 담당 학생 ── */
  teacher: {
    async submitVerification(payload) {
      await _sleep(800);
      return { id:_uid("tapp"), ...payload, status:"검토 중", submittedAt:Date.now() };
    },
    async fetchVerificationStatus(userId) { await _sleep(); return null; }, // 목업: 미신청
    async listStudents(teacherId) { await _sleep(); return [...MOCK_STUDENTS]; },
  },

  /* ── 관리자 ── */
  admin: {
    async listUsers(q)        { await _sleep(); return [...MOCK_ADMIN_USERS]; },
    async suspendUser(id, r)  { await _sleep(); return { id, status:"정지됨", reason:r }; },
    async deleteUser(id)      { await _sleep(); return { id, status:"삭제됨" }; },
    async listReports()       { await _sleep(); return [...MOCK_REPORTS]; },
    async resolveReport(id, action){ await _sleep(); return { id, action, status:"처리됨" }; },
    async listAnnouncements() { await _sleep(); return [...MOCK_ANNOUNCEMENTS]; },
    async publishAnnouncement(a){ await _sleep(); return { ...a, id:_uid("ann"), publishedAt:Date.now() }; },
    async verifyTeacher(id, ok){ await _sleep(); return { id, status:ok?"승인됨":"반려됨" }; },
  },
};

/* ── 목업 시드 데이터 (백엔드 연결 시 삭제) ──
   store 초기값 및 api 목업 리턴에서 참조.
   좌표(x,y)는 %문자열, color/size/cat은 그래프 렌더용 시각 속성. */
const SEED_NODES = [
  { id:"n1", label:"물리학",   kind:"root",  x:"50%", y:"48%", color:"#3182f6", size:64, cat:"핵심 노드" },
  { id:"n2", label:"양자역학", kind:"topic", x:"30%", y:"28%", color:"#4593fc", size:48, cat:"연결 노드" },
  { id:"n3", label:"고전역학", kind:"topic", x:"70%", y:"26%", color:"#22c55e", size:48, cat:"연결 노드" },
  { id:"n4", label:"전자기학", kind:"topic", x:"15%", y:"60%", color:"#f59e0b", size:44, cat:"연결 노드" },
  { id:"n5", label:"열역학",   kind:"topic", x:"83%", y:"58%", color:"#8b95a1", size:44, cat:"연결 노드" },
  { id:"n6", label:"실험물리", kind:"leaf",  x:"38%", y:"76%", color:"#22c55e", size:38, cat:"말단 노드" },
  { id:"n7", label:"이론물리", kind:"leaf",  x:"63%", y:"76%", color:"#3182f6", size:38, cat:"말단 노드" },
  { id:"n8", label:"전기회로", kind:"leaf",  x:"17%", y:"82%", color:"#f04452", size:32, cat:"말단 노드" },
];
const SEED_EDGES = [
  { id:"e1", from:"n1", to:"n2" }, { id:"e2", from:"n1", to:"n3" },
  { id:"e3", from:"n1", to:"n4" }, { id:"e4", from:"n1", to:"n5" },
  { id:"e5", from:"n2", to:"n6" }, { id:"e6", from:"n3", to:"n7" },
  { id:"e7", from:"n4", to:"n8" },
];
const MOCK_COMMENTS = [
  { id:"C-5001", author:"김선생님", type:"노드", target:"양자컴퓨팅 노드", content:"이 노드에 관련 논문 링크를 추가해 보는 것은 어떨까요? arXiv의 최신 논문들을 참고하면 좋을 것 같습니다.", createdAt:Date.now()-600000,  replied:false, reports:0, status:"active" },
  { id:"C-5002", author:"박선생님", type:"텍스트", target:"세특 영역",       content:"실험 결과를 수치로 표현해 주세요. 구체적인 데이터가 있으면 더 설득력 있는 세특이 됩니다.", createdAt:Date.now()-7200000, replied:true,  reports:0, status:"active" },
  { id:"C-5003", author:"이선생님", type:"그래프", target:"전체 그래프",      content:"과학 분야 노드들이 잘 연결되어 있어요. 인문학 분야도 연결해 보면 융합 역량을 보여줄 수 있습니다.", createdAt:Date.now()-86400000, replied:true,  reports:0, status:"active" },
];
const MOCK_ADMIN_USERS = [
  { id:"U-2048", name:"홍길동", email:"hong@school.ac.kr",   role:"학생", joined:"2026-03-01", status:"활성",     lastLogin:"2시간 전" },
  { id:"U-2049", name:"김영희", email:"kim@school.ac.kr",    role:"학생", joined:"2026-03-01", status:"활성",     lastLogin:"어제" },
  { id:"U-1024", name:"김민준", email:"minjun@hs.ac.kr",     role:"교사", joined:"2026-02-15", status:"활성",     lastLogin:"오늘" },
  { id:"U-1025", name:"이수진", email:"sujin@school.ac.kr",  role:"교사", joined:"2026-01-20", status:"정지됨",   lastLogin:"1주일 전" },
  { id:"U-2050", name:"박지수", email:"jisoo@school.ac.kr",  role:"학생", joined:"2026-04-10", status:"활성",     lastLogin:"3일 전" },
  { id:"U-2051", name:"정하은", email:"haeun@school.ac.kr",  role:"학생", joined:"2026-03-20", status:"삭제됨",   lastLogin:"어제" },
];
const MOCK_REPORTS = [
  { id:"R-901", target:"C-4729", type:"코멘트", reason:"욕설/비방", reports:3, status:"검토 중" },
  { id:"R-902", target:"U-2048", type:"사용자", reason:"스팸",      reports:1, status:"검토 중" },
];
const MOCK_ANNOUNCEMENTS = [
  { id:"N-012", title:"2026년 2월 정기 점검 안내", target:"전체", status:"발행됨", publishedAt:Date.parse("2026-01-20") },
  { id:"N-011", title:"임베딩 모델 업데이트 완료",   target:"전체", status:"발행됨", publishedAt:Date.parse("2026-01-15") },
  { id:"N-013", title:"새 기능: 가지치기 추천 v2",    target:"전체", status:"예약됨", publishedAt:Date.parse("2026-01-25") },
  { id:"N-010", title:"서버 이전 완료",              target:"전체", status:"만료됨", publishedAt:Date.parse("2025-12-01") },
];
const MOCK_STUDENTS = [
  { id:"20301", name:"홍길동", grade:"3-2", nodes:2847, last:"오늘 14:23", cm:1, sync:"동기화됨", activity:"활발" },
  { id:"20302", name:"김영희", grade:"3-2", nodes:1203, last:"오늘 11:05", cm:3, sync:"동기화됨", activity:"보통" },
  { id:"20215", name:"이철수", grade:"3-1", nodes:3112, last:"어제",      cm:0, sync:"동기화됨", activity:"활발" },
  { id:"20216", name:"박지수", grade:"3-1", nodes:892,  last:"3일 전",    cm:0, sync:"미동기화", activity:"낮음" },
  { id:"20421", name:"최민준", grade:"3-3", nodes:1567, last:"오늘 09:30", cm:2, sync:"동기화됨", activity:"보통" },
];

/* ══════════════════════════════════════════════════════════════════════
   ██  GLOBAL STORE  ██  ── 앱 전역 상태 (Context + Reducer) ──
   ──────────────────────────────────────────────────────────────────────
   ▸ 세션, 그래프, 코멘트, 사용자, 신고, 공지 등 모든 화면이 공유하는 상태.
   ▸ 화면에서는 useStore()로 { state, actions } 접근.
   ▸ actions는 위 api를 호출하고 결과를 state에 반영 (낙관적/로딩 처리 포함).
   ══════════════════════════════════════════════════════════════════════ */
const initialState = {
  session: null,            // { token, user } | null  ← 로그인 여부의 기준
  authLoading: false,
  authError: null,
  graph: { nodes:[], edges:[], loading:false },
  comments: [],
  students: [],             // 교사 담당 학생 목록 (T03/T06 공유)
  selectedStudent: null,    // T06 → T07 로 넘길 선택 학생
  teacherVerification: null,// { status, school, subject, submittedAt } | null
  adminUsers: [],
  reports: [],
  teacherApplications: [],  // 관리자 교사 검증 큐 (A06)
  announcements: [],
  toast: null,              // { type, msg } | null
};

function reducer(state, a) {
  switch (a.type) {
    case "AUTH_START":   return { ...state, authLoading:true, authError:null };
    case "AUTH_OK":      return { ...state, authLoading:false, authError:null, session:a.session };
    case "AUTH_ERR":     return { ...state, authLoading:false, authError:a.error };
    case "SIGN_OUT":     return { ...initialState,
      // 세션만 초기화하고 공유 데이터는 유지 (역할 전환 데모가 로그아웃 후에도 이어지도록)
      comments:state.comments, reports:state.reports,
      teacherApplications:state.teacherApplications, students:state.students,
      adminUsers:state.adminUsers, announcements:state.announcements,
      graph:state.graph };
    case "GRAPH_LOADING":return { ...state, graph:{ ...state.graph, loading:true } };
    case "GRAPH_SET":    return { ...state, graph:{ nodes:a.nodes, edges:a.edges, loading:false } };
    case "GRAPH_ADD_NODE":return { ...state, graph:{ ...state.graph, nodes:[...state.graph.nodes, a.node] } };
    case "GRAPH_DEL_NODE":return { ...state, graph:{ ...state.graph, nodes:state.graph.nodes.filter(n=>n.id!==a.id), edges:state.graph.edges.filter(e=>e.from!==a.id&&e.to!==a.id) } };
    case "COMMENTS_SET": return { ...state, comments:a.items };
    case "COMMENT_ADD":  return { ...state, comments:[a.item, ...state.comments] };
    case "COMMENT_REPORT":return { ...state, comments:state.comments.map(c=>c.id===a.id?{ ...c, reports:(c.reports||0)+1, status:"검토 중" }:c) };
    case "COMMENT_DEL":  return { ...state, comments:state.comments.filter(c=>c.id!==a.id) };
    case "STUDENTS_SET": return { ...state, students:a.items };
    case "SELECT_STUDENT":return { ...state, selectedStudent:a.student };
    case "TVERIFY_SET":  return { ...state, teacherVerification:a.item };
    case "TAPP_SET":     return { ...state, teacherApplications:a.items };
    case "TAPP_ADD":     return { ...state, teacherApplications:[a.item, ...state.teacherApplications] };
    case "TAPP_UPD":     return { ...state, teacherApplications:state.teacherApplications.map(t=>t.id===a.id?{ ...t, ...a.patch }:t) };
    case "ADMIN_USERS_SET":return { ...state, adminUsers:a.items };
    case "ADMIN_USER_UPD":return { ...state, adminUsers:state.adminUsers.map(u=>u.id===a.id?{ ...u, ...a.patch }:u) };
    case "REPORTS_SET":  return { ...state, reports:a.items };
    case "REPORT_ADD":   return { ...state, reports:[a.item, ...state.reports] };
    case "REPORT_UPD":   return { ...state, reports:state.reports.map(r=>r.id===a.id?{ ...r, ...a.patch }:r) };
    case "ANN_SET":      return { ...state, announcements:a.items };
    case "ANN_ADD":      return { ...state, announcements:[a.item, ...state.announcements] };
    case "TOAST":        return { ...state, toast:a.toast };
    default: return state;
  }
}

const StoreCtx = createContext(null);
const useStore = () => {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used within <StoreProvider>");
  return ctx;
};

function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;   // 매 렌더마다 최신 state 참조 (actions 클로저용)
  const toast = useCallback((type, msg) => {
    dispatch({ type:"TOAST", toast:{ type, msg } });
    setTimeout(()=>dispatch({ type:"TOAST", toast:null }), 2600);
  }, []);

  const actions = useMemo(() => ({
    /* ── 인증 ── */
    async signInPassword(email, password) {
      dispatch({ type:"AUTH_START" });
      try { const s = await api.auth.signInWithPassword(email, password); dispatch({ type:"AUTH_OK", session:s }); return s; }
      catch (e) { dispatch({ type:"AUTH_ERR", error:e.message }); throw e; }
    },
    async signInGoogle() {
      dispatch({ type:"AUTH_START" });
      try { const s = await api.auth.signInWithGoogle(); dispatch({ type:"AUTH_OK", session:s }); return s; }
      catch (e) { dispatch({ type:"AUTH_ERR", error:e.message }); throw e; }
    },
    async signInAdmin(email, password, mfa) {
      dispatch({ type:"AUTH_START" });
      try { const s = await api.auth.signInAdmin(email, password, mfa); dispatch({ type:"AUTH_OK", session:s }); return s; }
      catch (e) { dispatch({ type:"AUTH_ERR", error:e.message }); throw e; }
    },
    async signOut() { await api.auth.signOut(); dispatch({ type:"SIGN_OUT" }); },

    /* ── 그래프 ── */
    async loadGraph(userId) {
      dispatch({ type:"GRAPH_LOADING" });
      const g = await api.graph.fetch(userId);
      dispatch({ type:"GRAPH_SET", nodes:g.nodes, edges:g.edges });
    },
    async addNode(node) { const n = await api.graph.addNode(node); dispatch({ type:"GRAPH_ADD_NODE", node:n }); toast("success","노드가 추가되었습니다."); return n; },
    async deleteNode(id){ await api.graph.removeNode(id); dispatch({ type:"GRAPH_DEL_NODE", id }); toast("success","노드가 삭제되었습니다."); },
    async generateGraph(keywords) {
      dispatch({ type:"GRAPH_LOADING" });
      const newNodes = await api.graph.generateFromSeeds(keywords);
      const cur = stateRef.current.graph.nodes;
      // 기존 그래프에 이어붙이기 (겹치지 않게 살짝 오프셋). 비어있으면 그대로 배치.
      const offset = cur.length ? newNodes.map((n,i)=>({ ...n, x:`${(15+(i*11)%70)}%`, y:`${(70+(i*7)%20)}%` })) : newNodes;
      dispatch({ type:"GRAPH_SET", nodes:[...cur, ...offset], edges:stateRef.current.graph.edges });
      toast("success",`${newNodes.length}개 노드가 그래프에 추가되었습니다.`);
    },

    /* ── 코멘트 / 신고 ── */
    async loadComments(targetId) { const items = await api.comments.list(targetId); dispatch({ type:"COMMENTS_SET", items }); },
    async postComment(c) { const item = await api.comments.create(c); dispatch({ type:"COMMENT_ADD", item }); toast("success","코멘트가 등록되었습니다."); return item; },
    async reportComment(id, reason) {
      await api.comments.report(id, reason);
      dispatch({ type:"COMMENT_REPORT", id });
      // 신고를 관리자 신고 큐에도 추가 (화면 간 데이터 흐름)
      const c = (stateRef.current.comments||[]).find(x=>x.id===id);
      dispatch({ type:"REPORT_ADD", item:{ id:_uid("R"), target:id, type:"코멘트", reason, reports:1, status:"검토 중", content:c?.content, author:c?.author } });
      toast("info","신고가 접수되었습니다. 관리자 큐로 전달됩니다.");
    },
    async removeComment(id) { await api.comments.remove(id); dispatch({ type:"COMMENT_DEL", id }); toast("success","코멘트가 삭제되었습니다."); },

    /* ── 교사 자격 검증 / 담당 학생 ── */
    async loadStudents(teacherId) { const items = await api.teacher.listStudents(teacherId); dispatch({ type:"STUDENTS_SET", items }); },
    selectStudent(student) { dispatch({ type:"SELECT_STUDENT", student }); },
    async submitTeacherVerification(payload) {
      const app = await api.teacher.submitVerification(payload);
      dispatch({ type:"TVERIFY_SET", item:{ status:app.status, school:app.school, subject:app.subject, submittedAt:app.submittedAt } });
      // 관리자 교사 검증 큐에도 추가 (화면 간 데이터 흐름)
      dispatch({ type:"TAPP_ADD", item:{ id:app.id, name:stateRef.current.session?.user?.name||"교사", school:app.school, subject:app.subject, teacherNo:app.teacherNo, status:"검토 중", submittedAt:app.submittedAt } });
      toast("success","자격 검증 신청이 제출되었습니다.");
      return app;
    },
    async approveTeacherApp(id, ok) {
      await api.admin.verifyTeacher(id, ok);
      dispatch({ type:"TAPP_UPD", id, patch:{ status: ok?"승인됨":"반려됨" } });
      // 신청자 본인의 상태도 갱신 (같은 store)
      if (stateRef.current.teacherVerification) dispatch({ type:"TVERIFY_SET", item:{ ...stateRef.current.teacherVerification, status: ok?"승인됨":"반려됨" } });
      toast("success", ok?"교사 자격을 승인했습니다.":"교사 자격을 반려했습니다.");
    },

    /* ── 관리자 ── */
    async loadAdminUsers(q) { const items = await api.admin.listUsers(q); dispatch({ type:"ADMIN_USERS_SET", items }); },
    async suspendUser(id, reason) { await api.admin.suspendUser(id, reason); dispatch({ type:"ADMIN_USER_UPD", id, patch:{ status:"정지됨" } }); toast("success","사용자를 정지했습니다."); },
    async restoreUser(id) { await api.admin.suspendUser(id, "해제"); dispatch({ type:"ADMIN_USER_UPD", id, patch:{ status:"활성" } }); toast("success","정지를 해제했습니다."); },
    async deleteUser(id) { await api.admin.deleteUser(id); dispatch({ type:"ADMIN_USER_UPD", id, patch:{ status:"삭제됨" } }); toast("success","사용자를 삭제했습니다."); },
    async loadReports() { const items = await api.admin.listReports(); dispatch({ type:"REPORTS_SET", items }); },
    async resolveReport(id, action) { await api.admin.resolveReport(id, action); dispatch({ type:"REPORT_UPD", id, patch:{ status:"처리됨" } }); toast("success","신고를 처리했습니다."); },
    async loadAnnouncements() { const items = await api.admin.listAnnouncements(); dispatch({ type:"ANN_SET", items }); },
    async publishAnnouncement(a) { const item = await api.admin.publishAnnouncement(a); dispatch({ type:"ANN_ADD", item }); toast("success","공지를 발행했습니다."); return item; },
    async verifyTeacher(id, ok) { await api.admin.verifyTeacher(id, ok); toast("success", ok?"교사 자격을 승인했습니다.":"교사 자격을 반려했습니다."); },

    toast,
  }), [toast]);

  return <StoreCtx.Provider value={{ state, actions }}>{children}</StoreCtx.Provider>;
}

/* 전역 토스트 렌더러 */
function Toast() {
  const { state } = useStore();
  if (!state.toast) return null;
  const c = { success:TDS.blue500, error:TDS.danger, info:TDS.textSecondary }[state.toast.type] || TDS.textSecondary;
  return (
    <div style={{position:"fixed",bottom:88,left:"50%",transform:"translateX(-50%)",zIndex:10000,
      background:"#111",color:"#fff",padding:"12px 20px",borderRadius:12,fontSize:14,fontWeight:600,
      boxShadow:"0 8px 30px rgba(0,0,0,.3)",borderLeft:`3px solid ${c}`,maxWidth:"90vw"}}>
      {state.toast.msg}
    </div>
  );
}



/* ──────────────────────────────────────────────────────────────
   TDS TOKEN MAP  (toss-design-system.md 기준)
────────────────────────────────────────────────────────────── */
const TDS = {
  /* Brand */
  blue50:  "#ebf3ff", blue100: "#c6dcff", blue200: "#9ec4ff",
  blue300: "#75abff", blue400: "#4d93ff", blue500: "#3182f6",
  blue600: "#1b69db", blue700: "#1252b5",

  /* Text */
  textPrimary:   "#191f28",
  textSecondary: "#4e5968",
  textTertiary:  "#8b95a1",
  textDisabled:  "#c2c9d2",
  textLink:      "#3182f6",
  textDanger:    "#f04452",
  textCaution:   "#ff6d0a",

  /* Background */
  bgPrimary:   "#ffffff",
  bgSecondary: "#f9fafb",
  bgTertiary:  "#f2f4f6",
  bgOverlay:   "rgba(25,31,40,0.52)",
  bgDisabled:  "#e5e8eb",

  /* Border */
  borderDefault: "#e5e8eb",
  borderStrong:  "#c2c9d2",
  borderFocus:   "#3182f6",

  /* Status / Chart */
  success:  "#00c176", successBg: "#e6faf2",
  warning:  "#ff8c42", warningBg: "#fff4eb",
  danger:   "#f04452", dangerBg:  "#fff0f0",
  info:     "#3182f6",

  chartLine:    "#3182f6",
  chartArea:    "rgba(49,130,246,0.12)",
  chartAndroid: "#00c176",
  chartiOS:     "#3182f6",
  chartMale:    "#3182f6",
  chartFemale:  "#ff8c42",

  /* Dark-mode backgrounds (used for admin) */
  dark:      "#191f28",
  darkCard:  "#242b35",
  darkBrd:   "#2f3847",
};

/* ──────────────────────────────────────────────────────────────
   GLOBAL CSS  (TDS 스펙 완전 반영)
────────────────────────────────────────────────────────────── */
const CSS = `
@font-face {
  font-family: 'TossFace';
  src: url('data:font/truetype;base64,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AAEAAAEBCST23Aeo9twAAgAA/oQJJAeoAAAAAQAAAQEJJPbcB6j23AACAAD+hAkkB6gAAAABAAABAQkk9twHqPbcAAIAAP6ECSQHqAAAAAEAAAEBCST23Aeo9twAAgAA/oQJJAeoAAAAAQAAAQEJJPbcB6j23AACAAD+hAkkB6gAAAABAAABAQkk9twHqPbcAAIAAP6ECSQHqAAAAAEAAAEBCST23Aeo9twAAgAA/oQJJAeoAAAAAQAAAQEJJPbcB6j23AACAAD+hAkkB6gAAAABAAABAQkk9twHqPbcAAIAAP6ECSQHqAAAAAEAAAEBCST23Aeo9twAAgAA/oQJJAeoAAAAAQAAAQEJJPbcB6j23AACAAD+hAkkB6gAAAABAAABAQkk9twHqPbcAAIAAP6ECSQHqAAAAAEAAAEBCST23Aeo9twAAgAA/oQJJAeoAAAAAQAAAQEJJPbcB6j23AACAAD+hAkkB6gAAAABAAABAQkk9twHqPbcAAIAAP6ECSQHqAAAAAEAAAEBCST23Aeo9twAAgAA/oQJJAeoAAAAAQAAAQEJJPbcB6j23AACAAD+hAkkB6gAAAABAAABAQkk9twHqPbcAAIAAP6ECSQHqAAAAAEAAAEBCST23Aeo9twAAgAA/oQJJAeoAAAAAQAAAQEJJPbcB6j23AACAAD+hAkkB6gAAAABAAABAQkk9twHqPbcAAIAAP6ECSQHqAAAAAEAAAEBCST23Aeo9twAAgAA/oQJJAeoAAAAAQAAAQEJJPbcB6j23AACAAD+hAkkB6gAAAABAAABAQkk9twHqPbcAAIAAP6ECSQHqAAAAAEAAAEBCST23Aeo9twAAgAA/oQJJAeoAAAAAQAAAQEJJPbcB6j23AACAAD+hAkkB6gAAAABAAABAQkk9twHqPbcAAIAAP6ECSQHqAAAAAEAAAEBCST23Aeo9twAAgAA/oQJJAeoAAAAAQAAAQEJJPbcB6j23AACAAD+hAkkB6gAAAABAAABAQkk9twHqPbcAAIAAP6ECSQHqAAAAAEAAAEBCST23Aeo9twAAgAA/oQJJAeoAAAAAQAAAQEJJPbcB6j23AACAAD+hAkkB6gAAAABAAABAQkk9twHqPbcAAIAAP6ECSQHqAAAAAEAAAEBCST23Aeo9twAAgAA/oQJJAeoAAAAAQAAAQEJJPbcB6j23AACAAD+hAkkB6gAAAABAAABAQkk9twHqPbcAAIAAP6ECSQHqAAAAAEAAAEBCST23Aeo9twAAgAA/oQJJAeoAAAAAQAAAQEJJPbcB6j23AACAAD+hAkkB6gAAAABAAABAQkk9twHqPbcAAIAAP6ECSQHqAAAAAEAAAEBCST23Aeo9twAAgAA/oQJJAeoAAAAAQAAAQEJJPbcB6j23AACAAD+hAkkB6gAAAABAAABAQkk9twHqPbcAAIAAP6ECSQHqAAAAAEAAAEBCST23Aeo9twAAgAA/oQJJAeoAAAAAQAAAQEJJPbcB6j23AACAAD+hAkkB6gAAAABAAABAQkk9twHqPbcAAIAAP6ECSQHqAAAAAEAAAEBCST23Aeo9twAAgAA/oQJJAeoAAAAAQAAAQEJJPbcB6j23AACAAD+hAkkB6gAAAABAAABAQkk9twHqPbcAAIAAP6ECSQHqAAAAAEAAAEBCST23Aeo9twAAgAA/oQJJAeoAAAAAQAAAQEJJPbcB6j23AACAAD+hAkkB6gAAAABAAABAQkk9twHqPbcAAIAAP6ECSQHqAAAAAEAAAEBCST23Aeo9twAAgAA/oQJJAeoAAAAAQAAAQEJJPbcB6j23AACAAD+hAkkB6gAAAABAAABAQkk9twHqPbcAAIAAP6ECSQHqAAAAAEAAAEBCST23Aeo9twAAgAA/oQJJAeoAAAAAQAAAQEJJPbcB6j23AACAAD+hAkkB6gAAAABAAABAQkk9twHqPbcAAIAAP6ECSQHqAAAAAEAAAEBCST23Aeo9twAAgAA/oQJJAeoAAAAAQAAAQEJJPbcB6j23AACAAD+hAkkB6gAAAABAAABAQkk9twHqPbcAAIAAP6ECSQHqAAAAAEAAAEBCST23Aeo9twAAgAA/oQJJAeoAAAAAQAAAQEJJPbcB6j23AACAAD+hAkkB6gAAAABAAABAQkk9twHqPbcAAIAAP6ECSQHqAAAAAEAAAEBCST23Aeo9twAAgAA/oQJJAeoAAAAAQAAAQEJJPbcB6j23AACAAD+hAkkB6gAAAABAAABAQkk9twHqPbcAAIAAP6ECSQHqAAAAAEAAAEBCST23Aeo9twAAgAA/oQJJAeoAAAAAQAAAQEJJPbcB6j23AACAAD+hAkkB6gAAAABAAABAQkk9twHqPbcAAIAAP6ECSQHqAAAAAEAAAEB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') format('truetype');
  font-weight: normal;
  font-style: normal;
}

.tfi {
  font-family: 'TossFace', 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
  font-style: normal;
  line-height: 1;
  display: inline-block;
  vertical-align: middle;
}

@import url('https://fonts.googleapis.com/css2?family=Pretendard:wght@400;500;600;700;800&display=swap');

*, *::before, *::after { box-sizing: border-box; margin:0; padding:0; }

:root {
  /* Brand */
  --blue-50:#ebf3ff; --blue-100:#c6dcff; --blue-200:#9ec4ff;
  --blue-300:#75abff; --blue-400:#4d93ff; --blue-500:#3182f6;
  --blue-600:#1b69db; --blue-700:#1252b5;
  /* Text */
  --tp:#191f28; --ts:#4e5968; --tt:#8b95a1; --td:#c2c9d2;
  --tl:#3182f6; --terror:#f04452; --tcaution:#ff6d0a;
  /* BG */
  --bg1:#ffffff; --bg2:#f9fafb; --bg3:#f2f4f6; --bgd:#e5e8eb;
  /* Border */
  --brd:#e5e8eb; --brds:#c2c9d2; --brdf:#3182f6;
  /* Status */
  --success:#00c176; --successbg:#e6faf2;
  --warning:#ff8c42; --warningbg:#fff4eb;
  --danger:#f04452;  --dangerbg:#fff0f0;
  /* Radius */
  --r4:4px; --r6:6px; --r8:8px; --r12:12px; --r16:16px; --r24:24px; --rfull:9999px;
  /* Shadow */
  --shadow-sm:0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04);
  --shadow-md:0 4px 12px rgba(0,0,0,.08),0 2px 4px rgba(0,0,0,.04);
  --shadow-lg:0 8px 24px rgba(0,0,0,.10),0 4px 8px rgba(0,0,0,.06);
  /* Spacing */
  --s4:4px;--s6:6px;--s8:8px;--s10:10px;--s12:12px;--s16:16px;
  --s20:20px;--s24:24px;--s28:28px;--s32:32px;--s40:40px;
}

body {
  font-family: 'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif;
  background: var(--bg2);
  color: var(--tp);
  font-size: 15px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

button { cursor:pointer; border:none; background:none; font-family:inherit; }
input, textarea, select { font-family:inherit; outline:none; }
a { text-decoration:none; color:inherit; }

/* ── Scrollbar ── */
::-webkit-scrollbar { width:5px; height:5px; }
::-webkit-scrollbar-thumb { background:var(--brd); border-radius:3px; }

/* ── Layout ── */
.app { display:flex; height:100vh; overflow:hidden; }
.sidebar { width:260px; min-width:260px; height:100vh; display:flex; flex-direction:column; overflow-y:auto; flex-shrink:0; }
.main { flex:1; display:flex; flex-direction:column; overflow:hidden; min-width:0; }

/* ── Sidebar Light ── */
.sb-light { background:var(--bg1); border-right:1px solid var(--brd); }
.sb-dark  { background:#191f28; border-right:1px solid #2f3847; }

/* ── Sidebar internals ── */
.sb-logo  { height:60px; min-height:60px; box-sizing:border-box; padding:0 20px; display:flex; align-items:center; gap:12px; border-bottom:1px solid var(--brd); }
.sb-dark .sb-logo { border-bottom-color:#2f3847; }
.sb-logo-icon { width:36px; height:36px; border-radius:10px; background:var(--blue-500); display:flex; align-items:center; justify-content:center; color:#fff; font-size:18px; flex-shrink:0; }
.sb-logo-text { font-size:16px; font-weight:700; color:var(--tp); }
.sb-dark .sb-logo-text { color:#fff; }
.sb-section { flex:1; padding:8px 8px 0; }
.sb-item { display:flex; align-items:center; gap:10px; padding:11px 14px; border-radius:var(--r12); cursor:pointer; transition:background .12s; margin-bottom:2px; font-size:15px; font-weight:500; color:var(--ts); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sb-item:hover { background:var(--bg3); }
.sb-item.active { background:var(--blue-50); color:var(--blue-500); font-weight:600; }
.sb-dark .sb-item { color:#8b95a1; }
.sb-dark .sb-item:hover { background:#242b35; color:#fff; }
.sb-dark .sb-item.active { background:#242b35; color:#fff; }
.sb-icon { width:18px; height:18px; text-align:center; color:var(--td); flex-shrink:0; }
.sb-item.active .sb-icon { color:var(--blue-500); }
.sb-dark .sb-item.active .sb-icon { color:var(--blue-400); }
.sb-profile { padding:14px 16px; border-top:1px solid var(--brd); display:flex; align-items:center; gap:10px; }
.sb-dark .sb-profile { border-top-color:#2f3847; }
.sb-pname { font-size:13px; font-weight:600; color:var(--tp); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sb-chip { flex-shrink:0; padding:2px 8px; border-radius:9999px; font-size:10px; font-weight:700; line-height:1.4; white-space:nowrap; background:var(--blue-50); color:var(--blue-500); }
.sb-dark .sb-chip { background:rgba(77,147,255,.18); color:var(--blue-300); }
.sb-logout:hover { background:var(--bg3)!important; }
.sb-dark .sb-logout:hover { background:#242b35!important; }
.sb-dark .sb-pname { color:#f2f2f7; }
.sb-pemail { font-size:11px; color:var(--tt); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sb-dark .sb-pemail { color:#6b7280; }

/* ── Header ── */
.hdr { height:60px; min-height:60px; background:var(--bg1); border-bottom:1px solid var(--brd); display:flex; align-items:center; justify-content:space-between; padding:0 24px; }
.hdr-title { font-size:20px; font-weight:700; color:var(--tp); letter-spacing:-.3px; }
.hdr-sub { font-size:13px; color:var(--tt); margin-left:10px; }
.hdr-actions { display:flex; align-items:center; gap:8px; }
.icon-btn { width:40px; height:40px; border-radius:50%; background:var(--bg3); display:flex; align-items:center; justify-content:center; font-size:17px; cursor:pointer; position:relative; transition:background .12s; }
.icon-btn:hover { background:var(--bgd); }
.notif-dot { position:absolute; top:7px; right:7px; width:9px; height:9px; background:var(--danger); border-radius:50%; border:2px solid var(--bg1); }

/* ── Card ── */
.card { background:var(--bg1); border-radius:var(--r16); border:1px solid var(--brd); box-shadow:var(--shadow-sm); }
.card-p { padding:24px; }
.card-hdr { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
.card-title { font-size:17px; font-weight:700; color:var(--tp); }
.card-meta { font-size:13px; color:var(--tt); }

/* ── Button (TDS 스펙) ── */
.btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; font-family:inherit; font-weight:600; cursor:pointer; border:none; transition:all .14s; border-radius:var(--r12); }
/* Sizes */
.btn-sm  { height:36px; padding:0 14px; font-size:14px; border-radius:var(--r8);  }
.btn-md  { height:48px; padding:0 18px; font-size:16px; border-radius:var(--r12); }
.btn-lg  { height:54px; padding:0 22px; font-size:17px; border-radius:var(--r16); }
.btn-xl  { height:60px; padding:0 24px; font-size:18px; border-radius:var(--r16); width:100%; }
/* Variants */
.btn-primary   { background:var(--blue-500); color:#fff; }
.btn-primary:hover { background:var(--blue-600); }
.btn-primary:active { opacity:.85; transform:scale(.98); }
.btn-secondary { background:var(--bg3); color:var(--tp); }
.btn-secondary:hover { background:var(--bgd); }
.btn-ghost  { background:transparent; color:var(--blue-500); }
.btn-ghost:hover { background:var(--blue-50); }
.btn-danger { background:var(--danger); color:#fff; }
.btn-danger:hover { background:#d63344; }
.btn-disabled, .btn:disabled { background:var(--bgd); color:var(--td); cursor:not-allowed; }
/* Inline small */
.btn-inline { height:36px; padding:0 14px; border-radius:var(--r8); font-size:13px; font-weight:500; background:var(--bg3); color:var(--ts); border:none; cursor:pointer; transition:background .12s; }
.btn-inline:hover { background:var(--bgd); }

/* ── Badge (TDS) ── */
.badge { display:inline-flex; align-items:center; padding:2px 8px; border-radius:var(--r4); font-size:12px; font-weight:600; line-height:18px; white-space:nowrap; }
.badge-blue    { background:var(--blue-50);    color:var(--blue-500);  }
.badge-grey    { background:var(--bg3);        color:var(--ts);        }
.badge-red     { background:var(--dangerbg);   color:var(--danger);    }
.badge-green   { background:var(--successbg);  color:var(--success);   }
.badge-orange  { background:var(--warningbg);  color:var(--warning);   }
.badge-pill    { border-radius:var(--rfull); padding:3px 10px; }
.badge-num { width:20px; height:20px; border-radius:50%; background:var(--danger); color:#fff; font-size:11px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; }

/* ── Tab — Underline ── */
.tab-bar { display:flex; border-bottom:1.5px solid var(--brd); gap:0; }
.tab-item { padding:10px 16px; font-size:15px; font-weight:500; color:var(--tt); cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1.5px; transition:all .14s; }
.tab-item:hover { color:var(--ts); }
.tab-item.active { color:var(--tp); font-weight:700; border-bottom-color:var(--tp); }
/* Tab — Pill */
.tab-pill-wrap { display:flex; background:var(--bg3); border-radius:var(--r8); padding:3px; gap:2px; flex-wrap:wrap; }
.tab-pill { padding:5px 16px; border-radius:6px; font-size:13px; font-weight:500; color:var(--tt); cursor:pointer; transition:all .14s; white-space:nowrap; }
.tab-pill.active { background:var(--bg1); color:var(--tp); font-weight:600; box-shadow:var(--shadow-sm); }

/* ── ListRow (TDS) ── */
.list-row { display:flex; align-items:center; padding:14px 0; min-height:56px; border-bottom:1px solid var(--brd); gap:12px; }
.list-row:last-child { border-bottom:none; }
.list-row-left { flex:1; min-width:0; }
.list-row-title { font-size:15px; font-weight:500; color:var(--tp); line-height:22.5px; }
.list-row-sub { font-size:13px; color:var(--tt); margin-top:2px; }
.list-row-right { display:flex; align-items:center; gap:8px; flex-shrink:0; }

/* ── Avatar ── */
.av { border-radius:50%; background:var(--blue-50); display:flex; align-items:center; justify-content:center; font-weight:700; color:var(--blue-500); flex-shrink:0; }
.av-xs { width:24px; height:24px; font-size:10px; }
.av-sm { width:32px; height:32px; font-size:13px; }
.av-md { width:40px; height:40px; font-size:16px; }
.av-lg { width:52px; height:52px; font-size:20px; }
.av-xl { width:64px; height:64px; font-size:24px; }

/* ── Input ── */
.inp { width:100%; height:48px; padding:0 16px; border-radius:var(--r12); border:1px solid var(--brd); font-size:15px; color:var(--tp); background:var(--bg1); transition:border-color .14s, box-shadow .14s; }
.inp:focus { border-color:var(--blue-500); box-shadow:0 0 0 3px rgba(49,130,246,.15); }
.inp::placeholder { color:var(--tt); }
.inp-label { font-size:13px; font-weight:600; color:var(--ts); margin-bottom:6px; display:block; }
.inp-group { margin-bottom:18px; }
.textarea { width:100%; padding:14px 16px; border-radius:var(--r12); border:1px solid var(--brd); font-size:15px; color:var(--tp); background:var(--bg1); resize:vertical; min-height:110px; line-height:1.65; transition:border-color .14s; }
.textarea:focus { border-color:var(--blue-500); box-shadow:0 0 0 3px rgba(49,130,246,.15); outline:none; }
.search-wrap { display:flex; align-items:center; gap:8px; background:var(--bg3); border-radius:var(--r12); padding:0 14px; height:44px; }
.search-wrap input { background:none; border:none; font-size:15px; color:var(--tp); flex:1; }
.search-wrap input::placeholder { color:var(--tt); }

/* ── Notice ── */
.notice { padding:12px 16px; border-radius:var(--r12); font-size:14px; display:flex; gap:10px; margin-bottom:16px; line-height:1.55; }
.notice-info    { background:var(--blue-50);    color:var(--blue-700);  border:1px solid var(--blue-100); }
.notice-warning { background:var(--warningbg);  color:#a84900; border:1px solid #ffd0a0; }
.notice-danger  { background:var(--dangerbg);   color:#b5001f; border:1px solid #ffd0d5; }
.notice-success { background:var(--successbg);  color:#00714a; border:1px solid #a0e8cc; }

/* ── Toggle ── */
.toggle { width:46px; height:26px; border-radius:13px; background:var(--bgd); position:relative; cursor:pointer; transition:background .2s; border:none; }
.toggle.on { background:var(--blue-500); }
.toggle::after { content:''; position:absolute; top:3px; left:3px; width:20px; height:20px; border-radius:50%; background:#fff; transition:left .18s; box-shadow:0 1px 3px rgba(0,0,0,.18); }
.toggle.on::after { left:23px; }

/* ── Progress bar ── */
.prog-wrap { height:6px; background:var(--bg3); border-radius:3px; overflow:hidden; }
.prog-fill  { height:100%; border-radius:3px; transition:width .3s; }

/* ── Table ── */
.tbl-wrap { overflow-x:auto; border-radius:var(--r12); border:1px solid var(--brd); }
table { width:100%; border-collapse:collapse; }
thead { background:var(--bg3); }
th { padding:11px 16px; font-size:12px; font-weight:600; color:var(--tt); text-align:left; border-bottom:1px solid var(--brd); white-space:nowrap; }
td { padding:14px 16px; font-size:14px; color:var(--tp); border-bottom:1px solid var(--bg3); }
tr:last-child td { border-bottom:none; }
tr:hover td { background:#fafafa; }

/* ── BottomCTA ── */
.bottom-cta { padding:12px 20px 34px; background:var(--bg1); border-top:1px solid var(--brd); }
.bottom-cta-double { display:flex; gap:8px; }

/* ── Skeleton ── */
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
.skeleton { background:var(--bg3); border-radius:var(--r6); animation:pulse 1.5s ease-in-out infinite; }

/* ── Log ── */
.log-item { padding:11px 16px; border-bottom:1px solid var(--bg3); display:flex; align-items:flex-start; gap:10px; font-size:13px; }
.log-lv { padding:2px 7px; border-radius:var(--r4); font-size:10px; font-weight:700; flex-shrink:0; }
.log-info  { background:var(--blue-50);   color:var(--blue-600); }
.log-warn  { background:var(--warningbg); color:var(--warning);  }
.log-error { background:var(--dangerbg);  color:var(--danger);   }

/* ── Chip ── */
.chip { display:inline-flex; align-items:center; gap:6px; padding:5px 12px; border-radius:var(--rfull); font-size:13px; font-weight:500; cursor:pointer; border:1.5px solid var(--brd); color:var(--ts); background:var(--bg1); transition:all .14s; white-space:nowrap; }
.chip.active { background:var(--blue-50); border-color:var(--blue-500); color:var(--blue-500); font-weight:600; }
.chip:hover:not(.active) { border-color:var(--brds); }
.chip-x { font-size:10px; cursor:pointer; }
.chip-group { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }

/* ── DateRangePicker ── */
.date-range { display:flex; align-items:center; gap:8px; height:36px; padding:0 14px; background:var(--bg1); border:1px solid var(--brd); border-radius:var(--r8); font-size:13px; color:var(--ts); cursor:pointer; transition:border-color .14s; }
.date-range:hover { border-color:var(--blue-500); }

/* ── Activity timeline ── */
.act-item { display:flex; gap:14px; padding:13px 0; border-bottom:1px solid var(--bg3); }
.act-item:last-child { border-bottom:none; }
.act-dot { width:8px; height:8px; border-radius:50%; background:var(--blue-500); flex-shrink:0; margin-top:7px; }
.act-title { font-size:14px; font-weight:500; color:var(--tp); }
.act-desc  { font-size:13px; color:var(--tt); margin-top:2px; }
.act-time  { font-size:12px; color:var(--td); flex-shrink:0; }

/* ── Stat card ── */
.stat-card { background:var(--bg1); border-radius:var(--r16); border:1px solid var(--brd); padding:22px 24px; box-shadow:var(--shadow-sm); }
.stat-lbl { font-size:13px; color:var(--tt); font-weight:500; margin-bottom:6px; }
.stat-val { font-size:26px; font-weight:700; line-height:1.15; margin-bottom:6px; }
.stat-sub { font-size:12px; color:var(--td); }

/* ── ListHeader ── */
.list-hdr { padding:20px 0 8px; }
.list-hdr-label { font-size:12px; font-weight:500; color:var(--tt); letter-spacing:.3px; text-transform:uppercase; }
.list-hdr-title { font-size:20px; font-weight:700; color:var(--tp); margin-top:4px; line-height:29px; }

/* ── Modal ── */
.modal-overlay { position:fixed; inset:0; background:rgba(25,31,40,.52); z-index:1000; display:flex; align-items:center; justify-content:center; }
.modal { background:var(--bg1); border-radius:var(--r24); padding:28px; max-width:480px; width:90%; box-shadow:var(--shadow-lg); }
.modal-title { font-size:20px; font-weight:700; color:var(--tp); margin-bottom:10px; }
.modal-desc  { font-size:15px; color:var(--ts); margin-bottom:24px; line-height:1.65; }
.modal-btns  { display:flex; gap:8px; }
.modal-btns .btn { flex:1; }

/* ── Login ── */
.login-wrap { display:flex; height:100vh; min-height:600px; }
.login-left {
  flex:1;
  background: linear-gradient(160deg, #1252b5 0%, #1b69db 35%, #3182f6 70%, #4d93ff 100%);
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  padding:clamp(32px,5vw,72px); color:#fff; min-width:0; overflow:hidden;
}
.login-left-content { max-width:440px; width:100%; }
.login-right { width:clamp(340px,38vw,520px); display:flex; flex-direction:column; align-items:center; justify-content:center; padding:clamp(28px,4vw,64px); background:var(--bg1); overflow-y:auto; }
.login-box { width:100%; max-width:380px; }

/* ── Area card ── */
.area-card { padding:20px; border-radius:var(--r16); border:1px solid var(--brd); background:var(--bg1); cursor:pointer; transition:all .14s; }
.area-card:hover { border-color:var(--blue-500); box-shadow:0 4px 16px rgba(49,130,246,.12); }
.area-card-title { font-size:17px; font-weight:700; color:var(--tp); margin-bottom:4px; }
.area-card-desc  { font-size:13px; color:var(--tt); margin-bottom:14px; line-height:1.55; }

/* ── Session card ── */
.sess-card { padding:16px 20px; border-radius:var(--r12); border:1px solid var(--brd); background:var(--bg1); display:flex; align-items:center; gap:16px; margin-bottom:10px; transition:all .14s; }
.sess-card:hover { border-color:var(--blue-100); box-shadow:var(--shadow-sm); }
.sess-icon { width:44px; height:44px; border-radius:var(--r12); display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; }

/* ── Flex helpers ── */
.row { display:flex; align-items:center; }
.row-between { display:flex; align-items:center; justify-content:space-between; }
.col { display:flex; flex-direction:column; }
.g4{gap:4px;} .g6{gap:6px;} .g8{gap:8px;} .g10{gap:10px;} .g12{gap:12px;} .g16{gap:16px;} .g20{gap:20px;} .g24{gap:24px;}
.mb4{margin-bottom:4px;} .mb8{margin-bottom:8px;} .mb6{margin-bottom:6px;}
.mb12{margin-bottom:12px;}
.mt12{margin-top:12px;} .mb16{margin-bottom:16px;} .mb20{margin-bottom:20px;} .mb24{margin-bottom:24px;}
.mt8{margin-top:8px;} .mt16{margin-top:16px;} .mt24{margin-top:24px;}
.flex1{flex:1;} .fw{width:100%;} .tac{text-align:center;}

/* ── Grid — Responsive ── */
.grid2{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;}
@media(max-width:1200px){ .grid4{grid-template-columns:repeat(2,1fr);} }
@media(max-width:900px){  .grid4{grid-template-columns:1fr;} .grid3{grid-template-columns:1fr;} .grid2{grid-template-columns:1fr;} }

/* ── Content auto-layout ──
   모든 화면은 .content(스크롤·패딩 프레임) 안에서 아래 폭 컨벤션 중 하나를 사용:
   .content-inner  → 대시보드·표 등 넓은 레이아웃(최대 1600)
   .content-wide   → 통계·검색 등(최대 960)
   .content-narrow → 코멘트·설정·폼 등 읽기 중심(최대 720) */
.content { flex:1; overflow-y:auto; padding:clamp(16px,2.5vw,32px); background:var(--bg2); min-width:0; }
.content-inner  { max-width:1600px; margin:0 auto; width:100%; }
.content-wide   { max-width:960px;  margin:0 auto; width:100%; }
.content-narrow { max-width:720px;  margin:0 auto; width:100%; }

/* ── Section titles ── */
.sec-title { font-size:22px; font-weight:700; color:var(--tp); letter-spacing:-.3px; margin-bottom:4px; }
.sec-sub   { font-size:14px; color:var(--tt); margin-bottom:24px; }

/* ── Chart area ── */
.chart-bg { position:relative; background:var(--bg3); border-radius:var(--r12); overflow:hidden; }
.chart-svg { width:100%; }

/* ── Empty state ── */
.empty { text-align:center; padding:60px 40px; }
.empty-icon  { font-size:48px; margin-bottom:16px; }
.empty-title { font-size:18px; font-weight:700; margin-bottom:8px; }
.empty-sub   { font-size:14px; color:var(--tt); margin-bottom:24px; }

/* ── Toolbar ── */
.toolbar { background:var(--bg1); border-bottom:1px solid var(--brd); padding:10px 24px; display:flex; align-items:center; gap:10px; }
.spinner { width:32px; height:32px; border-radius:50%; border:3px solid var(--brd); border-top-color:var(--blue-500); animation:spin .7s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }

/* ── Tier badge ── */
.tier2 { background:var(--warningbg); color:#a84900; border:1px solid #ffd0a0; padding:2px 8px; border-radius:var(--r4); font-size:10px; font-weight:700; }

/* ── Responsive App Layout ── */
/* Graduated sidebar scaling: 글자가 세로로 깨지지 않도록 breakpoint별로 폭·폰트·아이콘·chip 축소 */
@media (max-width: 1280px) {
  .sidebar { width:236px; min-width:236px; }
  .sb-item { font-size:14px; padding:10px 13px; gap:9px; }
  .sb-icon { width:17px; height:17px; }
}
@media (max-width: 1024px) {
  .sidebar { width:210px; min-width:210px; }
  .sb-logo { padding:0 16px; gap:10px; }
  .sb-logo-icon { width:32px; height:32px; }
  .sb-logo-text { font-size:15px; }
  .sb-item { font-size:13.5px; padding:9px 12px; gap:8px; }
  .sb-icon { width:16px; height:16px; }
  .sb-chip { font-size:9px; padding:2px 7px; }
  .sb-pname { font-size:12.5px; }
  .sb-pemail { font-size:10.5px; }
}
@media (max-width: 880px) {
  .sidebar { width:188px; min-width:188px; }
  .sb-item { font-size:13px; padding:8px 11px; gap:8px; }
  .sb-section { padding:8px 6px 0; }
}
@media (max-width: 768px) {
  .app { flex-direction:column; }
  .sidebar { width:100%; min-width:0; height:auto; min-height:auto; flex-direction:row; align-items:center; overflow-x:auto; overflow-y:hidden; }
  .sb-logo { display:none; }
  .sb-section { display:flex; flex-direction:row; flex:1; padding:8px; gap:4px; overflow-x:auto; overflow-y:hidden; }
  .sb-item { flex:0 0 auto; min-width:auto; margin-bottom:0; padding:8px 12px; font-size:13px; white-space:nowrap; }
  .sb-profile { flex:0 0 auto; border-top:none; border-left:1px solid var(--brd); padding:10px 14px; }
  .sb-dark .sb-profile { border-left-color:#2f3847; }
  .login-wrap { flex-direction:column; height:auto; min-height:100vh; }
  .login-left { min-height:280px; padding:40px 24px; }
  .login-right { width:100%; padding:32px 24px; }
}
@media (max-width: 480px) {
  .sb-item { padding:7px 10px; font-size:12.5px; gap:6px; }
  .sb-icon { width:15px; height:15px; }
  .sb-profile { padding:8px 12px; gap:8px; }
  .sb-pemail { display:none; }
  .sb-chip { font-size:9px; padding:1px 6px; }
}

/* ── DAU Chart container ── */
.chart-responsive-wrap { position:relative; width:100%; }

/* ── Settings page layout ── */
.settings-grid { display:grid; grid-template-columns:240px 1fr; gap:24px; }
@media(max-width:900px){ .settings-grid{grid-template-columns:1fr;} }

/* ── Auto-layout helpers ── */
.auto-col { display:flex; flex-direction:column; gap:16px; }
.auto-row { display:flex; flex-direction:row; gap:12px; flex-wrap:wrap; align-items:center; }
.fill { flex:1; min-width:0; }
.shrink-0 { flex-shrink:0; }

/* ── Stat card value clamp ── */
.stat-val { font-size:clamp(18px,2vw,26px); font-weight:700; line-height:1.15; margin-bottom:6px; }
`;



/* ── TossFace 아이콘 시스템 ──
   TossFace 폰트가 1,378개 이모지를 모두 지원합니다.
   모든 이모지는 TossFace 폰트로 렌더링됩니다. */

// TFI: TossFace 폰트로 이모지 렌더링 (color prop 지원)
const TFI = ({ children, s = 20, color, style }) => {
  const size = typeof s === 'number' ? s : parseInt(s) || 20;
  const colorStyle = color ? { color } : {};
  return (
    <span
      className="tfi"
      style={{
        fontSize: size,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        verticalAlign: "middle",
        ...colorStyle,
        ...style,
      }}
    >
      {children}
    </span>
  );
};
/* ──────────────────────────────────────────────────────────────
   PRIMITIVE COMPONENTS
────────────────────────────────────────────────────────────── */
const Btn = ({ v = "primary", s = "md", fw, onClick, children, style, ...r }) => (
  <button className={`btn btn-${v} btn-${s}${fw?" btn-xl":""}`} onClick={onClick} style={style} {...r}>{children}</button>
);
const Badge = ({ t = "grey", pill, children }) => (
  <span className={`badge badge-${t}${pill?" badge-pill":""}`}>{children}</span>
);
const Av = ({ name = "?", size = "sm" }) => (
  <div className={`av av-${size}`}>{name[0]}</div>
);
const Card = ({ children, style, className = "" }) => (
  <div className={`card card-p ${className}`} style={style}>{children}</div>
);
const StatCard = ({ label, value, sub, color }) => (
  <div className="stat-card">
    <div className="stat-lbl">{label}</div>
    <div className="stat-val" style={{ color }}>{value}</div>
    <div className="stat-sub">{sub}</div>
  </div>
);
const Notice = ({ type = "info", children }) => (
  <div className={`notice notice-${type}`}>{children}</div>
);
const Divider = ({ my = 16 }) => (
  <div style={{ height: 1, background: TDS.borderDefault, margin: `${my}px 0` }} />
);

/* ──────────────────────────────────────────────────────────────
   NAV STROKE ICONS  (푸른끼 있는 gray stroke)
────────────────────────────────────────────────────────────── */
const NAV_ICON_PATHS = {
  home:      <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9.5 20v-6h5v6"/></>,
  graph:     <><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="7" r="2.5"/><circle cx="7" cy="18" r="2.5"/><circle cx="17" cy="17" r="2.5"/><path d="M8 7l8 0.6M7.5 8.4l-0.3 7M8.8 16.9l6.5-7.8M9.3 17.6l5.9-0.4"/></>,
  text:      <><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M9.5 12h5M9.5 15.5h5"/></>,
  voice:     <><rect x="9.5" y="3" width="5" height="11" rx="2.5"/><path d="M6 11a6 6 0 0 0 12 0"/><path d="M12 17v3M9 20h6"/></>,
  form:      <><rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  comment:   <><path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12.5h5"/></>,
  bell:      <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 20a2 2 0 0 0 4 0"/></>,
  stats:     <><path d="M4 20V4M20 20H4"/><path d="M8 17v-4M12 17V9M16 17v-6"/></>,
  settings:  <><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3"/></>,
  users:     <><circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.5a3 3 0 0 1 0 5.8M16.5 13.5a5.5 5.5 0 0 1 4 6.5"/></>,
  report:    <><path d="M9 4h9v16H6V7z"/><path d="M9 4v3H6"/><path d="M9 11h6M9 14.5h6"/><circle cx="8" cy="4" r="0"/></>,
  check:     <><circle cx="12" cy="12" r="9"/><path d="M8 12l2.5 2.5L16 9"/></>,
  system:    <><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/><path d="M7 10l2 2-2 2M12 14h4"/></>,
  metric:    <><path d="M4 20V4M20 20H4"/><path d="M6 15l4-4 3 3 5-6"/><path d="M18 8h-3M18 8v3"/></>,
  alert:     <><path d="M12 4 3 19h18z"/><path d="M12 10v4M12 16.5v.5"/></>,
  master:    <><path d="M5 5.5C5 4.7 8.1 4 12 4s7 0.7 7 1.5v13c0 0.8-3.1 1.5-7 1.5s-7-0.7-7-1.5z"/><path d="M5 5.5C5 6.3 8.1 7 12 7s7-0.7 7-1.5M5 12c0 0.8 3.1 1.5 7 1.5s7-0.7 7-1.5"/></>,
  shield:    <><path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6z"/><path d="M9 12l2 2 4-4"/></>,
  /* 그래프 화면 전용 */
  core:      <><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></>,
  branch:    <><circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="12" r="2.2"/><circle cx="7" cy="18" r="2.2"/><path d="M8 7l8 4M8.5 16.5 16 13"/></>,
  leaf:      <><path d="M5 19c0-8 6-13 14-13 0 8-5 14-13 14a6 6 0 0 1-1-1z"/><path d="M9 15c2-3 4-4 7-5"/></>,
  sparkle:   <><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z"/><path d="M18 15l.7 2.3L21 18l-2.3.7L18 21l-.7-2.3L15 18l2.3-.7z"/></>,
  history:   <><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4.5V9H8"/><path d="M12 8v4.5l3 1.8"/></>,
  exportIco: <><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></>,
  plusSeed:  <><circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/></>,
};
function NavIcon({ name, size=18, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      {NAV_ICON_PATHS[name] || NAV_ICON_PATHS.home}
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────
   NAV CONFIGS
────────────────────────────────────────────────────────────── */
const S_NAV = [
  { id:"S05",icon:"home",label:"대시보드" },
  { id:"S06",icon:"graph",label:"그래프" },
  { id:"S11",icon:"text",label:"텍스트" },
  { id:"S15",icon:"voice",label:"음성" },
  { id:"S20",icon:"form",label:"양식" },
  { id:"S24",icon:"comment",label:"코멘트" },
  { id:"S25",icon:"bell",label:"알림" },
  { id:"S28",icon:"stats",label:"통계" },
  { id:"S30",icon:"settings",label:"설정" },
];
const T_NAV = [
  { id:"T03",icon:"home",label:"대시보드" },
  { id:"T06",icon:"users",label:"담당 학생" },
  { id:"T11",icon:"comment",label:"코멘트" },
  { id:"S15",icon:"voice",label:"음성" },
  { id:"S20",icon:"form",label:"양식" },
  { id:"S25",icon:"bell",label:"알림" },
  { id:"S30",icon:"settings",label:"설정" },
];
const A_NAV = [
  { id:"A01",icon:"home",label:"대시보드" },
  { id:"A02",icon:"users",label:"사용자 관리" },
  { id:"A08",icon:"alert",label:"신고 큐" },
  { id:"A06",icon:"check",label:"교사 검증" },
  { id:"A13",icon:"system",label:"시스템 헬스" },
  { id:"A14",icon:"metric",label:"운영 메트릭" },
  { id:"A21",icon:"report",label:"감사 로그" },
  { id:"A25",icon:"master",label:"마스터 데이터" },
  { id:"A29",icon:"shield",label:"관리자 관리" },
];

/* ──────────────────────────────────────────────────────────────
   SIDEBAR
────────────────────────────────────────────────────────────── */
function Sidebar({ nav, active, onNav, role, dark }) {
  const { state, actions } = useStore();
  const user = state.session?.user;
  const displayName = user?.name || (dark?"시스템 관리자":"게스트");
  const displayEmail = user?.email || "—";
  return (
    <div className={`sidebar sb-${dark?"dark":"light"}`}>
      <div className="sb-logo">
        <div className="sb-logo-icon"><TFI s={22} color="#fff">{dark?"🛡️":"📚"}</TFI></div>
        <span className="sb-logo-text">{dark?"관리자 콘솔":"생기부 관리"}</span>
      </div>
      <div className="sb-section">
        {nav.map(n => {
          const isActive = active===n.id;
          // 푸른끼 있는 gray stroke / 활성 시 blue
          const stroke = isActive ? (dark?TDS.blue400:TDS.blue500) : (dark?"#7c8aa3":"#6b7a90");
          return (
          <div key={n.id} className={`sb-item${isActive?" active":""}`} onClick={()=>onNav(n.id)}>
            <span className="sb-icon" style={{display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
              <NavIcon name={n.icon} size="100%" color={stroke} />
            </span>{n.label}
          </div>
          );
        })}
      </div>
      <div className="sb-profile">
        <Av name={displayName[0]||"?"} size="sm" />
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span className="sb-pname">{displayName}</span>
            <span className="sb-chip">{role}</span>
          </div>
          <div className="sb-pemail">{displayEmail}</div>
        </div>
        <button
          className="sb-logout"
          title="로그아웃"
          onClick={()=>actions.signOut()}
          style={{flexShrink:0,width:32,height:32,borderRadius:8,border:"none",background:"transparent",cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center"}}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={dark?"#7c8aa3":"#8b95a1"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   HEADER
────────────────────────────────────────────────────────────── */
const TITLES = {
  S01:"",S03:"",S04:"",A00:"",
  S05:"대시보드",S06:"그래프",S07:"노드 상세",S08:"엣지 상세",S09:"시드 추가",S10:"변경 이력",
  S11:"텍스트 영역",S12:"영역 편집",S13:"PDF 업로드",S14:"파싱 결과 검토",
  S15:"음성 활동",S16:"녹음 중",S17:"보고서 검토",S18:"참여자 관리",S19:"매칭 제안",
  S20:"양식 템플릿",S21:"양식 결과물",S22:"결과물 상세",S23:"가지치기 추천",
  S24:"코멘트",S25:"알림",S26:"피드",S27:"통합 검색",S28:"통계",S29:"내보내기",
  S30:"설정",S31:"계정 정보",S32:"계정 삭제",
  T01:"교사 자격 검증 신청",T02:"자격 검증 상태",T03:"교사 대시보드",
  T04:"학생 매핑 신청",T05:"매핑 신청 상태",T06:"담당 학생 목록",
  T07:"학생 상세",T08:"그래프 R",T09:"노드 상세 R",T10:"코멘트 작성",T11:"코멘트",T12:"회의 녹음",
  A01:"관리자 대시보드",A02:"사용자 관리",A03:"사용자 상세",A04:"계정 정지·해제",
  A05:"강제 삭제",A06:"교사 자격 검증 큐",A07:"자격 상세 검토",A08:"신고 큐",A09:"신고 상세",
  A10:"신고된 코멘트",A11:"코멘트 강제 삭제",A12:"데이터 스냅샷",
  A13:"시스템 헬스",A14:"운영 메트릭",A15:"임베딩 모델",A16:"모델 교체",
  A17:"공지 목록",A18:"공지 발행",A19:"JWKS 키 회전",A20:"Redis 토글",
  A21:"감사 로그",A22:"감사 로그 상세",A23:"감사 로그 내보내기",A24:"Investigation",
  A25:"학기·과목",A26:"양식 템플릿 마스터",A27:"Enum 마스터",A28:"시스템 설정",
  A29:"관리자 목록",A30:"Tier 변경",A31:"본인 활동 이력",A32:"디버깅 신청",
};
function GlobalHeader({ onNav }) {
  return (
    <>
      <div className="icon-btn" onClick={()=>onNav("S27")} title="검색">
        <TFI s={18} color={TDS.textSecondary}>🔍</TFI>
      </div>
      <div className="icon-btn" onClick={()=>onNav("S25")} title="알림" style={{position:"relative"}}>
        <TFI s={18} color={TDS.textSecondary}>🔔</TFI>
        <span className="notif-dot" />
      </div>
      <Av name="홍" size="sm" />
    </>
  );
}

/* ──────────────────────────────────────────────────────────────
   ── STUDENT SCREENS ──
────────────────────────────────────────────────────────────── */

/* S01 로그인 */
function S01({ onNav }) {
  const { state, actions } = useStore();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [localErr, setLocalErr] = useState("");
  const busy = state.authLoading;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const doPasswordLogin = async () => {
    setLocalErr("");
    if (!emailOk) { setLocalErr("올바른 이메일 형식을 입력하세요."); return; }
    if (pw.length < 4) { setLocalErr("비밀번호를 입력하세요."); return; }
    try { await actions.signInPassword(email, pw); /* 게이팅이 자동으로 역할 홈으로 이동 */ }
    catch (e) { setLocalErr(e.message); }
  };
  const doGoogleLogin = async () => {
    setLocalErr("");
    try { await actions.signInGoogle(); }
    catch (e) { setLocalErr(e.message); }
  };
  const onKey = e => { if (e.key === "Enter" && !busy) doPasswordLogin(); };
  const errMsg = localErr || state.authError;

  return (
    <div className="login-wrap">
      {/* 왼쪽 — TDS Primary Blue 그라데이션 */}
      <div className="login-left">
        <div className="login-left-content">

          {/* 로고 */}
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:48}}>
            <div style={{width:48,height:48,borderRadius:14,background:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <TFI s={24} color="#fff">📚</TFI>
            </div>
            <div>
              <div style={{fontSize:19,fontWeight:800,letterSpacing:"-.3px"}}>생기부 관리 시스템</div>
              <div style={{fontSize:12,opacity:.65,marginTop:2}}>Ontology-based Record Management</div>
            </div>
          </div>

          {/* 헤드라인 */}
          <h1 style={{fontSize:"clamp(24px,2.6vw,32px)",fontWeight:800,marginBottom:12,lineHeight:1.25,letterSpacing:"-.5px"}}>
            나만의 학습 여정을<br/>체계적으로 기록하세요
          </h1>
          <p style={{fontSize:15,opacity:.78,lineHeight:1.75,marginBottom:40}}>
            온톨로지 기반 지식 그래프로<br/>생활기록부를 스마트하게 관리합니다
          </p>

          {/* 특징 3가지 — TFI color="#fff" */}
          {[
            ["🧠","지식 그래프","노드와 엣지로 연결되는 학습 지식 구조"],
            ["🎤","AI 음성 인식","강의·토론을 실시간 STT로 자동 기록"],
            ["📝","맞춤형 양식","생기부 영역별 AI 자소서·세특 자동 작성"],
          ].map(([ic,t,d])=>(
            <div key={t} style={{display:"flex",gap:14,marginBottom:18,alignItems:"flex-start"}}>
              <div style={{width:42,height:42,borderRadius:12,background:"rgba(255,255,255,.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <TFI s={20} color="#fff">{ic}</TFI>
              </div>
              <div>
                <div style={{fontWeight:700,fontSize:14,marginBottom:2}}>{t}</div>
                <div style={{fontSize:13,opacity:.7,lineHeight:1.55}}>{d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 오른쪽 — 로그인 폼 */}
      <div className="login-right">
        <div className="login-box">
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:32}}>
            <div style={{width:36,height:36,borderRadius:10,background:TDS.blue500,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <TFI s={18} color="#fff">📚</TFI>
            </div>
            <div style={{fontSize:16,fontWeight:700,color:TDS.textPrimary}}>생기부 관리</div>
          </div>

          <h2 style={{fontSize:26,fontWeight:800,marginBottom:6,color:TDS.textPrimary,letterSpacing:"-.3px"}}>시작하기</h2>
          <p style={{fontSize:14,color:TDS.textTertiary,marginBottom:28}}>학교 Google 계정으로 로그인하세요</p>

          {/* Google 로그인 */}
          <button
            disabled={busy}
            style={{width:"100%",height:52,borderRadius:12,border:`1.5px solid ${TDS.borderDefault}`,background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",gap:10,fontSize:15,fontWeight:600,color:TDS.textPrimary,cursor:busy?"not-allowed":"pointer",opacity:busy?.6:1,marginBottom:20,transition:"border-color .14s"}}
            onClick={doGoogleLogin}
            onMouseEnter={e=>{ if(!busy) e.currentTarget.style.borderColor=TDS.blue500; }}
            onMouseLeave={e=>e.currentTarget.style.borderColor=TDS.borderDefault}
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            {busy ? "로그인 중…" : "Google로 시작하기"}
          </button>

          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
            <div style={{flex:1,height:1,background:TDS.borderDefault}} />
            <span style={{fontSize:12,color:TDS.textTertiary}}>또는</span>
            <div style={{flex:1,height:1,background:TDS.borderDefault}} />
          </div>

          {errMsg && (
            <div style={{marginBottom:14,padding:"10px 12px",borderRadius:10,background:"rgba(240,68,68,.08)",border:`1px solid rgba(240,68,68,.25)`,color:TDS.danger,fontSize:13,fontWeight:500}}>
              {errMsg}
            </div>
          )}

          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:13,fontWeight:600,color:TDS.textSecondary,marginBottom:6}}>이메일</label>
            <input className="inp" placeholder="school@example.ac.kr" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={onKey} disabled={busy} autoComplete="username" />
          </div>
          <div style={{marginBottom:24}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <label style={{fontSize:13,fontWeight:600,color:TDS.textSecondary}}>비밀번호</label>
              <span style={{fontSize:12,color:TDS.blue500,cursor:"pointer"}}>비밀번호 찾기</span>
            </div>
            <input className="inp" type="password" placeholder="••••••••" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={onKey} disabled={busy} autoComplete="current-password" />
          </div>

          <Btn v="primary" s="lg" fw onClick={doPasswordLogin} disabled={busy} style={busy?{opacity:.7,cursor:"not-allowed"}:undefined}>{busy ? "로그인 중…" : "로그인"}</Btn>

          <div style={{textAlign:"center",marginTop:14,fontSize:11,color:TDS.textTertiary,lineHeight:1.6}}>
            데모 계정 · 학생 <b>hong@school.ac.kr</b> / 교사 <b>sujin@school.ac.kr</b> · 비번 <b>1234</b>
          </div>

          <div style={{textAlign:"center",marginTop:16,fontSize:12,color:TDS.textTertiary}}>
            교사 계정{" "}
            <span style={{color:TDS.blue500,cursor:"pointer",fontWeight:600}} onClick={()=>onNav("T01")}>신청하기</span>
            {"  ·  "}
            <span style={{color:TDS.blue500,cursor:"pointer"}} onClick={()=>onNav("A00")}>관리자 콘솔</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* S03 가입 환영 */
function S03({ onNav }) {
  const [role, setRole] = useState("student");
  return (
    <div style={{minHeight:"100vh",background:TDS.bgSecondary,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:TDS.bgPrimary,borderRadius:24,padding:"44px 52px",maxWidth:500,width:"90%",boxShadow:"0 20px 60px rgba(0,0,0,.12)",textAlign:"center"}}>
        <div style={{fontSize:52,marginBottom:16}}><TFI s={52}>🎉</TFI></div>
        <h2 style={{fontSize:24,fontWeight:800,marginBottom:10,color:TDS.textPrimary}}>환영합니다!</h2>
        <p style={{fontSize:14,color:TDS.textTertiary,marginBottom:32}}>어떤 역할로 사용하실 건가요?</p>
        <div className="grid2 g12 mb24" style={{gap:12,marginBottom:28}}>
          {[["student","🎓","학생","지식 그래프 구축\n생기부 텍스트 관리"],
            ["teacher","👩‍🏫","교사","담당 학생 관리\n코멘트 작성"]].map(([v,ic,t,d])=>(
            <div key={v} onClick={()=>setRole(v)} style={{padding:"20px 16px",borderRadius:14,border:`2px solid ${role===v?TDS.blue500:TDS.borderDefault}`,background:role===v?TDS.blue50:TDS.bgPrimary,cursor:"pointer",transition:"all .14s"}}>
              <div style={{fontSize:30,marginBottom:10}}><TFI s={30} color={role===v?TDS.blue500:TDS.textTertiary}>{ic}</TFI></div>
              <div style={{fontSize:15,fontWeight:700,color:TDS.textPrimary,marginBottom:6}}>{t}</div>
              <div style={{fontSize:12,color:TDS.textTertiary,whiteSpace:"pre-line"}}>{d}</div>
            </div>
          ))}
        </div>
        <Btn v="primary" fw onClick={()=>onNav(role==="teacher"?"T01":"S04")}>계속하기</Btn>
      </div>
    </div>
  );
}

/* S04 시드 입력 */
function S04({ onNav }) {
  const [kws, setKws] = useState(["양자컴퓨팅","물리학","화학","인공지능","수학"]);
  const [inp, setInp] = useState("");
  const sugg = ["유기화학","고전역학","선형대수","알고리즘","생명과학","데이터구조","통계학"].filter(s=>!kws.includes(s));
  const add = (k)=>{ if(k&&kws.length<20&&!kws.includes(k)){ setKws([...kws,k]); setInp(""); }};
  const del = (k)=>setKws(kws.filter(x=>x!==k));
  return (
    <div style={{minHeight:"100vh",background:TDS.bgSecondary,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:TDS.bgPrimary,borderRadius:24,padding:"44px 48px",maxWidth:640,width:"90%",boxShadow:"0 16px 48px rgba(0,0,0,.10)"}}>
        <div style={{height:4,background:TDS.bgTertiary,borderRadius:2,marginBottom:32}}>
          <div style={{height:4,background:TDS.blue500,borderRadius:2,width:"67%"}} />
        </div>
        <h2 style={{fontSize:22,fontWeight:800,color:TDS.textPrimary,marginBottom:8}}>나의 관심 키워드를 입력해주세요</h2>
        <p style={{fontSize:13,color:TDS.textTertiary,marginBottom:28}}>1~20개 키워드를 입력하면 AI가 자동으로 지식 그래프를 생성합니다</p>
        <div className="row g-10 mb20" style={{gap:10,marginBottom:20}}>
          <input className="inp" style={{flex:1}} placeholder="키워드 입력 후 Enter" value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add(inp)} />
          <Btn v="primary" s="sm" onClick={()=>add(inp)}>추가</Btn>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,minHeight:48,padding:"12px 0",borderBottom:`1px solid ${TDS.borderDefault}`,marginBottom:20}}>
          {kws.map(k=>(
            <span key={k} className="chip active">{k}<span className="chip-x" onClick={()=>del(k)}>✕</span></span>
          ))}
          {kws.length===0&&<span style={{color:TDS.textDisabled,fontSize:13}}>키워드를 입력하세요...</span>}
        </div>
        <p style={{fontSize:12,color:TDS.textTertiary,marginBottom:12,display:"flex",alignItems:"center",gap:5}}><TFI s={13} color="#f59e0b">💡</TFI> 추천 키워드</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:32}}>
          {sugg.map(s=><span key={s} className="chip" onClick={()=>add(s)}>+ {s}</span>)}
        </div>
        <div className="row g-12" style={{gap:12}}>
          <Btn v="secondary" s="md" onClick={()=>onNav("S05")}>나중에 입력</Btn>
          <Btn v="primary" s="md" style={{flex:1}} onClick={()=>onNav("S05")}>그래프 생성하기 ({kws.length}개)</Btn>
        </div>
      </div>
    </div>
  );
}

/* ── S05 도넛 차트 헬퍼 ── */
function DonutChart({ data, size=148, label, pct }) {
  // Figma arcData 방식과 동일: SVG stroke-dasharray로 arc 구현
  const r = (size - 16) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;

  let startAngle = -Math.PI / 2; // 12시 방향 시작
  const arcs = data.map(d => {
    const sweep = 2 * Math.PI * d.pct;
    const endAngle = startAngle + sweep;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle - 0.02);
    const y2 = cy + r * Math.sin(endAngle - 0.02);
    const large = sweep > Math.PI ? 1 : 0;
    const path = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
    startAngle = endAngle;
    return { path, color: d.color };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{display:"block"}}>
      {/* 트랙 */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={TDS.bgTertiary} strokeWidth={16} />
      {/* 각 세그먼트 */}
      {arcs.map((a, i) => (
        <path key={i} d={a.path} fill="none" stroke={a.color} strokeWidth={16} strokeLinecap="round" />
      ))}
      {/* 구멍 (흰 원) */}
      <circle cx={cx} cy={cy} r={r - 12} fill={TDS.bgPrimary} />
      {/* 중앙 텍스트 */}
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize="12" fill={TDS.textTertiary} fontFamily="Pretendard, sans-serif">{label}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="20" fontWeight="700" fill={TDS.textPrimary} fontFamily="Pretendard, sans-serif">{pct}</text>
    </svg>
  );
}

/* S05 학생 대시보드 */
function S05({ onNav }) {
  const [period, setPeriod] = useState("일별");

  // 30개 데이터 포인트 (피그마 DAU 차트와 동일)
  const pts = [42,68,55,82,71,90,78,95,83,110,98,115,88,102,119,105,125,108,118,112,98,115,107,120,113,119,125,118,122,119];
  const maxV = 130, nPts = pts.length;
  const W = 800, H = 200, padX = 40, padY = 12;
  const tx = i => padX + (i / (nPts - 1)) * (W - padX - 8);
  const ty = v => padY + (1 - v / maxV) * (H - padY * 2);
  const linePath = pts.map((v, i) => `${i === 0 ? "M" : "L"} ${tx(i)} ${ty(v)}`).join(" ");
  const areaPath = linePath + ` L ${tx(nPts-1)} ${H} L ${tx(0)} ${H} Z`;

  // stat 카드 데이터 (피그마와 동일)
  const stats = [
    { label:"총 노드 수", value:"2,847개", sub:"전월 대비 +12%", color:TDS.blue500, icon:"🧠", iconBg:TDS.blue50, trend:"+12%", trendUp:true },
    { label:"텍스트 영역", value:"8 / 8",  sub:"모든 영역 입력됨", color:TDS.success, icon:"📄", iconBg:TDS.successBg, trend:"완료", trendUp:true },
    { label:"음성 세션",  value:"23회",    sub:"총 18시간 37분", color:TDS.textPrimary, icon:"🎙️", iconBg:TDS.bgTertiary, trend:"+3", trendUp:true },
    { label:"양식 생성",  value:"6개",     sub:"이번 달 3개 생성", color:TDS.warning, icon:"📝", iconBg:TDS.warningBg, trend:"+2", trendUp:true },
  ];

  // 활동 항목 (dot 색상 피그마와 동일)
  const acts = [
    { title:"텍스트 편집", desc:"세특 영역 내용 수정",      time:"5분 전",   dot:TDS.blue500 },
    { title:"노드 추가",   desc:'"양자컴퓨팅" 노드 생성',   time:"1시간 전", dot:TDS.success },
    { title:"음성 녹음",   desc:"화학 세특 토론 기록",       time:"2시간 전", dot:TDS.warning },
    { title:"양식 생성",   desc:"화학과 지원용 자소서 생성", time:"어제",     dot:TDS.blue500 },
  ];

  // 코멘트 항목
  const comments = [
    { from:"김선생님", txt:"세특 내용 중 실험 결과 부분을 더 구체적으로 서술해 주세요.", time:"10분 전", unread:true },
    { from:"박선생님", txt:"동아리 활동에서 리더십이 잘 드러나고 있어요.",               time:"1시간 전", unread:false },
    { from:"이선생님", txt:"양자컴퓨팅 노드에 관련 논문 링크도 추가해 보세요.",           time:"어제",    unread:false },
  ];

  // X축 날짜 레이블
  const xLabels = ["01.19","01.22","01.25","01.28","01.31","02.03","02.06","02.09","02.12","02.15"];

  return (
    <div className="content">

      {/* ── Stat 카드 4개 (피그마: 아이콘배지 + 트렌드배지 + 하단 컬러라인) ── */}
      <div className="grid4" style={{gap:20,marginBottom:24}}>
        {stats.map((s,i) => (
          <div key={i} className="card" style={{padding:"22px 24px",position:"relative",overflow:"hidden"}}>
            {/* 아이콘 배경 */}
            <div style={{width:44,height:44,borderRadius:12,background:s.iconBg,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:10}}>
              <TFI s={22} color={s.color}>{s.icon}</TFI>
            </div>
            {/* 레이블 */}
            <div style={{fontSize:13,color:TDS.textTertiary,fontWeight:500,marginBottom:6}}>{s.label}</div>
            {/* 값 */}
            <div style={{fontSize:26,fontWeight:700,color:s.color,lineHeight:1.15,marginBottom:8}}>{s.value}</div>
            {/* 서브텍스트 */}
            <div style={{fontSize:12,color:TDS.textDisabled}}>{s.sub}</div>
            {/* 트렌드 배지 */}
            <div style={{position:"absolute",top:20,right:20,padding:"3px 8px",borderRadius:4,background:s.trendUp?TDS.successBg:TDS.dangerBg,color:s.trendUp?TDS.success:TDS.danger,fontSize:11,fontWeight:700}}>{s.trend}</div>
            {/* 하단 컬러 액센트 라인 */}
            <div style={{position:"absolute",bottom:0,left:0,right:0,height:3,background:s.color,borderRadius:"0 0 16px 16px"}} />
          </div>
        ))}
      </div>

      {/* ── DAU 라인 차트 (피그마: 30pt, 면채움, dot 6개, Y축 그리드) ── */}
      <div className="card card-p mb24" style={{marginBottom:24}}>
        <div className="card-hdr">
          <div className="row" style={{gap:8,alignItems:"center"}}>
            <span className="card-title">DAU (일별 활성 사용자)</span>
            <div style={{width:18,height:18,borderRadius:"50%",background:TDS.bgTertiary,color:TDS.textTertiary,fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>?</div>
          </div>
          <div className="row" style={{gap:12,alignItems:"center"}}>
            <div className="tab-pill-wrap">
              {["일별","주별","월별"].map(p=>(
                <div key={p} className={`tab-pill${period===p?" active":""}`} onClick={()=>setPeriod(p)}>{p}</div>
              ))}
            </div>
            <div className="date-range"><TFI>📅</TFI>&nbsp;2025.12.28 ~ 2026.01.28</div>
            <Btn v="secondary" s="sm">다운로드</Btn>
          </div>
        </div>

        {/* SVG 차트 — 완전 반응형: viewBox 유지, height auto */}
        <div style={{background:TDS.bgSecondary,borderRadius:10,padding:"16px 16px 0",overflow:"hidden"}}>
          <div style={{position:"relative",width:"100%",paddingBottom:"27%",minHeight:120}}>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="xMidYMid meet"
              style={{position:"absolute",inset:0,width:"100%",height:"100%",display:"block"}}
            >
              <defs>
                <linearGradient id="dauGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TDS.blue500} stopOpacity="0.18" />
                  <stop offset="100%" stopColor={TDS.blue500} stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Y축 그리드 라인 + 레이블 */}
              {[0,25,50,75,100,125].map(v => (
                <g key={v}>
                  <line x1={padX} y1={ty(v)} x2={W-8} y2={ty(v)} stroke={TDS.borderDefault} strokeWidth="0.8" opacity="0.7" />
                  <text x={padX-4} y={ty(v)+4} textAnchor="end" fontSize="10" fill={TDS.textTertiary} fontFamily="Pretendard,sans-serif">{v}</text>
                </g>
              ))}
              {/* 면 채움 */}
              <path d={areaPath} fill="url(#dauGrad)" />
              {/* 라인 */}
              <path d={linePath} fill="none" stroke={TDS.blue500} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {/* 데이터 포인트 (6개 강조) */}
              {[4,9,14,19,24,29].map(i => (
                <circle key={i} cx={tx(i)} cy={ty(pts[i])} r="4" fill="#fff" stroke={TDS.blue500} strokeWidth="2.5" />
              ))}
            </svg>
          </div>
        </div>
        {/* X축 날짜 레이블 */}
        <div style={{display:"flex",justifyContent:"space-between",padding:"6px 16px 0",fontSize:10,color:TDS.textTertiary}}>
          {xLabels.map(d => <span key={d}>{d}</span>)}
        </div>
      </div>

      {/* ── OS 도넛 + 성별 도넛 (피그마와 동일) ── */}
      <div className="grid2" style={{gap:20,marginBottom:24}}>
        {/* OS 분포 */}
        <div className="card card-p">
          <div className="card-hdr">
            <span className="card-title">OS 분포</span>
            <span style={{fontSize:13,color:TDS.textTertiary}}>총 763명</span>
          </div>
          {/* 도넛 */}
          <div style={{display:"flex",justifyContent:"center",marginBottom:16}}>
            <DonutChart
              size={148}
              label="Android"
              pct="61.3%"
              data={[
                {color:TDS.chartAndroid, pct:0.613},
                {color:TDS.chartiOS,     pct:0.387},
              ]}
            />
          </div>
          {/* 구분선 */}
          <div style={{height:1,background:TDS.borderDefault,marginBottom:14}} />
          {/* 범례 */}
          {[
            {col:TDS.chartAndroid, name:"Android", cnt:"468명", pct:"61.3%"},
            {col:TDS.chartiOS,     name:"iOS",     cnt:"295명", pct:"38.7%"},
          ].map(l=>(
            <div key={l.name} style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:l.col,flexShrink:0}} />
              <span style={{fontSize:13,color:TDS.textSecondary,minWidth:60}}>{l.name}</span>
              <span style={{fontSize:13,color:TDS.textSecondary,flex:1}}>{l.cnt}</span>
              <span style={{fontSize:13,fontWeight:600,color:TDS.textPrimary,minWidth:44}}>{l.pct}</span>
              {/* 미니 프로그레스바 */}
              <div style={{width:48,height:4,background:TDS.bgTertiary,borderRadius:2,overflow:"hidden"}}>
                <div style={{height:4,borderRadius:2,background:l.col,width:`${parseFloat(l.pct)}%`}} />
              </div>
            </div>
          ))}
        </div>

        {/* 성별 분포 */}
        <div className="card card-p">
          <div className="card-hdr">
            <span className="card-title">성별 분포</span>
            <span style={{fontSize:13,color:TDS.textTertiary}}>총 763명</span>
          </div>
          <div style={{display:"flex",justifyContent:"center",marginBottom:16}}>
            <DonutChart
              size={148}
              label="남성"
              pct="64.7%"
              data={[
                {color:TDS.chartMale,   pct:0.647},
                {color:TDS.chartFemale, pct:0.353},
              ]}
            />
          </div>
          <div style={{height:1,background:TDS.borderDefault,marginBottom:14}} />
          {[
            {col:TDS.chartMale,   name:"남성", cnt:"494명", pct:"64.7%"},
            {col:TDS.chartFemale, name:"여성", cnt:"269명", pct:"35.3%"},
          ].map(l=>(
            <div key={l.name} style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:l.col,flexShrink:0}} />
              <span style={{fontSize:13,color:TDS.textSecondary,minWidth:60}}>{l.name}</span>
              <span style={{fontSize:13,color:TDS.textSecondary,flex:1}}>{l.cnt}</span>
              <span style={{fontSize:13,fontWeight:600,color:TDS.textPrimary,minWidth:44}}>{l.pct}</span>
              <div style={{width:48,height:4,background:TDS.bgTertiary,borderRadius:2,overflow:"hidden"}}>
                <div style={{height:4,borderRadius:2,background:l.col,width:`${parseFloat(l.pct)}%`}} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 최근 활동 + 읽지 않은 코멘트 ── */}
      <div className="grid2" style={{gap:20}}>
        {/* 최근 활동 (피그마: 색상 dot + title/desc/time) */}
        <div className="card card-p">
          <div className="card-hdr">
            <span className="card-title">최근 활동</span>
            <Btn v="ghost" s="sm" onClick={()=>onNav("S26")}>피드 보기</Btn>
          </div>
          {acts.map((a,i) => (
            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"13px 0",borderBottom:i<acts.length-1?`1px solid ${TDS.bgTertiary}`:"none"}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:a.dot,flexShrink:0,marginTop:7}} />
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:500,color:TDS.textPrimary}}>{a.title}</div>
                <div style={{fontSize:13,color:TDS.textTertiary,marginTop:2}}>{a.desc}</div>
              </div>
              <div style={{fontSize:12,color:TDS.textDisabled,flexShrink:0}}>{a.time}</div>
            </div>
          ))}
        </div>

        {/* 읽지 않은 코멘트 (피그마: 아바타 + 안 읽음 dot + 내용 클리핑) */}
        <div className="card card-p">
          <div className="card-hdr">
            <div className="row" style={{gap:8,alignItems:"center"}}>
              <span className="card-title">읽지 않은 코멘트</span>
              <span className="badge-num">3</span>
            </div>
            <Btn v="ghost" s="sm" onClick={()=>onNav("S24")}>전체 보기</Btn>
          </div>
          {comments.map((c,i) => (
            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"13px 0",borderBottom:i<comments.length-1?`1px solid ${TDS.bgTertiary}`:"none",position:"relative"}}>
              {/* 안 읽음 파란 dot */}
              {c.unread && <div style={{position:"absolute",left:-2,top:18,width:6,height:6,borderRadius:"50%",background:TDS.blue500}} />}
              {/* 아바타 */}
              <Av name={c.from[0]} size="sm" />
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:13,fontWeight:700,color:TDS.textPrimary}}>{c.from}</span>
                  <span style={{fontSize:11,color:TDS.textDisabled,flexShrink:0,marginLeft:8}}>{c.time}</span>
                </div>
                <div style={{fontSize:13,color:TDS.textSecondary,overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{c.txt}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* S06 그래프 메인 */
const KIND_META = {
  root:  { icon:"core",   label:"핵심 노드", ring:"rgba(49,130,246,.25)" },
  topic: { icon:"branch", label:"연결 노드", ring:"rgba(69,147,252,.22)" },
  leaf:  { icon:"leaf",   label:"말단 노드", ring:"rgba(34,197,94,.22)" },
};
function S06({ onNav }) {
  const { state, actions } = useStore();
  const { nodes, edges, loading } = state.graph;
  const [sel, setSel] = useState(null);
  const [hover, setHover] = useState(null);
  const [q, setQ] = useState("");

  // 최초 진입 시 그래프가 비어있으면 로드
  useEffect(()=>{ if(!nodes.length && !loading) actions.loadGraph(state.session?.user?.id); /* eslint-disable-next-line */ }, []);
  // 선택 노드가 삭제되면 패널 닫기
  useEffect(()=>{ if(sel && !nodes.find(n=>n.id===sel.id)) setSel(null); }, [nodes, sel]);

  const nodeById = id => nodes.find(n=>n.id===id);
  const edgesOf = id => edges.filter(e=>e.from===id||e.to===id);
  const matched = q.trim() ? nodes.filter(n=>n.label.includes(q.trim())).map(n=>n.id) : null;
  const activeId = hover || sel?.id || null;
  const connectedIds = activeId ? new Set(edgesOf(activeId).flatMap(e=>[e.from,e.to])) : null;

  const handleDelete = async (id) => { await actions.deleteNode(id); };
  const handlePrune = async () => {
    const sug = await api.graph.pruneSuggestions(state.session?.user?.id);
    if (sug.length) actions.toast("info", `가지치기 추천 ${sug.length}건 — 상세는 S23에서 확인`);
    onNav("S23");
  };

  // 카테고리별 개수 (범례용)
  const kindCounts = nodes.reduce((a,n)=>{ a[n.kind]=(a[n.kind]||0)+1; return a; }, {});

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div className="toolbar">
        <Btn v="primary" s="sm" onClick={()=>onNav("S09")}><NavIcon name="plusSeed" size={15} color="#fff"/> 시드 추가</Btn>
        <Btn v="secondary" s="sm" onClick={()=>onNav("S10")}><NavIcon name="history" size={15} color={TDS.textSecondary}/> 변경 이력</Btn>
        <Btn v="secondary" s="sm" onClick={handlePrune}><NavIcon name="sparkle" size={15} color={TDS.textSecondary}/> 가지치기 추천</Btn>
        <Btn v="secondary" s="sm" onClick={()=>onNav("S29")}><NavIcon name="exportIco" size={15} color={TDS.textSecondary}/> 내보내기</Btn>
        <div style={{flex:1}} />
        <div className="search-wrap" style={{width:220}}>
          <NavIcon name="graph" size={15} color={TDS.textTertiary}/><input placeholder="노드 검색..." value={q} onChange={e=>setQ(e.target.value)} />
        </div>
      </div>
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        {/* Canvas */}
        <div style={{flex:1,padding:20,overflow:"hidden",position:"relative"}}>
          <div style={{height:"100%",background:`radial-gradient(circle at 50% 40%, ${TDS.bgSecondary} 0%, ${TDS.bgTertiary} 100%)`,borderRadius:16,position:"relative",border:`1px solid ${TDS.borderDefault}`,overflow:"hidden"}}>
            {/* 도트 격자 배경 */}
            <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:.5,pointerEvents:"none"}}>
              <defs>
                <pattern id="gdots" width="26" height="26" patternUnits="userSpaceOnUse">
                  <circle cx="1.5" cy="1.5" r="1.5" fill={TDS.borderDefault} />
                </pattern>
                <linearGradient id="edgeGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={TDS.blue400} stopOpacity=".9"/>
                  <stop offset="100%" stopColor="#22c55e" stopOpacity=".7"/>
                </linearGradient>
              </defs>
              <rect width="100%" height="100%" fill="url(#gdots)" />
            </svg>

            {loading && (
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12,color:TDS.textTertiary,zIndex:5}}>
                <div className="spinner" /><div style={{fontSize:13}}>그래프 불러오는 중…</div>
              </div>
            )}
            {!loading && !nodes.length && (
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14,color:TDS.textTertiary}}>
                <NavIcon name="branch" size={44} color={TDS.borderStrong}/>
                <div style={{fontSize:14}}>아직 노드가 없습니다</div>
                <Btn v="primary" s="sm" onClick={()=>onNav("S09")}><NavIcon name="plusSeed" size={14} color="#fff"/> 첫 시드 추가하기</Btn>
              </div>
            )}

            {/* 엣지 — 곡선 + 활성 노드 연결선 강조 */}
            <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}>
              {edges.map(e=>{
                const a=nodeById(e.from), b=nodeById(e.to);
                if(!a||!b) return null;
                const on = activeId && (e.from===activeId||e.to===activeId);
                // 퍼센트 좌표 → 곡선 제어점
                const ax=parseFloat(a.x), ay=parseFloat(a.y), bx=parseFloat(b.x), by=parseFloat(b.y);
                const mx=(ax+bx)/2, my=(ay+by)/2 - 4;
                return (
                  <path key={e.id}
                    d={`M ${ax}% ${ay}% Q ${mx}% ${my}% ${bx}% ${by}%`}
                    fill="none"
                    stroke={on?"url(#edgeGrad)":TDS.borderStrong}
                    strokeWidth={on?2.4:1.4}
                    strokeDasharray={on?"none":"4 4"}
                    opacity={activeId && !on ? .25 : (on?.95:.6)}
                    style={{transition:"opacity .2s, stroke-width .2s"}}
                  />
                );
              })}
            </svg>

            {/* 노드 — kind 아이콘 + 라벨 pill */}
            {nodes.map(n=>{
              const dimSearch = matched && !matched.includes(n.id);
              const dimActive = connectedIds && n.id!==activeId && !connectedIds.has(n.id);
              const dim = dimSearch || dimActive;
              const isActive = n.id===activeId;
              const meta = KIND_META[n.kind] || KIND_META.topic;
              return (
                <div key={n.id}
                  onClick={()=>setSel(sel?.id===n.id?null:n)}
                  onMouseEnter={()=>setHover(n.id)} onMouseLeave={()=>setHover(null)}
                  style={{position:"absolute",left:n.x,top:n.y,transform:`translate(-50%,-50%) scale(${isActive?1.12:1})`,display:"flex",flexDirection:"column",alignItems:"center",gap:5,cursor:"pointer",transition:"transform .2s, opacity .2s",opacity:dim?.28:1,zIndex:isActive?4:2}}>
                  <div style={{width:n.size,height:n.size,borderRadius:"50%",background:`radial-gradient(circle at 35% 30%, ${n.color}, ${n.color}dd)`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",boxShadow:isActive?`0 0 0 4px ${TDS.bgPrimary}, 0 0 0 7px ${n.color}, 0 8px 24px ${meta.ring}`:`0 4px 14px rgba(0,0,0,.2)`,border:`2px solid rgba(255,255,255,.35)`}}>
                    <NavIcon name={meta.icon} size={n.size>50?24:n.size>40?19:15} color="#fff"/>
                  </div>
                  <span style={{fontSize:n.size>50?12:11,fontWeight:700,color:TDS.textPrimary,background:TDS.bgPrimary,padding:"2px 8px",borderRadius:10,boxShadow:"0 1px 4px rgba(0,0,0,.1)",whiteSpace:"nowrap",border:`1px solid ${TDS.borderDefault}`}}>{n.label}</span>
                </div>
              );
            })}

            {/* 범례 (좌상단) */}
            {!!nodes.length && (
              <div style={{position:"absolute",top:16,left:16,background:TDS.bgPrimary,border:`1px solid ${TDS.borderDefault}`,borderRadius:12,padding:"12px 14px",boxShadow:"0 4px 16px rgba(0,0,0,.08)",minWidth:150}}>
                <div style={{fontSize:11,fontWeight:700,color:TDS.textTertiary,marginBottom:8,letterSpacing:".02em"}}>노드 유형</div>
                {["root","topic","leaf"].map(k=>{
                  const m=KIND_META[k]; const c={root:"#3182f6",topic:"#4593fc",leaf:"#22c55e"}[k];
                  return (
                    <div key={k} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                      <div style={{width:22,height:22,borderRadius:"50%",background:c,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        <NavIcon name={m.icon} size={13} color="#fff"/>
                      </div>
                      <span style={{fontSize:12,color:TDS.textSecondary,flex:1}}>{m.label}</span>
                      <span style={{fontSize:12,fontWeight:700,color:TDS.textPrimary}}>{kindCounts[k]||0}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 통계 배지 (우상단) */}
            {!!nodes.length && (
              <div style={{position:"absolute",top:16,right:16,display:"flex",gap:8}}>
                <div style={{background:TDS.bgPrimary,border:`1px solid ${TDS.borderDefault}`,borderRadius:10,padding:"8px 12px",display:"flex",alignItems:"center",gap:7,boxShadow:"0 2px 10px rgba(0,0,0,.06)"}}>
                  <NavIcon name="core" size={15} color={TDS.blue500}/>
                  <span style={{fontSize:13,fontWeight:700,color:TDS.textPrimary}}>{nodes.length}</span>
                  <span style={{fontSize:12,color:TDS.textTertiary}}>노드</span>
                </div>
                <div style={{background:TDS.bgPrimary,border:`1px solid ${TDS.borderDefault}`,borderRadius:10,padding:"8px 12px",display:"flex",alignItems:"center",gap:7,boxShadow:"0 2px 10px rgba(0,0,0,.06)"}}>
                  <NavIcon name="branch" size={15} color="#22c55e"/>
                  <span style={{fontSize:13,fontWeight:700,color:TDS.textPrimary}}>{edges.length}</span>
                  <span style={{fontSize:12,color:TDS.textTertiary}}>연결</span>
                </div>
              </div>
            )}

            {/* 줌 컨트롤 */}
            <div style={{position:"absolute",bottom:16,right:16,display:"flex",flexDirection:"column",gap:6}}>
              {["+","−"].map(z=>(
                <button key={z} style={{width:36,height:36,padding:0,display:"flex",alignItems:"center",justifyContent:"center",background:TDS.bgPrimary,border:`1px solid ${TDS.borderDefault}`,borderRadius:10,cursor:"pointer",fontSize:18,fontWeight:600,color:TDS.textSecondary,boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>{z}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Detail panel */}
        {sel&&(()=>{ const eList=edgesOf(sel.id); const meta=KIND_META[sel.kind]||KIND_META.topic; return (
          <div style={{width:360,background:TDS.bgPrimary,borderLeft:`1px solid ${TDS.borderDefault}`,padding:24,overflowY:"auto"}}>
            <div className="row-between mb16" style={{marginBottom:16}}>
              <span style={{fontSize:16,fontWeight:700,color:TDS.textPrimary}}>노드 상세</span>
              <button onClick={()=>setSel(null)} style={{background:TDS.bgTertiary,border:"none",width:28,height:28,borderRadius:8,cursor:"pointer",color:TDS.textSecondary}}>✕</button>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
              <div style={{width:56,height:56,borderRadius:"50%",background:`radial-gradient(circle at 35% 30%, ${sel.color}, ${sel.color}dd)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:`0 4px 14px ${meta.ring}`,border:"2px solid rgba(255,255,255,.35)"}}>
                <NavIcon name={meta.icon} size={26} color="#fff"/>
              </div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:20,fontWeight:800,color:TDS.textPrimary,marginBottom:4}}>{sel.label}</div>
                <Badge t="blue">{sel.cat}</Badge>
              </div>
            </div>
            <Divider my={16} />
            <p style={{fontSize:12,fontWeight:600,color:TDS.textTertiary,marginBottom:10}}>연결된 엣지 {eList.length}개</p>
            {eList.length ? eList.map((e,i)=>{
              const other = nodeById(e.from===sel.id?e.to:e.from);
              const om = KIND_META[other?.kind]||KIND_META.topic;
              return (
              <div key={e.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:TDS.bgTertiary,borderRadius:10,marginBottom:8}}>
                <div style={{width:30,height:30,borderRadius:"50%",background:other?.color||TDS.borderStrong,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <NavIcon name={om.icon} size={15} color="#fff"/>
                </div>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:TDS.textPrimary}}>{other?.label||"—"}</div>
                  <div style={{fontSize:12,color:TDS.textTertiary}}>{"하위 개념,연관 분야,선수 지식,응용 분야".split(",")[i%4]}</div>
                </div>
              </div>
              );
            }) : <div style={{fontSize:13,color:TDS.textDisabled}}>연결된 엣지가 없습니다</div>}
            <Divider my={16} />
            <p style={{fontSize:12,fontWeight:600,color:TDS.textTertiary,marginBottom:10}}>임베딩 미리보기</p>
            <div style={{background:TDS.bgTertiary,borderRadius:10,padding:12,fontSize:11,color:TDS.textSecondary,fontFamily:"monospace"}}>
              [0.234, 0.891, -0.123, 0.567, ...]
            </div>
            <div style={{marginTop:20,display:"flex",flexDirection:"column",gap:10}}>
              <Btn v="primary" s="md" style={{width:"100%"}} onClick={()=>onNav("S07")}>노드 상세 보기</Btn>
              <Btn v="secondary" s="md" style={{width:"100%"}} onClick={()=>onNav("S24")}>코멘트 보기</Btn>
              <Btn v="secondary" s="md" style={{width:"100%",color:TDS.danger}} onClick={()=>handleDelete(sel.id)}>노드 삭제</Btn>
            </div>
          </div>
        ); })()}
      </div>
    </div>
  );
}

/* S11 텍스트 영역 */
function S11({ onNav }) {
  const areas=[
    {id:"세특",t:"세부능력 및 특기사항",d:"교사가 작성하는 교과 세부능력 및 특기사항",chars:1240,st:"완료"},
    {id:"자율",t:"자율활동",d:"학교 자율활동 기록 영역",chars:856,st:"완료"},
    {id:"동아리",t:"동아리활동",d:"동아리 활동 기록",chars:932,st:"완료"},
    {id:"봉사",t:"봉사활동",d:"봉사활동 실적 및 특기사항",chars:0,st:"미작성"},
    {id:"진로",t:"진로활동",d:"진로 활동 기록 및 특기사항",chars:1108,st:"완료"},
    {id:"행특",t:"행동특성 및 종합의견",d:"담임교사의 행동특성 및 종합의견",chars:756,st:"완료"},
    {id:"독서",t:"독서활동",d:"독서 활동 상황",chars:0,st:"미작성"},
    {id:"수상",t:"수상경력",d:"수상 경력 기록",chars:324,st:"입력중"},
  ];
  const bType={완료:"green",미작성:"grey",입력중:"orange"};
  return (
    <div className="content">
      <div className="row-between mb24" style={{marginBottom:24}}>
        <div>
          <div className="sec-title">텍스트 영역</div>
          <div className="sec-sub">8가지 생기부 영역을 관리하세요</div>
        </div>
        <div className="row g-8" style={{gap:8}}>
          <Btn v="secondary" s="sm" onClick={()=>onNav("S13")}><TFI>📄</TFI> PDF 업로드</Btn>
          <Btn v="primary" s="sm">+ 직접 입력</Btn>
        </div>
      </div>
      <div className="grid3 g-16" style={{gap:16}}>
        {areas.map(a=>(
          <div key={a.id} className="area-card" onClick={()=>onNav("S12")}>
            <div className="row-between mb8" style={{marginBottom:8}}>
              <div className="area-card-title">{a.t}</div>
              <Badge t={bType[a.st]}>{a.st}</Badge>
            </div>
            <div className="area-card-desc">{a.d}</div>
            <Divider my={12} />
            <div className="row-between">
              <span style={{fontSize:13,color:TDS.textTertiary}}>{a.chars>0?`${a.chars.toLocaleString()}자`:"아직 입력 없음"}</span>
              <Btn v="secondary" s="sm" onClick={e=>{e.stopPropagation();onNav("S12");}}>편집</Btn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* S12 텍스트 편집 */
function S12({ onNav }) {
  const [txt, setTxt] = useState("물리학 시간에 양자역학의 기초 개념인 슈뢰딩거 방정식을 학습하면서 파동함수의 의미와 측정의 불확정성에 깊은 흥미를 느꼈다. 방과 후 자발적으로 관련 논문을 탐독하고 학급 물리 스터디를 조직하여 5명의 동료 학생들과 함께 주 2회 토론 학습을 진행하였다.");
  return (
    <div style={{display:"flex",height:"100%"}}>
      <div style={{flex:1,padding:28,overflowY:"auto",background:TDS.bgSecondary}}>
        <div className="row g-12 mb24" style={{gap:12,marginBottom:24}}>
          <button className="btn-inline" onClick={()=>onNav("S11")}>← 목록</button>
          <div>
            <div style={{fontSize:18,fontWeight:700,color:TDS.textPrimary}}>세부능력 및 특기사항</div>
            <div style={{fontSize:12,color:TDS.textTertiary}}>마지막 저장: 10분 전</div>
          </div>
        </div>
        <Notice type="info" className="mb16"><TFI>💡</TFI> 내용을 편집하면 관련 그래프 노드가 자동으로 업데이트됩니다.</Notice>
        <Card>
          <textarea className="textarea" style={{minHeight:300,fontSize:15,lineHeight:1.8}} value={txt} onChange={e=>setTxt(e.target.value)} />
          <div className="row-between mt16" style={{marginTop:14}}>
            <span style={{fontSize:13,color:TDS.textTertiary}}>{txt.length}자</span>
            <div className="row g-8" style={{gap:8}}>
              <Btn v="secondary" s="sm">초기화</Btn>
              <Btn v="primary" s="sm">저장 및 그래프 동기화</Btn>
            </div>
          </div>
        </Card>
      </div>
      <div style={{width:280,flexShrink:0,background:TDS.bgPrimary,borderLeft:`1px solid ${TDS.borderDefault}`,padding:20,overflowY:"auto"}}>
        <div style={{fontSize:14,fontWeight:700,color:TDS.textPrimary,marginBottom:16}}>연결된 노드</div>
        {["양자역학","슈뢰딩거 방정식","파동함수","물리학","토론 학습"].map(n=>(
          <div key={n} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:TDS.blue50,borderRadius:10,marginBottom:8,cursor:"pointer"}}>
            <TFI s={14} color={TDS.blue500}>🔵</TFI>
            <span style={{fontSize:13,color:TDS.blue500,fontWeight:600}}>{n}</span>
          </div>
        ))}
        <div style={{marginTop:16,padding:"10px 14px",background:"#fffbeb",borderRadius:10,fontSize:12,color:"#92400e",display:"flex",alignItems:"flex-start",gap:8,border:"1px solid #fde68a"}}>
          <TFI s={14} color="#f59e0b">💡</TFI>
          <span style={{lineHeight:1.5}}>저장 시 관련 노드가 자동으로 추출됩니다</span>
        </div>
      </div>
    </div>
  );
}

/* S15 음성 세션 */
function S15({ onNav }) {
  const sessions=[
    {id:1,t:"화학 세특 토론 녹음",date:"2026.05.10",dur:"1시간 23분",st:"완료",ppl:5},
    {id:2,t:"물리 실험 발표 준비",date:"2026.05.08",dur:"45분",st:"검토 대기",ppl:3},
    {id:3,t:"동아리 활동 회의",date:"2026.05.06",dur:"2시간 10분",st:"완료",ppl:8},
    {id:4,t:"진로 상담 녹음",date:"2026.05.03",dur:"32분",st:"완료",ppl:2},
  ];
  const stType={완료:"green","검토 대기":"orange"};
  return (
    <div className="content">
      <div className="row-between mb24" style={{marginBottom:24}}>
        <div><div className="sec-title">음성 활동 기록</div><div className="sec-sub">녹음 세션을 관리하고 STT 결과를 확인하세요</div></div>
        <Btn v="primary" onClick={()=>onNav("S16")}><TFI>🎙️</TFI> 새 녹음 시작</Btn>
      </div>
      {sessions.map(s=>(
        <div key={s.id} className="sess-card">
          <div className="sess-icon" style={{background:s.st==="검토 대기"?TDS.warningBg:TDS.blue50}}><TFI s={20} color={s.st==="검토 대기"?TDS.warning:TDS.blue500}>{s.st==="검토 대기"?"⏳":"🎙️"}</TFI></div>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:600,color:TDS.textPrimary,marginBottom:4}}>{s.t}</div>
            <div style={{fontSize:13,color:TDS.textTertiary}}>{s.date} · {s.dur} · 참여자 {s.ppl}명</div>
          </div>
          <Badge t={stType[s.st]||"grey"}>{s.st}</Badge>
          {s.st==="검토 대기"
            ?<Btn v="primary" s="sm" onClick={()=>onNav("S17")}>검토하기</Btn>
            :<Btn v="secondary" s="sm" onClick={()=>onNav("S17")}>보기</Btn>}
        </div>
      ))}
    </div>
  );
}

/* S16 녹음 중 */
function S16({ onNav }) {
  const [sec, setSec] = useState(347);
  useEffect(()=>{const t=setInterval(()=>setSec(s=>s+1),1000);return()=>clearInterval(t);},[]);
  const fmt2=s=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  return (
    <div className="content" style={{maxWidth:720,margin:"0 auto"}}>
      <Notice type="danger"><TFI>🔴</TFI> 녹음 중입니다. 종료하기 전에 저장하세요.</Notice>
      <Card className="mb24" style={{marginBottom:24,textAlign:"center"}}>
        <div style={{fontSize:13,color:TDS.textTertiary,marginBottom:8}}>녹음 중</div>
        <div style={{fontSize:56,fontWeight:800,color:TDS.danger,fontVariantNumeric:"tabular-nums",marginBottom:24}}>{fmt2(sec)}</div>
        <div className="row g-12" style={{gap:12,justifyContent:"center"}}>
          <Btn v="secondary" s="md">⏸️ 일시정지</Btn>
          <Btn v="danger" s="md" onClick={()=>onNav("S17")}>⏹️ 종료 및 저장</Btn>
        </div>
      </Card>
      <Card>
        <div style={{fontSize:16,fontWeight:700,marginBottom:16}}>STT 실시간 결과</div>
        <div style={{background:TDS.bgTertiary,borderRadius:10,padding:16,minHeight:180,fontSize:15,lineHeight:1.8,color:TDS.textSecondary}}>
          <span style={{color:TDS.textPrimary}}>오늘은 양자컴퓨팅의 기본 원리에 대해 이야기해 보겠습니다. 큐비트는 기존 비트와 달리 0과 1의 중첩 상태를 가질 수 있습니다...</span>
          <span style={{color:TDS.blue400}}> 이러한 특성 덕분에 양자컴퓨터는 특정 문제에서 고전 컴퓨터보다 훨씬 빠른 속도로 계산을 수행할 수 있습니다</span>
          <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
          <span style={{animation:"blink 1s infinite",color:TDS.blue500}}>█</span>
        </div>
      </Card>
    </div>
  );
}

/* S20 양식 템플릿 */
function S20({ onNav }) {
  const templates=[
    {id:1,t:"대학 자기소개서",cat:"입시",d:"학업 역량, 전공 선택 이유, 발전 가능성을 중심으로 작성",uses:1204},
    {id:2,t:"세특 요약 보고서",cat:"세특",d:"교과 학습 내용과 탐구 활동을 체계적으로 정리",uses:892},
    {id:3,t:"동아리 활동 보고서",cat:"동아리",d:"동아리 활동 내용과 본인의 역할을 서술",uses:567},
    {id:4,t:"진로 포트폴리오",cat:"진로",d:"진로 탐색 과정과 준비 현황을 종합",uses:423},
    {id:5,t:"독서 감상문",cat:"독서",d:"읽은 책의 핵심 내용과 본인의 생각을 연결",uses:345},
    {id:6,t:"봉사활동 에세이",cat:"봉사",d:"봉사 경험을 통한 성장을 서술",uses:289},
  ];
  return (
    <div className="content">
      <div className="row-between mb24" style={{marginBottom:24}}>
        <div><div className="sec-title">양식 템플릿</div><div className="sec-sub">나의 그래프 데이터를 기반으로 양식을 자동 생성합니다</div></div>
        <Btn v="secondary" s="sm" onClick={()=>onNav("S21")}>생성 이력 보기</Btn>
      </div>
      <div className="grid3 g-16" style={{gap:16}}>
        {templates.map(tmpl=>(
          <Card key={tmpl.id} style={{cursor:"pointer"}} onClick={()=>onNav("S22")}>
            <div className="row-between mb8" style={{marginBottom:10}}>
              <Badge t="blue" pill>{tmpl.cat}</Badge>
              <span style={{fontSize:12,color:TDS.textTertiary}}>사용 {tmpl.uses.toLocaleString()}회</span>
            </div>
            <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>{tmpl.t}</div>
            <div style={{fontSize:13,color:TDS.textTertiary,marginBottom:18,lineHeight:1.6}}>{tmpl.d}</div>
            <Btn v="primary" s="sm" style={{width:"100%"}}>이 템플릿으로 생성</Btn>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* S24 코멘트 */
/* 상대 시간 표시 (ms 타임스탬프 → "10분 전") */
function timeAgo(ts){
  if(!ts) return "";
  const s=Math.floor((Date.now()-ts)/1000);
  if(s<60) return "방금 전";
  if(s<3600) return `${Math.floor(s/60)}분 전`;
  if(s<86400) return `${Math.floor(s/3600)}시간 전`;
  if(s<172800) return "어제";
  return `${Math.floor(s/86400)}일 전`;
}

function S24({ onNav }) {
  const { state, actions } = useStore();
  const comments = state.comments;
  const [replyFor, setReplyFor] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [newText, setNewText] = useState("");

  useEffect(()=>{ if(!comments.length) actions.loadComments(); /* eslint-disable-next-line */ }, []);

  const sendReply = async (c) => {
    if(!replyText.trim()) return;
    await actions.postComment({ author:state.session?.user?.name||"나", type:c.type, target:c.target, content:replyText.trim(), replied:false });
    setReplyText(""); setReplyFor(null);
  };
  const addComment = async () => {
    if(!newText.trim()) return;
    await actions.postComment({ author:state.session?.user?.name||"나", type:"그래프", target:"전체 그래프", content:newText.trim(), replied:false });
    setNewText("");
  };
  const report = async (c) => { await actions.reportComment(c.id, "부적절한 내용"); };

  return (
    <div className="content"><div className="content-narrow">
      <div className="row-between mb16" style={{marginBottom:16}}>
        <div className="sec-title">코멘트 목록</div>
        <span style={{fontSize:13,color:TDS.textTertiary}}>{comments.length}개</span>
      </div>

      {/* 새 코멘트 작성 */}
      <Card className="mb16" style={{marginBottom:16}}>
        <div style={{display:"flex",gap:8}}>
          <input className="inp" style={{flex:1,height:40,fontSize:14}} placeholder="전체 그래프에 코멘트 남기기..." value={newText} onChange={e=>setNewText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addComment()} />
          <Btn v="primary" s="sm" onClick={addComment} disabled={!newText.trim()}>등록</Btn>
        </div>
      </Card>

      {!comments.length && <div style={{textAlign:"center",padding:"48px 0",color:TDS.textTertiary,fontSize:14}}>아직 코멘트가 없습니다</div>}

      {comments.map(c=>(
        <Card key={c.id} className="mb16" style={{marginBottom:16}}>
          <div className="row g-12 mb12" style={{gap:12,marginBottom:12,alignItems:"flex-start"}}>
            <Av name={(c.author||"?")[0]} size="md" />
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:15,fontWeight:700,color:TDS.textPrimary}}>{c.author}</div>
              <div style={{fontSize:12,color:TDS.textTertiary}}>{timeAgo(c.createdAt)} · <Badge t="blue">{c.type}</Badge> {c.target}</div>
            </div>
            {c.reports>0 && <Badge t="red">신고 {c.reports}</Badge>}
            {c.replied&&<Badge t="green">답글 완료</Badge>}
          </div>
          <div style={{fontSize:15,color:TDS.textSecondary,lineHeight:1.7,marginBottom:14}}>{c.content}</div>

          <div className="row g-8" style={{gap:8,alignItems:"center"}}>
            {replyFor===c.id ? (
              <>
                <input className="inp" style={{flex:1,height:40,fontSize:14}} placeholder="답글 작성..." value={replyText} onChange={e=>setReplyText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendReply(c)} autoFocus />
                <Btn v="primary" s="sm" onClick={()=>sendReply(c)}>답글</Btn>
                <Btn v="secondary" s="sm" onClick={()=>{setReplyFor(null);setReplyText("");}}>취소</Btn>
              </>
            ) : (
              <>
                <Btn v="secondary" s="sm" onClick={()=>{setReplyFor(c.id);setReplyText("");}}>답글 달기</Btn>
                <Btn v="secondary" s="sm" style={{color:TDS.danger}} onClick={()=>report(c)}>신고</Btn>
              </>
            )}
          </div>
        </Card>
      ))}

      <Notice type="info">신고한 코멘트는 관리자 신고 큐(A08)로 전달됩니다.</Notice>
    </div></div>
  );
}

/* S25 알림 */
function S25() {
  const seed=[
    {id:"n1",ic:"comment",t:"새 코멘트",d:"김선생님이 양자컴퓨팅 노드에 코멘트를 남겼습니다.",time:"10분 전",read:false},
    {id:"n2",ic:"text",t:"PDF 파싱 완료",d:"생기부 PDF 분석이 완료되었습니다. 결과를 확인하세요.",time:"1시간 전",read:false},
    {id:"n3",ic:"graph",t:"가지치기 추천",d:"8개의 새로운 노드 가지치기 추천이 있습니다.",time:"3시간 전",read:false},
    {id:"n4",ic:"form",t:"양식 생성 완료",d:"화학과 지원용 자소서가 생성되었습니다.",time:"어제",read:true},
    {id:"n5",ic:"bell",t:"시스템 공지",d:"2026년 2학기 생기부 제출 마감일 안내",time:"3일 전",read:true},
  ];
  const [items,setItems]=useState(seed);
  const [tab,setTab]=useState("전체");
  const unread=items.filter(n=>!n.read).length;
  const markAll=()=>setItems(p=>p.map(n=>({...n,read:true})));
  const markOne=id=>setItems(p=>p.map(n=>n.id===id?{...n,read:true}:n));
  const shown=items.filter(n=>tab==="전체"?true:tab==="안 읽음"?!n.read:n.read);

  return (
    <div className="content"><div className="content-narrow">
      <div className="row-between mb16" style={{marginBottom:16}}>
        <div className="row" style={{gap:10,alignItems:"center"}}>
          <div className="sec-title" style={{marginBottom:0}}>알림</div>
          {unread>0 && <span className="badge-num">{unread}</span>}
        </div>
        <Btn v="secondary" s="sm" onClick={markAll} disabled={!unread}>모두 읽음 처리</Btn>
      </div>

      <div className="tab-pill-wrap" style={{marginBottom:16}}>
        {[["전체",items.length],["안 읽음",unread],["읽음",items.length-unread]].map(([t,c])=>(
          <div key={t} className={`tab-pill${tab===t?" active":""}`} onClick={()=>setTab(t)}>{t} ({c})</div>
        ))}
      </div>

      {!shown.length && <div style={{textAlign:"center",padding:"48px 0",color:TDS.textTertiary,fontSize:14}}>알림이 없습니다</div>}

      {shown.map(n=>(
        <div key={n.id} onClick={()=>markOne(n.id)} style={{padding:"16px 18px",borderRadius:14,marginBottom:10,background:n.read?TDS.bgPrimary:TDS.blue50,border:`1px solid ${n.read?TDS.borderDefault:TDS.blue100}`,display:"flex",gap:14,cursor:"pointer",alignItems:"flex-start",transition:"background .15s",position:"relative"}}>
          {!n.read && <div style={{position:"absolute",left:6,top:22,width:7,height:7,borderRadius:"50%",background:TDS.blue500}} />}
          <div style={{width:38,height:38,borderRadius:10,background:n.read?TDS.bgTertiary:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginLeft:n.read?0:6}}>
            <NavIcon name={n.ic} size={20} color={n.read?TDS.textTertiary:TDS.blue500} />
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:15,fontWeight:n.read?500:700,color:TDS.textPrimary}}>{n.t}</div>
            <div style={{fontSize:13,color:TDS.textSecondary,marginTop:3,lineHeight:1.5}}>{n.d}</div>
          </div>
          <div style={{fontSize:12,color:TDS.textTertiary,flexShrink:0,whiteSpace:"nowrap"}}>{n.time}</div>
        </div>
      ))}
    </div></div>
  );
}

/* S27 통합 검색 */
function S27({ onNav }) {
  const [q, setQ] = useState(""); const [tab, setTab] = useState("전체");
  const results=[
    {type:"노드",ic:"🔵",t:"양자컴퓨팅",d:"물리학 > 양자역학 하위 노드 · 8개 연결",url:"S07"},
    {type:"텍스트",ic:"📄",t:"세부능력 및 특기사항",d:"1,240자 · 마지막 수정 3일 전",url:"S12"},
    {type:"음성",ic:"🎙️",t:"화학 세특 토론 녹음",d:"2026.05.10 · 1시간 23분",url:"S17"},
    {type:"코멘트",ic:"💬",t:"김선생님 코멘트",d:"양자컴퓨팅 노드 관련 · 10분 전",url:"S24"},
  ];
  return (
    <div className="content" style={{maxWidth:720,margin:"0 auto"}}>
      <div className="sec-title mb16" style={{marginBottom:16}}>통합 검색</div>
      <div className="search-wrap mb20" style={{marginBottom:20,height:52,fontSize:16}}>
        <span style={{fontSize:18}}><TFI s={18} color={TDS.textTertiary}>🔍</TFI></span>
        <input style={{fontSize:16}} placeholder="노드, 문서, 보고서, 코멘트 검색..." value={q} onChange={e=>setQ(e.target.value)} autoFocus />
      </div>
      <div className="tab-bar mb20" style={{marginBottom:20}}>
        {["전체","노드","텍스트","음성","코멘트"].map(t=>(
          <div key={t} className={`tab-item${tab===t?" active":""}`} onClick={()=>setTab(t)}>{t}</div>
        ))}
      </div>
      {results.filter(r=>tab==="전체"||r.type===tab).map((r,i)=>(
        <div key={i} className="list-row" style={{cursor:"pointer"}} onClick={()=>onNav(r.url)}>
          <div style={{fontSize:24}}><TFI s={24} color={TDS.textSecondary}>{r.ic}</TFI></div>
          <div className="list-row-left">
            <div className="list-row-title">{r.t}</div>
            <div className="list-row-sub">{r.d}</div>
          </div>
          <Badge t="grey">{r.type}</Badge>
        </div>
      ))}
    </div>
  );
}

/* S28 통계 */
function S28() {
  return (
    <div className="content">
      <div className="sec-title mb6" style={{marginBottom:6}}>나의 활동 통계</div>
      <div className="sec-sub">지난 30일간의 활동을 요약했어요</div>
      <div className="grid4 g-20 mb24" style={{gap:20,marginBottom:24}}>
        <StatCard label="총 노드" value="2,847개" sub="전월 대비 +12%" color={TDS.blue500} />
        <StatCard label="활동일" value="47일" sub="최근 30일 중" color={TDS.success} />
        <StatCard label="코멘트 수신" value="38개" sub="교사 3명" color={TDS.warning} />
        <StatCard label="양식 생성" value="6개" sub="자소서 3, 보고서 3" color={TDS.textPrimary} />
      </div>
      <div className="grid2 g-20" style={{gap:20}}>
        <Card>
          <div className="card-title mb16" style={{marginBottom:16}}>영역별 완성도</div>
          {[["세특",95],["자율",80],["동아리",88],["봉사",0],["진로",92],["행특",75],["독서",0],["수상",45]].map(([nm,pct])=>(
            <div key={nm} style={{marginBottom:12}}>
              <div className="row-between mb4" style={{marginBottom:4,fontSize:13}}>
                <span style={{color:TDS.textSecondary}}>{nm}</span>
                <span style={{fontWeight:600,color:pct>0?TDS.blue500:TDS.textDisabled}}>{pct}%</span>
              </div>
              <div className="prog-wrap">
                <div className="prog-fill" style={{width:`${pct}%`,background:pct>0?TDS.blue500:TDS.bgTertiary}} />
              </div>
            </div>
          ))}
        </Card>
        <Card>
          <div className="card-title mb16" style={{marginBottom:16}}>노드 분포</div>
          {[["물리학",420],["화학",380],["수학",310],["영어",280],["인공지능",240],["기타",1217]].map(([nm,cnt])=>(
            <div key={nm} className="row g-12 mb12" style={{gap:12,marginBottom:12,alignItems:"center"}}>
              <span style={{fontSize:13,width:70,color:TDS.textSecondary}}>{nm}</span>
              <div style={{flex:1,height:8,background:TDS.bgTertiary,borderRadius:4,overflow:"hidden"}}>
                <div style={{height:8,background:TDS.blue500,borderRadius:4,width:`${(cnt/1217)*100}%`,opacity:.85}} />
              </div>
              <span style={{fontSize:12,color:TDS.textTertiary,width:44,textAlign:"right"}}>{cnt.toLocaleString()}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

/* S30 설정 */
function S30({ onNav }) {
  const [notifs, setNotifs] = useState({ comment:true, system:true, weekly:false, push:true });
  const [activeTab, setActiveTab] = useState("계정");
  const tabs = ["계정","알림","보안","데이터"];
  const toggle = k => setNotifs(p=>({...p,[k]:!p[k]}));

  const Toggle = ({on, onClick}) => (
    <div onClick={onClick} style={{width:44,height:26,borderRadius:13,background:on?TDS.blue500:TDS.bgTertiary,position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0}}>
      <div style={{width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:on?21:3,transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.2)"}} />
    </div>
  );

  return (
    <div className="content">
      <div className="content-wide">
        {/* 헤더 — 프로필 요약 */}
        <div className="card card-p" style={{marginBottom:20,display:"flex",alignItems:"center",gap:20}}>
          <div style={{width:72,height:72,borderRadius:"50%",background:TDS.blue500,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:30,fontWeight:700,flexShrink:0}}>홍</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:20,fontWeight:700,color:TDS.textPrimary}}>홍길동</div>
            <div style={{fontSize:14,color:TDS.textTertiary,marginTop:2}}>hong@school.ac.kr</div>
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <div style={{padding:"3px 10px",borderRadius:20,background:TDS.blue50,color:TDS.blue500,fontSize:11,fontWeight:600}}>학생</div>
              <div style={{padding:"3px 10px",borderRadius:20,background:TDS.successBg,color:TDS.success,fontSize:11,fontWeight:600}}>활성</div>
            </div>
          </div>
          <Btn v="secondary" s="sm" onClick={()=>onNav("S31")}>프로필 편집</Btn>
        </div>

        {/* 탭 바 */}
        <div className="tab-pill-wrap" style={{marginBottom:20}}>
          {tabs.map(t=><div key={t} className={`tab-pill${activeTab===t?" active":""}`} onClick={()=>setActiveTab(t)}>{t}</div>)}
        </div>

        {/* 계정 탭 */}
        {activeTab==="계정" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {/* 내 정보 */}
            <div className="card card-p">
              <div style={{fontSize:14,fontWeight:700,color:TDS.textPrimary,marginBottom:16}}>기본 정보</div>
              {[
                ["이름","홍길동"],["이메일","hong@school.ac.kr"],
                ["역할","학생"],["가입일","2026-01-01"],
                ["OAuth 제공자","Google"],["마지막 로그인","2026-01-20 14:32"],
              ].map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:`1px solid ${TDS.bgTertiary}`}}>
                  <span style={{fontSize:14,color:TDS.textTertiary,minWidth:120}}>{k}</span>
                  <span style={{fontSize:14,color:TDS.textPrimary,fontWeight:500}}>{v}</span>
                </div>
              ))}
            </div>

            {/* 빠른 메뉴 */}
            <div className="card card-p">
              <div style={{fontSize:14,fontWeight:700,marginBottom:12}}>빠른 이동</div>
              <div className="grid2" style={{gap:8}}>
                {[
                  {ic:"📊",t:"활동 통계",s:"S28"},{ic:"📤",t:"데이터 내보내기",s:"S29"},
                  {ic:"💬",t:"코멘트 목록",s:"S24"},{ic:"🔔",t:"알림 목록",s:"S25"},
                ].map(item=>(
                  <div key={item.t} onClick={()=>onNav(item.s)} style={{display:"flex",alignItems:"center",gap:10,padding:"12px",borderRadius:10,background:TDS.bgSecondary,cursor:"pointer",border:`1px solid ${TDS.borderDefault}`,transition:"all .14s"}}>
                    <TFI s={18} color={TDS.textSecondary}>{item.ic}</TFI>
                    <span style={{fontSize:13,fontWeight:600,color:TDS.textSecondary}}>{item.t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 알림 탭 */}
        {activeTab==="알림" && (
          <div className="card card-p">
            <div style={{fontSize:14,fontWeight:700,marginBottom:16}}>알림 설정</div>
            {[
              {k:"comment",label:"코멘트 알림",desc:"교사가 코멘트를 남겼을 때"},
              {k:"system",label:"시스템 공지",desc:"서비스 공지 및 점검 안내"},
              {k:"weekly",label:"주간 리포트",desc:"매주 월요일 활동 요약 이메일"},
              {k:"push",label:"푸시 알림",desc:"브라우저 푸시 알림 허용"},
            ].map(n=>(
              <div key={n.k} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 0",borderBottom:`1px solid ${TDS.bgTertiary}`}}>
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:TDS.textPrimary,marginBottom:2}}>{n.label}</div>
                  <div style={{fontSize:12,color:TDS.textTertiary}}>{n.desc}</div>
                </div>
                <Toggle on={notifs[n.k]} onClick={()=>toggle(n.k)} />
              </div>
            ))}
            <Notice type="info" style={{marginTop:16}}>알림 설정은 즉시 적용됩니다.</Notice>
          </div>
        )}

        {/* 보안 탭 */}
        {activeTab==="보안" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div className="card card-p">
              <div style={{fontSize:14,fontWeight:700,marginBottom:16}}>로그인 기기</div>
              {[
                {os:"macOS Chrome",ip:"211.xxx.xxx.xxx",time:"현재 세션",cur:true},
                {os:"iOS Safari",ip:"211.xxx.xxx.xxx",time:"2일 전",cur:false},
                {os:"Windows Edge",ip:"61.xxx.xxx.xxx",time:"7일 전",cur:false},
              ].map((d,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:i<2?`1px solid ${TDS.bgTertiary}`:"none"}}>
                  <div style={{width:38,height:38,borderRadius:10,background:TDS.bgSecondary,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}><TFI s={18} color={TDS.textSecondary}>{d.os.includes("iOS")?"📱":"💻"}</TFI></div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600,display:"flex",alignItems:"center",gap:6}}>{d.os}{d.cur&&<span style={{padding:"2px 8px",borderRadius:10,background:TDS.successBg,color:TDS.success,fontSize:10,fontWeight:700}}>현재</span>}</div>
                    <div style={{fontSize:12,color:TDS.textTertiary}}>{d.ip} · {d.time}</div>
                  </div>
                  {!d.cur&&<Btn v="ghost" s="sm" style={{color:TDS.danger}}>로그아웃</Btn>}
                </div>
              ))}
            </div>
            <div className="card card-p">
              <div style={{fontSize:14,fontWeight:700,marginBottom:12}}>세션 관리</div>
              <div style={{fontSize:13,color:TDS.textTertiary,marginBottom:16}}>다른 모든 기기에서 로그아웃됩니다.</div>
              <Btn v="secondary" s="sm">다른 기기 모두 로그아웃</Btn>
            </div>
          </div>
        )}

        {/* 데이터 탭 */}
        {activeTab==="데이터" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div className="card card-p">
              <div style={{fontSize:14,fontWeight:700,marginBottom:16}}>데이터 관리</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <div onClick={()=>onNav("S29")} style={{display:"flex",alignItems:"center",gap:12,padding:"14px",borderRadius:10,border:`1px solid ${TDS.borderDefault}`,cursor:"pointer",background:TDS.bgSecondary}}>
                  <TFI s={22} color={TDS.textSecondary}>📤</TFI>
                  <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14}}>데이터 내보내기</div><div style={{fontSize:12,color:TDS.textTertiary}}>그래프·텍스트·음성 전체 다운로드</div></div>
                  <span style={{color:TDS.textTertiary}}>›</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px",borderRadius:10,border:`1px solid ${TDS.borderDefault}`,cursor:"pointer",background:TDS.bgSecondary}}>
                  <TFI s={22} color={TDS.textSecondary}>📊</TFI>
                  <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14}}>저장 공간 사용량</div><div style={{fontSize:12,color:TDS.textTertiary}}>2.4 GB / 10 GB 사용 중</div></div>
                  <div style={{width:80,height:6,background:TDS.bgTertiary,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:"24%",background:TDS.blue500,borderRadius:3}} /></div>
                </div>
              </div>
            </div>
            {/* 위험 구역 */}
            <div className="card card-p" style={{border:`1px solid ${TDS.danger}30`}}>
              <div style={{fontSize:14,fontWeight:700,color:TDS.danger,marginBottom:12}}>위험 구역</div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px",background:TDS.dangerBg,borderRadius:10}}>
                <div>
                  <div style={{fontWeight:600,fontSize:14,color:TDS.textPrimary}}>계정 삭제</div>
                  <div style={{fontSize:12,color:TDS.textTertiary}}>30일 유예 후 모든 데이터 완전 삭제</div>
                </div>
                <Btn v="danger" s="sm" onClick={()=>onNav("S32")}>계정 삭제</Btn>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   ── STUDENT SCREENS (미구현 분) ──
────────────────────────────────────────────────────────────── */

/* S07 노드 상세 */
function S07({ onNav }) {
  const [tab, setTab] = useState("정보");
  const node = { id:"node-001", label:"양자컴퓨팅", type:"개념", weight:0.92, desc:"양자역학 원리를 이용해 정보를 처리하는 컴퓨팅 패러다임.", edges:["큐비트","양자 알고리즘","얽힘","중첩"], docs:["세특 물리학","세특 화학"], created:"2026-01-10" };
  return (
    <div className="content" style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("S06")}>← 그래프</button>
        <div style={{width:40,height:40,borderRadius:"50%",background:TDS.blue500,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:14}}>개념</div>
        <div>
          <div style={{fontSize:20,fontWeight:700,color:TDS.textPrimary}}>{node.label}</div>
          <div style={{fontSize:12,color:TDS.textTertiary}}>가중치 {node.weight} · {node.created} 생성</div>
        </div>
      </div>
      <div className="tab-pill-wrap" style={{marginBottom:20}}>
        {["정보","연결 엣지","관련 문서","코멘트"].map(t=><div key={t} className={`tab-pill${tab===t?" active":""}`} onClick={()=>setTab(t)}>{t}</div>)}
      </div>
      {tab==="정보" && (
        <div className="card card-p">
          <div className="inp-group"><label className="inp-label">노드 설명</label><textarea className="inp" rows={3} defaultValue={node.desc} /></div>
          <div className="inp-group"><label className="inp-label">노드 타입</label>
            <select className="inp"><option>개념</option><option>사건</option><option>인물</option><option>장소</option></select>
          </div>
          <div style={{display:"flex",gap:8,marginTop:16}}>
            <Btn v="secondary" s="sm" fw onClick={()=>onNav("S10")}>변경 이력</Btn>
            <Btn v="primary" s="sm" fw>저장</Btn>
          </div>
        </div>
      )}
      {tab==="연결 엣지" && (
        <div className="card card-p">
          {node.edges.map(e=>(
            <div key={e} className="list-row" style={{cursor:"pointer"}} onClick={()=>onNav("S08")}>
              <div style={{width:8,height:8,borderRadius:"50%",background:TDS.blue500,marginTop:6}} />
              <div className="list-row-left"><div className="list-row-title">{e}</div><div className="list-row-sub">관계: 하위 개념</div></div>
              <span style={{color:TDS.textTertiary}}>›</span>
            </div>
          ))}
          <Btn v="ghost" s="sm" style={{marginTop:12}} onClick={()=>onNav("S09")}>+ 연결 추가</Btn>
        </div>
      )}
      {tab==="관련 문서" && (
        <div className="card card-p">
          {node.docs.map(d=>(
            <div key={d} className="list-row" style={{cursor:"pointer"}} onClick={()=>onNav("S12")}>
              <TFI s={20} color={TDS.textSecondary}>📄</TFI>
              <div className="list-row-left"><div className="list-row-title">{d}</div></div>
              <span style={{color:TDS.textTertiary}}>›</span>
            </div>
          ))}
        </div>
      )}
      {tab==="코멘트" && <div className="card card-p"><div className="empty"><TFI s={36} color={TDS.textDisabled}>💬</TFI><div className="empty-title">코멘트 없음</div><div className="empty-sub">교사의 코멘트가 표시됩니다</div></div></div>}
    </div>
  );
}

/* S08 엣지 상세 */
function S08({ onNav }) {
  return (
    <div className="content" style={{maxWidth:640,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("S06")}>← 그래프</button>
        <div style={{fontSize:20,fontWeight:700}}>엣지 상세</div>
      </div>
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:16,padding:"12px 0",borderBottom:`1px solid ${TDS.borderDefault}`,marginBottom:16}}>
          <div style={{flex:1,padding:"10px 16px",background:TDS.blue50,borderRadius:10,textAlign:"center",fontWeight:700,color:TDS.blue500}}>양자컴퓨팅</div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <div style={{width:60,height:2,background:TDS.blue500}} />
            <div style={{fontSize:11,color:TDS.textTertiary,fontWeight:600}}>하위 개념</div>
          </div>
          <div style={{flex:1,padding:"10px 16px",background:TDS.successBg,borderRadius:10,textAlign:"center",fontWeight:700,color:TDS.success}}>큐비트</div>
        </div>
        <div className="inp-group"><label className="inp-label">관계 타입</label>
          <select className="inp"><option>하위 개념</option><option>상위 개념</option><option>관련</option><option>참조</option><option>대립</option></select>
        </div>
        <div className="inp-group"><label className="inp-label">가중치</label><input className="inp" type="number" min="0" max="1" step="0.01" defaultValue="0.85" /></div>
        <div className="inp-group"><label className="inp-label">메모</label><textarea className="inp" rows={2} placeholder="이 연결에 대한 메모..." /></div>
        <div style={{display:"flex",gap:8,marginTop:16}}>
          <Btn v="danger" s="sm">엣지 삭제</Btn>
          <div style={{flex:1}} />
          <Btn v="primary" s="sm">저장</Btn>
        </div>
      </div>
      <div className="card card-p">
        <div className="card-title" style={{marginBottom:12}}>엣지 생성 이력</div>
        {[["자동 생성 (ML)","2026-01-10"],["가중치 수정","2026-01-15"]].map(([a,d])=>(
          <div key={d} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${TDS.bgTertiary}`,fontSize:13}}>
            <span style={{color:TDS.textSecondary}}>{a}</span>
            <span style={{color:TDS.textTertiary}}>{d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* S09 시드 추가 */
function S09({ onNav }) {
  const { actions } = useStore();
  const [kws, setKws] = useState([]);
  const [inp, setInp] = useState("");
  const [busy, setBusy] = useState(false);
  const addKw = () => { const v=inp.trim(); if(v&&!kws.includes(v)&&kws.length<20){ setKws([...kws,v]); setInp(""); }};
  const generate = async () => {
    if(!kws.length) return;
    setBusy(true);
    try { await actions.generateGraph(kws); onNav("S06"); }
    finally { setBusy(false); }
  };
  return (
    <div className="content" style={{maxWidth:540,margin:"0 auto"}}>
      <div style={{fontSize:22,fontWeight:700,marginBottom:6}}>시드 키워드 추가</div>
      <div style={{fontSize:14,color:TDS.textTertiary,marginBottom:24}}>새로운 키워드를 추가하여 그래프를 확장합니다 ({kws.length}/20)</div>
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          <input className="inp" style={{flex:1}} placeholder="키워드 입력..." value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addKw()} disabled={busy} />
          <Btn v="primary" s="sm" onClick={addKw} disabled={busy}>추가</Btn>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {kws.map(k=>(
            <div key={k} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",background:TDS.blue50,borderRadius:20,fontSize:13,color:TDS.blue500,fontWeight:500}}>
              {k}<span style={{cursor:"pointer",opacity:.7}} onClick={()=>!busy&&setKws(kws.filter(x=>x!==k))}>×</span>
            </div>
          ))}
          {!kws.length&&<div style={{color:TDS.textDisabled,fontSize:13}}>추가한 키워드가 없습니다</div>}
        </div>
      </div>
      <Notice type="info">ML이 키워드를 분석하여 관련 노드와 관계를 자동으로 추천합니다.</Notice>
      <div style={{display:"flex",gap:8,marginTop:20}}>
        <Btn v="secondary" s="md" fw onClick={()=>onNav("S06")} disabled={busy}>취소</Btn>
        <Btn v="primary" s="md" fw disabled={!kws.length||busy} onClick={generate} style={busy?{opacity:.7,cursor:"not-allowed"}:undefined}>{busy?"생성 중…":`그래프 생성 (${kws.length}개)`}</Btn>
      </div>
    </div>
  );
}

/* S10 그래프 변경 이력 */
function S10({ onNav }) {
  const logs=[
    {icon:"🟢",t:"노드 생성",d:'"양자컴퓨팅" 노드 자동 생성 (ML)',time:"2026-01-20 14:32"},
    {icon:"🔵",t:"엣지 추가",d:"양자컴퓨팅 → 큐비트 연결 생성",time:"2026-01-20 14:32"},
    {icon:"✏️",t:"노드 수정",d:'"물리학" 가중치 0.80 → 0.92',time:"2026-01-18 10:15"},
    {icon:"🗑️",t:"노드 삭제",d:'"쇼어 알고리즘" 거부 (가지치기)',time:"2026-01-17 16:44"},
    {icon:"📄",t:"PDF 파싱",d:"학교생활기록부.pdf 노드 12개 생성",time:"2026-01-15 09:20"},
    {icon:"🎙️",t:"음성 반영",d:"물리 토론 녹음 노드 5개 반영",time:"2026-01-12 11:00"},
  ];
  return (
    <div className="content" style={{maxWidth:700,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("S06")}>← 그래프</button>
        <div style={{fontSize:20,fontWeight:700}}>그래프 변경 이력</div>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {["전체","노드","엣지","ML","수동"].map(f=><Btn key={f} v={f==="전체"?"primary":"secondary"} s="sm">{f}</Btn>)}
      </div>
      <div className="card card-p">
        {logs.map((l,i)=>(
          <div key={i} style={{display:"flex",gap:14,padding:"12px 0",borderBottom:i<logs.length-1?`1px solid ${TDS.bgTertiary}`:"none"}}>
            <div style={{fontSize:20,flexShrink:0,marginTop:2}}><TFI s={20} color={TDS.textSecondary}>{l.icon}</TFI></div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14,color:TDS.textPrimary,marginBottom:3}}>{l.t}</div>
              <div style={{fontSize:13,color:TDS.textSecondary}}>{l.d}</div>
            </div>
            <div style={{fontSize:11,color:TDS.textDisabled,flexShrink:0,textAlign:"right",lineHeight:1.4}}>{l.time.split(" ")[0]}<br/>{l.time.split(" ")[1]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* S13 PDF 업로드 */
function S13({ onNav }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const handleUpload = () => {
    if(!file) return;
    setUploading(true);
    setTimeout(()=>{ setUploading(false); onNav("S14"); }, 1800);
  };
  return (
    <div className="content" style={{maxWidth:560,margin:"0 auto"}}>
      <div style={{fontSize:22,fontWeight:700,marginBottom:6}}>PDF 업로드</div>
      <div style={{fontSize:14,color:TDS.textTertiary,marginBottom:24}}>생활기록부 PDF를 업로드하면 자동으로 텍스트를 추출합니다</div>
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{border:`2px dashed ${file?TDS.blue500:TDS.borderDefault}`,borderRadius:12,padding:"40px 24px",textAlign:"center",background:file?TDS.blue50:"transparent",transition:"all .2s",cursor:"pointer"}} onClick={()=>document.getElementById("pdf-inp").click()}>
          <TFI s={48}>{file?"📄":"📤"}</TFI>
          <div style={{fontSize:15,fontWeight:600,color:file?TDS.blue500:TDS.textSecondary,marginTop:12}}>{file?file.name:"파일을 선택하거나 여기로 드래그하세요"}</div>
          <div style={{fontSize:12,color:TDS.textTertiary,marginTop:6}}>{file?`${(file.size/1024/1024).toFixed(2)} MB`:"PDF 파일 · 최대 50 MB"}</div>
        </div>
        <input id="pdf-inp" type="file" accept=".pdf" style={{display:"none"}} onChange={e=>setFile(e.target.files[0])} />
        {file && <div style={{marginTop:16,padding:"12px",background:TDS.successBg,borderRadius:8,fontSize:13,color:TDS.success,display:"flex",alignItems:"center",gap:8}}><TFI>✅</TFI>파일이 선택되었습니다</div>}
      </div>
      <Notice type="info" style={{marginBottom:20}}>업로드 후 파싱이 완료되면 알림으로 안내합니다. 평균 1~3분 소요.</Notice>
      <Btn v="primary" s="lg" fw disabled={!file||uploading} onClick={handleUpload}>
        {uploading?"업로드 중...":"업로드 시작"}
      </Btn>
    </div>
  );
}

/* S14 PDF 파싱 결과 검토 */
function S14({ onNav }) {
  const [sel, setSel] = useState(new Set([0,1,2,3]));
  const nodes=[
    {id:0,label:"양자역학",type:"개념",src:"세특 물리학 1p"},
    {id:1,label:"슈뢰딩거 방정식",type:"수식",src:"세특 물리학 2p"},
    {id:2,label:"전자기유도",type:"개념",src:"세특 물리학 3p"},
    {id:3,label:"광전효과",type:"개념",src:"세특 물리학 3p"},
    {id:4,label:"맥스웰",type:"인물",src:"세특 물리학 4p"},
  ];
  const toggle = id => { const s=new Set(sel); s.has(id)?s.delete(id):s.add(id); setSel(s); };
  return (
    <div className="content" style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{fontSize:22,fontWeight:700,marginBottom:6}}>PDF 파싱 결과 검토</div>
      <div style={{fontSize:14,color:TDS.textTertiary,marginBottom:20}}>파싱된 노드 {nodes.length}개를 확인하고 반영할 항목을 선택하세요</div>
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:600,color:TDS.textPrimary}}>{sel.size}/{nodes.length}개 선택</div>
          <div style={{display:"flex",gap:8}}>
            <Btn v="ghost" s="sm" onClick={()=>setSel(new Set(nodes.map(n=>n.id)))}>전체 선택</Btn>
            <Btn v="ghost" s="sm" onClick={()=>setSel(new Set())}>전체 해제</Btn>
          </div>
        </div>
        {nodes.map(n=>(
          <div key={n.id} onClick={()=>toggle(n.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:8,marginBottom:6,background:sel.has(n.id)?TDS.blue50:TDS.bgSecondary,border:`1px solid ${sel.has(n.id)?TDS.blue500:TDS.borderDefault}`,cursor:"pointer",transition:"all .15s"}}>
            <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${sel.has(n.id)?TDS.blue500:TDS.borderDefault}`,background:sel.has(n.id)?TDS.blue500:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {sel.has(n.id)&&<div style={{width:8,height:6,borderLeft:"2px solid #fff",borderBottom:"2px solid #fff",transform:"rotate(-45deg)",marginTop:-2}} />}
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14,color:TDS.textPrimary}}>{n.label}</div>
              <div style={{fontSize:11,color:TDS.textTertiary}}>{n.type} · {n.src}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:8}}>
        <Btn v="secondary" s="md" fw onClick={()=>onNav("S11")}>취소</Btn>
        <Btn v="primary" s="md" fw disabled={!sel.size} onClick={()=>onNav("S06")}>선택한 {sel.size}개 그래프에 반영</Btn>
      </div>
    </div>
  );
}

/* S17 보고서 검토·승인 */
function S17({ onNav }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("오늘 물리 토론에서 양자역학의 기초 개념에 대해 토론했습니다. 슈뢰딩거 방정식의 의미와 물리적 해석에 대해 논의하고, 코펜하겐 해석과 다세계 해석을 비교했습니다. 특히 관측 문제와 파동 함수의 붕괴에 관한 심층 토론이 이뤄졌습니다.");
  return (
    <div className="content" style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("S15")}>← 목록</button>
        <div style={{fontSize:20,fontWeight:700}}>보고서 검토·승인</div>
      </div>
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:700,color:TDS.textPrimary}}>음성 전사 결과</div>
          <Btn v="ghost" s="sm" onClick={()=>setEditing(!editing)}>{editing?"완료":"편집"}</Btn>
        </div>
        {editing
          ? <textarea className="inp" rows={6} value={text} onChange={e=>setText(e.target.value)} />
          : <div style={{fontSize:14,color:TDS.textSecondary,lineHeight:1.7,padding:"12px",background:TDS.bgSecondary,borderRadius:8}}>{text}</div>
        }
      </div>
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:10}}>추출된 키워드</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {["양자역학","슈뢰딩거 방정식","코펜하겐 해석","다세계 해석","파동 함수 붕괴","관측 문제"].map(k=>(
            <div key={k} style={{padding:"5px 12px",background:TDS.blue50,borderRadius:20,fontSize:13,color:TDS.blue500,fontWeight:500}}>{k}</div>
          ))}
        </div>
      </div>
      <div style={{display:"flex",gap:8}}>
        <Btn v="secondary" s="md" fw onClick={()=>onNav("S15")}>나중에 확인</Btn>
        <Btn v="primary" s="md" fw onClick={()=>onNav("S19")}>매칭 제안 받기</Btn>
      </div>
    </div>
  );
}

/* S18 참여자 관리 */
function S18({ onNav }) {
  const [participants,setParticipants]=useState([
    {name:"홍길동",role:"호스트",status:"참여 중"},
    {name:"이지은",role:"참여자",status:"참여 중"},
    {name:"김철수",role:"참여자",status:"초대됨"},
  ]);
  return (
    <div className="content" style={{maxWidth:560,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("S15")}>← 목록</button>
        <div style={{fontSize:20,fontWeight:700}}>참여자 관리</div>
      </div>
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>참여자 ({participants.length}명)</div>
        {participants.map((p,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:i<participants.length-1?`1px solid ${TDS.bgTertiary}`:"none"}}>
            <Av name={p.name[0]} size="sm" />
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14}}>{p.name}</div>
              <div style={{fontSize:12,color:TDS.textTertiary}}>{p.role}</div>
            </div>
            <div style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:p.status==="참여 중"?TDS.successBg:TDS.warningBg,color:p.status==="참여 중"?TDS.success:TDS.warning}}>{p.status}</div>
            {p.role!=="호스트"&&<button style={{background:"none",border:"none",color:TDS.textTertiary,cursor:"pointer",fontSize:18}} onClick={()=>setParticipants(participants.filter((_,j)=>j!==i))}>✕</button>}
          </div>
        ))}
      </div>
      <div className="card card-p">
        <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>참여자 초대</div>
        <div style={{display:"flex",gap:8}}>
          <input className="inp" style={{flex:1}} placeholder="이름 또는 학번 검색..." />
          <Btn v="primary" s="sm">초대</Btn>
        </div>
      </div>
    </div>
  );
}

/* S19 그래프 매칭 제안 */
function S19({ onNav }) {
  const [decisions, setDecisions] = useState({});
  const proposals=[
    {id:0,from:"보고서",node:"양자역학",rel:"관련",score:0.95},
    {id:1,from:"보고서",node:"슈뢰딩거 방정식",rel:"하위 개념",score:0.91},
    {id:2,from:"보고서",node:"코펜하겐 해석",rel:"이론",score:0.88},
    {id:3,from:"보고서",node:"다세계 해석",rel:"이론",score:0.82},
    {id:4,from:"보고서",node:"파동 함수 붕괴",rel:"관련",score:0.79},
  ];
  const decide=(id,v)=>setDecisions({...decisions,[id]:v});
  const pending = proposals.filter(p=>!decisions[p.id]);
  return (
    <div className="content" style={{maxWidth:700,margin:"0 auto"}}>
      <div style={{fontSize:22,fontWeight:700,marginBottom:6}}>그래프 매칭 제안</div>
      <div style={{fontSize:14,color:TDS.textTertiary,marginBottom:20}}>ML이 분석한 {proposals.length}개 제안 · 미결정 {pending.length}개</div>
      <div className="card card-p" style={{marginBottom:16}}>
        {proposals.map((p,i)=>(
          <div key={p.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:i<proposals.length-1?`1px solid ${TDS.bgTertiary}`:"none",opacity:decisions[p.id]?0.5:1}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <div style={{fontWeight:600,fontSize:14}}>{p.node}</div>
                <div style={{padding:"2px 8px",background:TDS.bgTertiary,borderRadius:10,fontSize:11,color:TDS.textTertiary}}>{p.rel}</div>
                <div style={{fontSize:11,color:TDS.textTertiary,marginLeft:"auto"}}>신뢰도 {Math.round(p.score*100)}%</div>
              </div>
              <div style={{fontSize:11,color:TDS.textTertiary}}>{p.from} → 그래프 노드</div>
            </div>
            {decisions[p.id]
              ? <div style={{padding:"4px 12px",borderRadius:20,fontSize:12,fontWeight:600,background:decisions[p.id]==="accept"?TDS.successBg:TDS.dangerBg,color:decisions[p.id]==="accept"?TDS.success:TDS.danger}}>{decisions[p.id]==="accept"?"채택":"거부"}</div>
              : <div style={{display:"flex",gap:6}}>
                  <Btn v="primary" s="sm" onClick={()=>decide(p.id,"accept")}>채택</Btn>
                  <Btn v="danger" s="sm" onClick={()=>decide(p.id,"reject")}>거부</Btn>
                </div>
            }
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:8}}>
        <Btn v="secondary" s="md" fw onClick={()=>onNav("S17")}>이전</Btn>
        <Btn v="primary" s="md" fw onClick={()=>onNav("S06")}>그래프에 반영</Btn>
      </div>
    </div>
  );
}

/* S21 양식 결과물 목록 */
function S21({ onNav }) {
  const items=[
    {id:0,title:"화학과 지원 자기소개서",tpl:"자기소개서 A",created:"2026-01-20",status:"완료"},
    {id:1,title:"물리학 세특 보고서",tpl:"세특 요약",created:"2026-01-15",status:"완료"},
    {id:2,title:"대학원 진학 계획서",tpl:"진학 계획 A",created:"2026-01-10",status:"완료"},
  ];
  return (
    <div className="content" style={{maxWidth:700,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontSize:20,fontWeight:700}}>양식 결과물 목록</div>
        <Btn v="primary" s="sm" onClick={()=>onNav("S20")}>+ 새로 생성</Btn>
      </div>
      {items.length===0
        ? <div className="empty"><TFI s={48}>📄</TFI><div className="empty-title">생성한 양식이 없습니다</div><Btn v="primary" s="md" onClick={()=>onNav("S20")}>템플릿 선택</Btn></div>
        : <div className="card card-p">
          {items.map((it,i)=>(
            <div key={it.id} className="list-row" style={{cursor:"pointer",borderBottom:i<items.length-1?`1px solid ${TDS.bgTertiary}`:"none"}} onClick={()=>onNav("S22")}>
              <TFI s={24} color={TDS.blue500}>📝</TFI>
              <div className="list-row-left">
                <div className="list-row-title">{it.title}</div>
                <div className="list-row-sub">{it.tpl} · {it.created}</div>
              </div>
              <div style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:TDS.successBg,color:TDS.success}}>{it.status}</div>
              <span style={{color:TDS.textTertiary}}>›</span>
            </div>
          ))}
        </div>
      }
    </div>
  );
}

/* S22 양식 결과물 상세 */
function S22({ onNav }) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(`저는 물리학과 화학에 깊은 관심을 가지고 있으며, 특히 양자역학 분야에서 독창적인 연구를 수행하고자 합니다.

고등학교 시절 양자역학 스터디를 직접 조직하여 슈뢰딩거 방정식의 의미를 탐구했습니다. 코펜하겐 해석과 다세계 해석을 비교 분석하면서 물리학적 사고를 심화시켰습니다.

이러한 경험을 바탕으로 귀 대학 화학과에서 양자화학 분야를 전공하여 미래 신소재 개발에 기여하고자 합니다.`);
  const usedNodes=["양자역학","슈뢰딩거 방정식","코펜하겐 해석","다세계 해석","물리학"];
  return (
    <div className="content" style={{maxWidth:760,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("S21")}>← 목록</button>
        <div style={{flex:1,fontSize:20,fontWeight:700}}>화학과 지원 자기소개서</div>
        <Btn v="ghost" s="sm" onClick={()=>setEditing(!editing)}>{editing?"저장":"편집"}</Btn>
        <Btn v="secondary" s="sm" onClick={()=>onNav("S29")}>내보내기</Btn>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:16}}>
        <div className="card card-p">
          {editing
            ? <textarea className="inp" rows={14} value={content} onChange={e=>setContent(e.target.value)} style={{fontFamily:"inherit",lineHeight:1.8}} />
            : <div style={{fontSize:14,color:TDS.textSecondary,lineHeight:1.85,whiteSpace:"pre-line"}}>{content}</div>
          }
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div className="card card-p">
            <div style={{fontSize:13,fontWeight:700,marginBottom:10}}>사용된 노드 ({usedNodes.length}개)</div>
            {usedNodes.map(n=>(
              <div key={n} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:`1px solid ${TDS.bgTertiary}`,cursor:"pointer"}} onClick={()=>onNav("S07")}>
                <div style={{width:6,height:6,borderRadius:"50%",background:TDS.blue500}} />
                <span style={{fontSize:13,color:TDS.textSecondary}}>{n}</span>
              </div>
            ))}
          </div>
          <div className="card card-p">
            <div style={{fontSize:13,fontWeight:700,marginBottom:10}}>템플릿 정보</div>
            <div style={{fontSize:13,color:TDS.textTertiary}}>자기소개서 A</div>
            <div style={{fontSize:12,color:TDS.textDisabled,marginTop:4}}>생성: 2026-01-20</div>
            <Btn v="ghost" s="sm" style={{marginTop:12}}>재생성</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* S23 가지치기 추천 */
function S23({ onNav }) {
  const [decisions,setDecisions]=useState({});
  const recs=[
    {id:0,node:"단순 암기",reason:"연결 수 1개 · 가중치 0.21 · 비활성",action:"삭제"},
    {id:1,node:"참고문헌 A",reason:"중복 노드 감지 (참고문헌 B와 유사도 0.94)",action:"병합"},
    {id:2,node:"미분방정식",reason:"연결 수 0개 · 고아 노드",action:"삭제"},
    {id:3,node:"물리실험 1",reason:"6개월 이상 비활성",action:"아카이브"},
  ];
  const decide=(id,v)=>setDecisions({...decisions,[id]:v});
  return (
    <div className="content" style={{maxWidth:700,margin:"0 auto"}}>
      <div style={{fontSize:22,fontWeight:700,marginBottom:6}}>가지치기 추천</div>
      <div style={{fontSize:14,color:TDS.textTertiary,marginBottom:16}}>ML이 정리를 추천한 노드 {recs.length}개</div>
      <Notice type="warning" style={{marginBottom:20}}>삭제된 노드는 30일 안에 복구할 수 있습니다.</Notice>
      <div className="card card-p" style={{marginBottom:16}}>
        {recs.map((r,i)=>(
          <div key={r.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:i<recs.length-1?`1px solid ${TDS.bgTertiary}`:"none",opacity:decisions[r.id]?0.5:1}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                <div style={{fontWeight:600,fontSize:14}}>{r.node}</div>
                <div style={{padding:"2px 8px",background:r.action==="삭제"?TDS.dangerBg:r.action==="병합"?TDS.blue50:TDS.warningBg,borderRadius:10,fontSize:11,fontWeight:600,color:r.action==="삭제"?TDS.danger:r.action==="병합"?TDS.blue500:TDS.warning}}>{r.action} 추천</div>
              </div>
              <div style={{fontSize:12,color:TDS.textTertiary}}>{r.reason}</div>
            </div>
            {decisions[r.id]
              ? <div style={{fontSize:12,color:TDS.textTertiary}}>{decisions[r.id]}</div>
              : <div style={{display:"flex",gap:6}}>
                  <Btn v={r.action==="삭제"?"danger":"primary"} s="sm" onClick={()=>decide(r.id,"채택")}>{r.action}</Btn>
                  <Btn v="ghost" s="sm" onClick={()=>decide(r.id,"거부")}>거부</Btn>
                </div>
            }
          </div>
        ))}
      </div>
      <Btn v="primary" s="md" fw onClick={()=>onNav("S06")}>그래프에 반영</Btn>
    </div>
  );
}

/* S26 피드 */
function S26({ onNav }) {
  const feed=[
    {type:"node",icon:"🟢",t:"노드 생성","d":'"양자컴퓨팅" 노드를 생성했습니다',time:"5분 전"},
    {type:"comment",icon:"💬",t:"코멘트 수신",d:"김선생님이 코멘트를 남겼습니다",time:"1시간 전"},
    {type:"doc",icon:"📄",t:"텍스트 수정",d:"세특 물리학 영역을 수정했습니다",time:"3시간 전"},
    {type:"voice",icon:"🎙️",t:"음성 녹음",d:"물리 토론 세션 (48분)을 완료했습니다",time:"어제"},
    {type:"form",icon:"📝",t:"양식 생성",d:"화학과 자기소개서를 생성했습니다",time:"2일 전"},
    {type:"node",icon:"🗑️",t:"노드 삭제",d:'"단순 암기" 노드를 삭제했습니다 (가지치기)',time:"3일 전"},
    {type:"pdf",icon:"📎",t:"PDF 업로드",d:"학교생활기록부.pdf를 업로드했습니다",time:"5일 전"},
  ];
  return (
    <div className="content" style={{maxWidth:600,margin:"0 auto"}}>
      <div style={{fontSize:20,fontWeight:700,marginBottom:20}}>활동 피드</div>
      <div className="card card-p">
        {feed.map((f,i)=>(
          <div key={i} style={{display:"flex",gap:14,padding:"14px 0",borderBottom:i<feed.length-1?`1px solid ${TDS.bgTertiary}`:"none"}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:TDS.bgTertiary,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}><TFI s={18} color={TDS.textSecondary}>{f.icon}</TFI></div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14,color:TDS.textPrimary,marginBottom:3}}>{f.t}</div>
              <div style={{fontSize:13,color:TDS.textSecondary}}>{f.d}</div>
            </div>
            <div style={{fontSize:11,color:TDS.textDisabled,flexShrink:0}}>{f.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* S29 내보내기 작업 */
function S29({ onNav }) {
  const jobs=[
    {id:0,title:"전체 데이터 내보내기",fmt:"JSON",status:"완료",size:"2.4 MB",created:"2026-01-20"},
    {id:1,title:"화학과 자기소개서",fmt:"PDF",status:"완료",size:"128 KB",created:"2026-01-20"},
    {id:2,title:"그래프 스냅샷",fmt:"PNG",status:"처리 중",size:"-",created:"2026-01-20"},
  ];
  const [creating, setCreating]=useState(false);
  return (
    <div className="content" style={{maxWidth:700,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontSize:20,fontWeight:700}}>내보내기 작업</div>
        <Btn v="primary" s="sm" onClick={()=>setCreating(!creating)}>+ 새 작업</Btn>
      </div>
      {creating && (
        <div className="card card-p" style={{marginBottom:16,border:`1px solid ${TDS.blue500}`}}>
          <div style={{fontWeight:700,marginBottom:16}}>새 내보내기 작업</div>
          <div className="inp-group"><label className="inp-label">대상</label>
            <select className="inp"><option>전체 데이터</option><option>그래프만</option><option>텍스트만</option><option>양식 결과물</option></select>
          </div>
          <div className="inp-group"><label className="inp-label">포맷</label>
            <select className="inp"><option>JSON</option><option>PDF</option><option>CSV</option><option>PNG</option></select>
          </div>
          <div style={{display:"flex",gap:8,marginTop:16}}>
            <Btn v="secondary" s="sm" onClick={()=>setCreating(false)}>취소</Btn>
            <Btn v="primary" s="sm" onClick={()=>setCreating(false)}>작업 시작</Btn>
          </div>
        </div>
      )}
      <div className="card card-p">
        {jobs.map((j,i)=>(
          <div key={j.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:i<jobs.length-1?`1px solid ${TDS.bgTertiary}`:"none"}}>
            <TFI s={24} color={TDS.textSecondary}>{j.fmt==="PDF"?"📑":j.fmt==="PNG"?"🖼️":"📦"}</TFI>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14}}>{j.title}</div>
              <div style={{fontSize:12,color:TDS.textTertiary}}>{j.fmt} · {j.size} · {j.created}</div>
            </div>
            <div style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:j.status==="완료"?TDS.successBg:TDS.warningBg,color:j.status==="완료"?TDS.success:TDS.warning}}>{j.status}</div>
            {j.status==="완료"&&<Btn v="primary" s="sm">다운로드</Btn>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* S31 계정 정보 */
function S31({ onNav }) {
  return (
    <div className="content" style={{maxWidth:560,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("S30")}>← 설정</button>
        <div style={{fontSize:20,fontWeight:700}}>계정 정보</div>
      </div>
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:16,paddingBottom:20,marginBottom:20,borderBottom:`1px solid ${TDS.borderDefault}`}}>
          <div style={{width:64,height:64,borderRadius:"50%",background:TDS.blue500,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:28,fontWeight:700}}>홍</div>
          <div>
            <div style={{fontSize:20,fontWeight:700}}>홍길동</div>
            <div style={{fontSize:13,color:TDS.textTertiary}}>hong@school.ac.kr</div>
          </div>
        </div>
        {[
          ["역할","학생"],
          ["가입일","2026-01-01"],
          ["마지막 로그인","2026-01-20 14:32"],
          ["OAuth 제공자","Google"],
        ].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${TDS.bgTertiary}`,fontSize:14}}>
            <span style={{color:TDS.textTertiary}}>{k}</span>
            <span style={{color:TDS.textPrimary,fontWeight:500}}>{v}</span>
          </div>
        ))}
      </div>
      <div className="card card-p">
        <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>활동 통계</div>
        {[["총 노드","2,847개"],["총 엣지","4,231개"],["음성 녹음","23회 / 18시간"],["생성한 양식","6개"]].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${TDS.bgTertiary}`,fontSize:13}}>
            <span style={{color:TDS.textTertiary}}>{k}</span>
            <span style={{fontWeight:600,color:TDS.textPrimary}}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* S32 계정 삭제 요청 */
function S32({ onNav }) {
  const [step, setStep] = useState(0);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="content" style={{maxWidth:540,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("S30")}>← 설정</button>
        <div style={{fontSize:20,fontWeight:700}}>계정 삭제 요청</div>
      </div>
      {step===0 && (
        <>
          <Notice type="danger" style={{marginBottom:20}}>
            <div style={{fontWeight:700,marginBottom:8}}>⚠️ 삭제 전 반드시 읽어주세요</div>
            <ul style={{paddingLeft:18,fontSize:13,lineHeight:2}}>
              <li>삭제 요청 후 <strong>30일 이내</strong> 철회 가능</li>
              <li>30일 경과 시 모든 데이터가 <strong>완전 삭제</strong>됩니다</li>
              <li>그래프·텍스트·음성 데이터 포함 모든 정보 삭제</li>
              <li>삭제 후 같은 이메일로 재가입 가능 (데이터는 복구 불가)</li>
            </ul>
          </Notice>
          <div className="card card-p" style={{marginBottom:16}}>
            <div className="inp-group"><label className="inp-label">삭제 사유 (선택)</label>
              <textarea className="inp" rows={3} placeholder="삭제 이유를 알려주시면 서비스 개선에 도움이 됩니다..." value={reason} onChange={e=>setReason(e.target.value)} />
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginTop:12}}>
              <input type="checkbox" id="del-confirm" checked={confirm} onChange={e=>setConfirm(e.target.checked)} />
              <label htmlFor="del-confirm" style={{fontSize:13,color:TDS.textSecondary}}>위 내용을 모두 이해했으며 계정 삭제를 요청합니다</label>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn v="secondary" s="md" fw onClick={()=>onNav("S30")}>취소</Btn>
            <Btn v="danger" s="md" fw disabled={!confirm} onClick={()=>setStep(1)}>삭제 요청 제출</Btn>
          </div>
        </>
      )}
      {step===1 && (
        <div className="card card-p" style={{textAlign:"center",padding:"48px 24px"}}>
          <TFI s={56}>⏳</TFI>
          <div style={{fontSize:20,fontWeight:700,marginTop:16,marginBottom:8}}>삭제 요청이 접수되었습니다</div>
          <div style={{fontSize:14,color:TDS.textTertiary,lineHeight:1.7,marginBottom:24}}>
            30일 이내에는 언제든지 철회할 수 있습니다.<br/>
            <strong style={{color:TDS.danger}}>2026-02-20</strong> 이후 데이터가 완전히 삭제됩니다.
          </div>
          <Btn v="danger" s="lg" fw onClick={()=>setStep(2)}>철회하기</Btn>
        </div>
      )}
      {step===2 && (
        <div className="card card-p" style={{textAlign:"center",padding:"48px 24px"}}>
          <TFI s={56}>✅</TFI>
          <div style={{fontSize:20,fontWeight:700,marginTop:16,marginBottom:8}}>삭제 요청이 철회되었습니다</div>
          <div style={{fontSize:14,color:TDS.textTertiary,marginBottom:24}}>계정이 정상적으로 유지됩니다.</div>
          <Btn v="primary" s="lg" onClick={()=>onNav("S05")}>대시보드로</Btn>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   ── TEACHER SCREENS ──
────────────────────────────────────────────────────────────── */

function T01({ onNav }) {
  const { state, actions } = useStore();
  const [school, setSchool] = useState("");
  const [subject, setSubject] = useState("");
  const [teacherNo, setTeacherNo] = useState("");
  const [file, setFile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async () => {
    setErr("");
    if(!school.trim()||!subject.trim()||!teacherNo.trim()){ setErr("모든 항목을 입력하세요."); return; }
    if(!file){ setErr("증빙 서류를 첨부하세요."); return; }
    setBusy(true);
    try { await actions.submitTeacherVerification({ school:school.trim(), subject:subject.trim(), teacherNo:teacherNo.trim() }); onNav("T02"); }
    finally { setBusy(false); }
  };
  return (
    <div className="content" style={{maxWidth:560,margin:"0 auto"}}>
      <div className="sec-title mb4" style={{marginBottom:4}}>교사 자격 검증 신청</div>
      <div className="sec-sub">교직원 증빙 서류를 첨부하여 신청하세요</div>
      <Card>
        <Notice type="info" className="mb24">교사 자격 검증은 영업일 기준 1~3일이 소요됩니다. 승인 후 담당 학생 매핑이 가능합니다.</Notice>
        {err && <div style={{marginBottom:16,padding:"10px 12px",borderRadius:10,background:"rgba(240,68,68,.08)",border:`1px solid rgba(240,68,68,.25)`,color:TDS.danger,fontSize:13,fontWeight:500}}>{err}</div>}
        <div className="inp-group"><label className="inp-label">소속 학교</label><input className="inp" placeholder="○○고등학교" value={school} onChange={e=>setSchool(e.target.value)} disabled={busy} /></div>
        <div className="inp-group"><label className="inp-label">교과목</label><input className="inp" placeholder="물리학, 화학, 수학..." value={subject} onChange={e=>setSubject(e.target.value)} disabled={busy} /></div>
        <div className="inp-group"><label className="inp-label">교원번호</label><input className="inp" placeholder="00000000" value={teacherNo} onChange={e=>setTeacherNo(e.target.value)} disabled={busy} /></div>
        <div className="inp-group">
          <label className="inp-label">증빙 서류 첨부</label>
          <div onClick={()=>!busy&&setFile(true)} style={{border:`2px dashed ${file?TDS.blue500:TDS.borderStrong}`,borderRadius:12,padding:28,textAlign:"center",color:file?TDS.blue500:TDS.textTertiary,cursor:"pointer",background:file?TDS.blue50:"transparent"}}>
            <div style={{fontSize:32,marginBottom:8}}>{file?"✅":"📎"}</div>
            <div style={{fontSize:14}}>{file?"재직증명서.pdf 첨부됨 (클릭하여 변경)":"클릭하거나 파일을 드래그하세요"}</div>
            <div style={{fontSize:12,marginTop:4}}>재직증명서, 교원 자격증 (PDF, JPG, PNG · 최대 10MB)</div>
          </div>
        </div>
        <Btn v="primary" fw onClick={submit} disabled={busy} style={busy?{opacity:.7,cursor:"not-allowed"}:undefined}>{busy?"제출 중…":"신청 제출"}</Btn>
      </Card>
    </div>
  );
}

function T03({ onNav }) {
  const { state, actions } = useStore();
  const students = state.students;
  useEffect(()=>{ if(!students.length) actions.loadStudents(state.session?.user?.id); /* eslint-disable-next-line */ }, []);
  const stType={활발:"green",보통:"grey",낮음:"orange"};
  const open = (s) => { actions.selectStudent(s); onNav("T07"); };
  const pendingComments = state.comments.filter(c=>!c.replied).length;
  return (
    <div className="content">
      <div className="grid4 g-20 mb24" style={{gap:20,marginBottom:24}}>
        <StatCard label="담당 학생" value={`${students.length}명`} sub="매핑 완료" color={TDS.blue500} />
        <StatCard label="미처리 코멘트" value={`${pendingComments}개`} sub="빠른 피드백 필요" color={TDS.danger} />
        <StatCard label="이번 달 코멘트" value={`${state.comments.length}개`} sub="누적" color={TDS.success} />
        <StatCard label="매핑 대기" value="2건" sub="승인 대기 중" color={TDS.warning} />
      </div>
      <div className="grid2 g-20 mb24" style={{gap:20,marginBottom:24}}>
        <Card>
          <div className="card-hdr"><span className="card-title">담당 학생 목록</span><Btn v="ghost" s="sm" onClick={()=>onNav("T06")}>전체 보기</Btn></div>
          {students.map(s=>(
            <div key={s.id} className="list-row" style={{cursor:"pointer"}} onClick={()=>open(s)}>
              <Av name={s.name[0]} size="sm" />
              <div className="list-row-left">
                <div className="list-row-title">{s.name}</div>
                <div className="list-row-sub">{s.grade}반 · 노드 {s.nodes.toLocaleString()}개</div>
              </div>
              <Badge t={stType[s.activity]}>{s.activity}</Badge>
            </div>
          ))}
          {!students.length && <div style={{padding:"24px 0",textAlign:"center",color:TDS.textTertiary,fontSize:13}}>불러오는 중…</div>}
        </Card>
        <Card>
          <div className="card-hdr">
            <div className="row g-8" style={{gap:8}}><span className="card-title">미처리 코멘트 큐</span><span className="badge-num">{pendingComments}</span></div>
          </div>
          {state.comments.filter(c=>!c.replied).slice(0,3).map((c)=>(
            <div key={c.id} className="list-row" style={{cursor:"pointer"}} onClick={()=>onNav("T10")}>
              <Av name={(c.author||"?")[0]} size="sm" />
              <div className="list-row-left"><div className="list-row-title">{c.author}</div><div className="list-row-sub">{c.type} · {c.target}</div></div>
              <span style={{fontSize:12,color:TDS.textTertiary}}>{timeAgo(c.createdAt)}</span>
            </div>
          ))}
          {!pendingComments && <div style={{padding:"24px 0",textAlign:"center",color:TDS.textTertiary,fontSize:13}}>미처리 코멘트가 없습니다</div>}
        </Card>
      </div>
      <Card>
        <div className="card-hdr"><span className="card-title">학생 매핑 신청 대기</span><Btn v="ghost" s="sm" onClick={()=>onNav("T04")}>신청하기</Btn></div>
        <div className="grid2 g-12" style={{gap:12}}>
          {[{n:"김민수",c:"3학년 4반"},{n:"이수진",c:"3학년 4반"}].map(s=>(
            <div key={s.n} className="card row g-12" style={{padding:"14px 16px",gap:12}}>
              <Av name={s.n[0]} size="sm" /><div style={{flex:1}}><div style={{fontSize:14,fontWeight:600}}>{s.n}</div><div style={{fontSize:12,color:TDS.textTertiary}}>{s.c}</div></div>
              <Btn v="primary" s="sm">수락</Btn><Btn v="secondary" s="sm">거절</Btn>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function T06({ onNav }) {
  const { state, actions } = useStore();
  const students = state.students;
  useEffect(()=>{ if(!students.length) actions.loadStudents(state.session?.user?.id); /* eslint-disable-next-line */ }, []);
  const open = (s) => { actions.selectStudent(s); onNav("T07"); };
  return (
    <div className="content">
      <div className="row-between mb24" style={{marginBottom:24}}>
        <div className="sec-title">담당 학생 목록</div>
        <Btn v="primary" onClick={()=>onNav("T04")}>+ 학생 추가</Btn>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>이름</th><th>학번/학반</th><th>총 노드</th><th>마지막 활동</th><th>미처리</th><th>그래프 동기화</th><th></th></tr></thead>
          <tbody>
            {students.map(s=>(
              <tr key={s.id} style={{cursor:"pointer"}} onClick={()=>open(s)}>
                <td><div className="row g-8" style={{gap:8}}><Av name={s.name[0]} size="xs"/>{s.name}</div></td>
                <td style={{color:TDS.textTertiary}}>{s.grade} / {s.id}</td>
                <td>{s.nodes.toLocaleString()}개</td>
                <td style={{color:TDS.textTertiary}}>{s.last}</td>
                <td><span style={{color:s.cm>0?TDS.danger:TDS.textDisabled}}>{s.cm}개</span></td>
                <td><Badge t={s.sync==="동기화됨"?"green":"orange"}>{s.sync}</Badge></td>
                <td><Btn v="secondary" s="sm" onClick={(e)=>{e.stopPropagation();open(s);}}>상세</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function T07({ onNav }) {
  const { state } = useStore();
  const stu = state.selectedStudent || { name:"홍길동", grade:"3-2", id:"20301" };
  const [tab, setTab] = useState("그래프");
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div className="toolbar">
        <div className="row g-12" style={{flex:1,gap:12}}>
          <Av name={stu.name[0]} size="md" />
          <div><div style={{fontWeight:700,fontSize:15}}>{stu.name}</div><div style={{fontSize:12,color:TDS.textTertiary}}>{stu.grade?`${stu.grade.replace("-","학년 ")}반`:""} · 학번 {stu.id}</div></div>
          <Badge t="orange">읽기 전용</Badge>
        </div>
        <Btn v="primary" s="sm" onClick={()=>onNav("T10")}>코멘트 작성</Btn>
      </div>
      <div className="tab-bar" style={{padding:"0 24px",background:TDS.bgPrimary,margin:0}}>
        {["그래프","텍스트 영역","음성 보고서","코멘트"].map(t=>(
          <div key={t} className={`tab-item${tab===t?" active":""}`} onClick={()=>setTab(t)}>{t}</div>
        ))}
      </div>
      <div style={{flex:1,padding:24,overflow:"auto",background:TDS.bgSecondary}}>
        {tab==="그래프"&&(
          <>
            <Notice type="warning" className="mb16">🔒 이 그래프는 읽기 전용입니다. 코멘트 작성만 가능합니다.</Notice>
            <div style={{height:360,background:TDS.bgTertiary,borderRadius:16,position:"relative",border:`1px solid ${TDS.borderDefault}`}}>
              {[{x:"50%",y:"45%",l:"물리학",c:TDS.blue500,sz:60},{x:"28%",y:"26%",l:"양자역학",c:TDS.blue400,sz:44},{x:"72%",y:"24%",l:"고전역학",c:TDS.success,sz:44}].map(n=>(
                <div key={n.l} onClick={()=>onNav("T09")} style={{position:"absolute",left:n.x,top:n.y,transform:"translate(-50%,-50%)",width:n.sz,height:n.sz,borderRadius:"50%",background:n.c,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>{n.l}</div>
              ))}
            </div>
          </>
        )}
        {tab==="텍스트 영역"&&(
          <div className="grid3 g-14" style={{gap:14}}>
            {["세특","자율","동아리","봉사","진로","행특","독서","수상"].map(a=>(
              <div key={a} className="card card-p" style={{cursor:"pointer"}} onClick={()=>onNav("T09")}>
                <div style={{fontSize:15,fontWeight:700,marginBottom:6}}>{a}</div>
                <Badge t="grey">읽기 전용</Badge>
              </div>
            ))}
          </div>
        )}
        {tab==="음성 보고서"&&(
          <div style={{textAlign:"center",padding:"48px 0",color:TDS.textTertiary,fontSize:14}}>등록된 음성 보고서가 없습니다</div>
        )}
        {tab==="코멘트"&&(
          <div style={{textAlign:"center",padding:"48px 0"}}>
            <div style={{fontSize:14,color:TDS.textTertiary,marginBottom:16}}>이 학생에게 남긴 코멘트를 확인하거나 새로 작성하세요</div>
            <Btn v="primary" s="md" onClick={()=>onNav("T10")}>+ 코멘트 작성</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

function T10({ onNav }) {
  const { state, actions } = useStore();
  const stu = state.selectedStudent;
  const [type, setType] = useState("노드");
  const [target, setTarget] = useState("양자컴퓨팅 노드");
  const [txt, setTxt] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if(!txt.trim()) return;
    setBusy(true);
    try {
      await actions.postComment({
        author: state.session?.user?.name || "교사",
        type, target,
        content: txt.trim(),
        student: stu?.name,
        replied: false,
      });
      onNav("T11");
    } finally { setBusy(false); }
  };
  return (
    <div className="content" style={{maxWidth:640,margin:"0 auto"}}>
      <div className="sec-title mb24" style={{marginBottom:24}}>코멘트 작성{stu?` · ${stu.name}`:""}</div>
      <Card>
        <div className="inp-group">
          <label className="inp-label">코멘트 대상 유형</label>
          <div className="row g-8" style={{gap:8}}>
            {["노드","텍스트","음성 보고서","양식 결과물"].map(t=>(
              <Btn key={t} v={type===t?"primary":"secondary"} s="sm" onClick={()=>setType(t)}>{t}</Btn>
            ))}
          </div>
        </div>
        <div className="inp-group">
          <label className="inp-label">대상 선택</label>
          <select className="inp" style={{cursor:"pointer"}} value={target} onChange={e=>setTarget(e.target.value)}>
            <option>양자컴퓨팅 노드</option><option>물리학 노드</option><option>세특 영역</option>
          </select>
        </div>
        <div className="inp-group">
          <label className="inp-label">코멘트 내용</label>
          <textarea className="textarea" rows={5} value={txt} onChange={e=>setTxt(e.target.value)} placeholder="학생에게 전달할 코멘트를 작성하세요..." disabled={busy} />
        </div>
        <div className="row-between">
          <span style={{fontSize:13,color:TDS.textTertiary}}>학생이 즉시 알림을 받습니다</span>
          <div className="row g-8" style={{gap:8}}>
            <Btn v="secondary" onClick={()=>onNav("T11")} disabled={busy}>취소</Btn>
            <Btn v="primary" onClick={send} disabled={!txt.trim()||busy} style={busy?{opacity:.7,cursor:"not-allowed"}:undefined}>{busy?"전송 중…":"코멘트 전송"}</Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   ── TEACHER SCREENS (미구현 분) ──
────────────────────────────────────────────────────────────── */

/* T02 자격 검증 상태 */
function T02({ onNav }) {
  const { state } = useStore();
  const v = state.teacherVerification;
  const status = v?.status || "미신청"; // "승인됨"|"반려됨"|"검토 중"|"미신청"
  const statusMap = {
    "검토 중": { color:TDS.warning, bg:TDS.warningBg, icon:"⏳" },
    "승인됨":  { color:TDS.success, bg:TDS.successBg, icon:"✅" },
    "반려됨":  { color:TDS.danger,  bg:TDS.dangerBg,  icon:"❌" },
    "미신청":  { color:TDS.textTertiary, bg:TDS.bgTertiary, icon:"📄" },
  };
  const s = statusMap[status];
  const submittedStr = v?.submittedAt ? new Date(v.submittedAt).toLocaleString("ko-KR") : "—";
  const approved = status==="승인됨";
  const rejected = status==="반려됨";
  return (
    <div className="content" style={{maxWidth:560,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("T01")}>← 신청</button>
        <div style={{fontSize:20,fontWeight:700}}>자격 검증 상태</div>
      </div>
      {status==="미신청" ? (
        <div className="card card-p" style={{textAlign:"center",padding:"48px 24px"}}>
          <div style={{fontSize:40,marginBottom:12,opacity:.4}}>📄</div>
          <div style={{fontSize:16,fontWeight:600,marginBottom:8}}>아직 신청 내역이 없습니다</div>
          <div style={{fontSize:13,color:TDS.textTertiary,marginBottom:20}}>교사 자격 검증을 신청하면 상태가 여기에 표시됩니다.</div>
          <Btn v="primary" s="md" onClick={()=>onNav("T01")}>자격 검증 신청하기</Btn>
        </div>
      ) : (
      <>
      <div className="card card-p" style={{marginBottom:16,textAlign:"center"}}>
        <div style={{width:80,height:80,borderRadius:"50%",background:s.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:40,margin:"0 auto 16px"}}><TFI s={40} color={s.color}>{s.icon}</TFI></div>
        <div style={{fontSize:22,fontWeight:700,color:s.color,marginBottom:8}}>{status}</div>
        <div style={{fontSize:14,color:TDS.textTertiary}}>신청일: {submittedStr}</div>
      </div>
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>신청 정보</div>
        {[["소속 학교",v?.school||"—"],["교과목",v?.subject||"—"],["증빙 서류","재직증명서.pdf"]].map(([k,val])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${TDS.bgTertiary}`,fontSize:13}}>
            <span style={{color:TDS.textTertiary}}>{k}</span>
            <span style={{color:TDS.textPrimary,fontWeight:500}}>{val}</span>
          </div>
        ))}
      </div>
      <div className="card card-p">
        <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>처리 타임라인</div>
        {[
          {s:"완료",t:"신청 접수",d:submittedStr},
          {s:approved||rejected?"완료":"진행",t:"서류 검토",d:approved||rejected?"완료":"검토 중..."},
          {s:approved?"완료":rejected?"완료":"대기",t:approved?"승인 완료":rejected?"반려됨":"관리자 확인",d:approved||rejected?"완료":"대기"},
        ].map((item,i)=>(
          <div key={i} style={{display:"flex",gap:12,padding:"8px 0"}}>
            <div style={{width:20,height:20,borderRadius:"50%",background:item.s==="완료"?TDS.success:item.s==="진행"?TDS.warning:TDS.borderDefault,flexShrink:0,marginTop:2}} />
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:item.s==="대기"?TDS.textDisabled:TDS.textPrimary}}>{item.t}</div>
              <div style={{fontSize:11,color:TDS.textTertiary}}>{item.d}</div>
            </div>
          </div>
        ))}
      </div>
      </>
      )}
    </div>
  );
}

/* T04 학생 매핑 신청 */
function T04({ onNav }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const students=[
    {id:"S001",name:"김학생",grade:"2학년 3반"},
    {id:"S002",name:"이학생",grade:"2학년 5반"},
    {id:"S003",name:"박학생",grade:"3학년 1반"},
  ];
  const filtered=students.filter(s=>!q||(s.name+s.id).includes(q));
  return (
    <div className="content" style={{maxWidth:560,margin:"0 auto"}}>
      <div style={{fontSize:22,fontWeight:700,marginBottom:6}}>학생 매핑 신청</div>
      <div style={{fontSize:14,color:TDS.textTertiary,marginBottom:20}}>담당할 학생을 검색하여 매핑을 요청하세요</div>
      <div className="card card-p" style={{marginBottom:16}}>
        <div className="inp-group">
          <label className="inp-label">학생 검색</label>
          <div className="search-wrap"><span>🔍</span><input placeholder="이름 또는 학번 검색..." value={q} onChange={e=>setQ(e.target.value)} /></div>
        </div>
        <div style={{marginTop:8}}>
          {filtered.map(s=>(
            <div key={s.id} onClick={()=>setSel(s)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:8,marginBottom:4,background:sel?.id===s.id?TDS.blue50:TDS.bgSecondary,border:`1px solid ${sel?.id===s.id?TDS.blue500:TDS.borderDefault}`,cursor:"pointer"}}>
              <Av name={s.name[0]} size="sm" />
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:14}}>{s.name}</div>
                <div style={{fontSize:12,color:TDS.textTertiary}}>{s.grade} · {s.id}</div>
              </div>
              {sel?.id===s.id&&<TFI s={18} style={{color:TDS.blue500}}>✓</TFI>}
            </div>
          ))}
          {!filtered.length&&<div style={{textAlign:"center",padding:"20px",color:TDS.textTertiary,fontSize:13}}>검색 결과 없음</div>}
        </div>
      </div>
      {sel&&(
        <div className="card card-p" style={{marginBottom:16}}>
          <div className="inp-group">
            <label className="inp-label">신청 사유</label>
            <textarea className="inp" rows={3} placeholder="해당 학생의 담임 교사입니다..." />
          </div>
        </div>
      )}
      <Btn v="primary" s="lg" fw disabled={!sel} onClick={()=>onNav("T05")}>매핑 신청 ({sel?sel.name:"학생 선택"})</Btn>
    </div>
  );
}

/* T05 매핑 신청 상태 */
function T05({ onNav }) {
  const requests=[
    {student:"김학생",grade:"2학년 3반",date:"2026-01-20",status:"학생 수락 대기"},
    {student:"이학생",grade:"2학년 5반",date:"2026-01-18",status:"승인됨"},
    {student:"최학생",grade:"3학년 2반",date:"2026-01-10",status:"만료"},
  ];
  const statusColor={
    "학생 수락 대기":{c:TDS.warning,bg:TDS.warningBg},
    "승인됨":{c:TDS.success,bg:TDS.successBg},
    "만료":{c:TDS.textTertiary,bg:TDS.bgTertiary},
    "거부됨":{c:TDS.danger,bg:TDS.dangerBg},
  };
  return (
    <div className="content" style={{maxWidth:640,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontSize:20,fontWeight:700}}>매핑 신청 상태</div>
        <Btn v="primary" s="sm" onClick={()=>onNav("T04")}>+ 신규 신청</Btn>
      </div>
      <div className="card card-p">
        {requests.map((r,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:i<requests.length-1?`1px solid ${TDS.bgTertiary}`:"none"}}>
            <Av name={r.student[0]} size="sm" />
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14}}>{r.student}</div>
              <div style={{fontSize:12,color:TDS.textTertiary}}>{r.grade} · 신청 {r.date}</div>
            </div>
            <div style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:statusColor[r.status]?.bg,color:statusColor[r.status]?.c}}>{r.status}</div>
            {r.status==="학생 수락 대기"&&<Btn v="ghost" s="sm">취소</Btn>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* T09 학생 노드 상세 R */
function T09({ onNav }) {
  const node={label:"양자컴퓨팅",type:"개념",weight:0.92,desc:"양자역학 원리를 이용해 정보를 처리하는 컴퓨팅 패러다임.",student:"김학생",edges:["큐비트","양자 알고리즘"]};
  return (
    <div className="content" style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("T08")}>← 그래프</button>
        <div style={{width:40,height:40,borderRadius:"50%",background:TDS.success,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:13}}>개념</div>
        <div style={{flex:1}}>
          <div style={{fontSize:20,fontWeight:700}}>{node.label}</div>
          <div style={{fontSize:12,color:TDS.textTertiary}}>학생: {node.student} · 가중치 {node.weight}</div>
        </div>
        <Btn v="primary" s="sm" onClick={()=>onNav("T10")}>코멘트 작성</Btn>
      </div>
      <Notice type="info" style={{marginBottom:16}}>읽기 전용 뷰입니다. 학생 데이터를 직접 편집할 수 없습니다.</Notice>
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>노드 정보</div>
        <div style={{fontSize:14,color:TDS.textSecondary,lineHeight:1.7,padding:"12px",background:TDS.bgSecondary,borderRadius:8,marginBottom:12}}>{node.desc}</div>
        <div style={{fontSize:13,color:TDS.textTertiary}}>타입: {node.type}</div>
      </div>
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>연결 엣지 ({node.edges.length}개)</div>
        {node.edges.map(e=>(
          <div key={e} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:`1px solid ${TDS.bgTertiary}`}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:TDS.success}} />
            <span style={{fontSize:13,color:TDS.textSecondary}}>{e}</span>
            <span style={{fontSize:11,color:TDS.textTertiary,marginLeft:"auto"}}>하위 개념</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   ── ADMIN SCREENS ──
────────────────────────────────────────────────────────────── */

function A00({ onNav }) {
  const { state, actions } = useStore();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [mfa, setMfa] = useState("");
  const [localErr, setLocalErr] = useState("");
  const busy = state.authLoading;
  const doLogin = async () => {
    setLocalErr("");
    try { await actions.signInAdmin(email, pw, mfa); }
    catch (e) { setLocalErr(e.message); }
  };
  const errMsg = localErr || state.authError;
  const darkInput = { background:TDS.dark, border:`1px solid ${TDS.darkBrd}`, color:"#f2f2f7" };
  return (
    <div style={{minHeight:"100vh",background:TDS.dark,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:TDS.darkCard,borderRadius:24,padding:"48px 52px",maxWidth:420,width:"90%",boxShadow:"0 20px 60px rgba(0,0,0,.4)"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:48,marginBottom:12}}><TFI s={48} color={TDS.blue500}>🛡️</TFI></div>
          <h2 style={{fontSize:22,fontWeight:800,color:"#f2f2f7",marginBottom:6}}>관리자 콘솔</h2>
          <p style={{fontSize:13,color:"#8b95a1"}}>보안팀 발급 계정으로 로그인하세요</p>
        </div>
        <Notice type="warning" className="mb24">관리자 계정은 OAuth 가입이 불가합니다. MFA 인증이 필수입니다.</Notice>
        {errMsg && <div style={{marginBottom:16,padding:"10px 12px",borderRadius:10,background:"rgba(240,68,68,.12)",border:`1px solid rgba(240,68,68,.3)`,color:"#ff8080",fontSize:13,fontWeight:500}}>{errMsg}</div>}
        <div className="inp-group"><label className="inp-label" style={{color:"#c2c9d2"}}>관리자 ID</label><input className="inp" style={darkInput} placeholder="admin@school.ac.kr" value={email} onChange={e=>setEmail(e.target.value)} disabled={busy} /></div>
        <div className="inp-group"><label className="inp-label" style={{color:"#c2c9d2"}}>비밀번호</label><input className="inp" type="password" style={darkInput} placeholder="••••••••" value={pw} onChange={e=>setPw(e.target.value)} disabled={busy} /></div>
        <div className="inp-group" style={{marginBottom:24}}><label className="inp-label" style={{color:"#c2c9d2"}}>MFA 코드</label><input className="inp" style={darkInput} placeholder="6자리 코드" maxLength={6} value={mfa} onChange={e=>setMfa(e.target.value.replace(/\D/g,""))} disabled={busy} /></div>
        <Btn v="primary" fw onClick={doLogin} disabled={busy} style={busy?{opacity:.7,cursor:"not-allowed"}:undefined}>{busy?"인증 중…":"로그인"}</Btn>
        <div style={{textAlign:"center",marginTop:14,fontSize:11,color:"#6b7280"}}>데모 · <b style={{color:"#8b95a1"}}>admin@school.ac.kr</b> / 비번 <b style={{color:"#8b95a1"}}>admin</b> / MFA 아무 6자리</div>
      </div>
    </div>
  );
}

function A01({ onNav }) {
  const { state, actions } = useStore();
  useEffect(()=>{
    if(!state.adminUsers.length) actions.loadAdminUsers();
    if(!state.reports.length) actions.loadReports();
    /* eslint-disable-next-line */
  }, []);
  const services=[
    {n:"API 서버",st:"정상",uptime:"99.98%"},{n:"ML 파이프라인",st:"정상",uptime:"99.95%"},
    {n:"STT 서버",st:"정상",uptime:"99.90%"},{n:"Redis 캐시",st:"경고",uptime:"99.82%"},
    {n:"PostgreSQL",st:"정상",uptime:"100%"},{n:"임베딩 모델",st:"정상",uptime:"99.97%"},
  ];
  const totalUsers = state.adminUsers.length;
  const studentCount = state.adminUsers.filter(u=>u.role==="학생").length;
  const teacherCount = state.adminUsers.filter(u=>u.role==="교사").length;
  const pendingReports = state.reports.filter(r=>(r.status||"검토 중")!=="처리됨").length;
  const pendingTeacherApps = state.teacherApplications.filter(t=>t.status==="검토 중").length;
  return (
    <div className="content">
      <div className="grid4 g-20 mb24" style={{gap:20,marginBottom:24}}>
        <StatCard label="총 사용자" value={`${totalUsers}명`} sub={`학생 ${studentCount} / 교사 ${teacherCount}`} color={TDS.blue500} />
        <StatCard label="오늘 신규 가입" value="12명" sub="전일 대비 +3" color={TDS.success} />
        <StatCard label="신고 처리 대기" value={`${pendingReports}건`} sub={pendingReports?"즉시 처리 필요":"모두 처리됨"} color={TDS.danger} />
        <StatCard label="교사 검증 대기" value={`${pendingTeacherApps}건`} sub={pendingTeacherApps?"검토 필요":"대기 없음"} color={TDS.warning} />
      </div>
      <div className="grid2 g-20 mb24" style={{gap:20,marginBottom:24}}>
        <Card>
          <div className="card-hdr"><span className="card-title">시스템 헬스</span><Btn v="ghost" s="sm" onClick={()=>onNav("A13")}>상세 →</Btn></div>
          <div className="grid2 g-10" style={{gap:10}}>
            {services.map(sv=>(
              <div key={sv.n} style={{padding:"12px 14px",background:TDS.bgTertiary,borderRadius:10}}>
                <div className="row g-8 mb4" style={{gap:8,marginBottom:4}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:sv.st==="정상"?TDS.success:TDS.warning}} />
                  <span style={{fontSize:13,fontWeight:600,color:TDS.textPrimary}}>{sv.n}</span>
                </div>
                <div style={{fontSize:11,color:TDS.textTertiary}}>{sv.st} · {sv.uptime}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="card-title mb16" style={{marginBottom:16}}>주요 지표</div>
          <div className="grid2 g-14" style={{gap:14}}>
            {[["오늘 API 요청","48,291건"],["활성 세션","234개"],["평균 응답시간","142ms"],["에러율","0.03%"],["ML 작업 큐","12건 대기"],["STT 처리중","3건"]].map(([l,v])=>(
              <div key={l}><div style={{fontSize:11,color:TDS.textTertiary,marginBottom:3}}>{l}</div><div style={{fontSize:18,fontWeight:700}}>{v}</div></div>
            ))}
          </div>
        </Card>
      </div>
      <div className="grid2 g-20 mb24" style={{gap:20,marginBottom:24}}>
        <Card>
          <div className="card-hdr"><div className="row g-8" style={{gap:8}}><span className="card-title">신고 처리 큐</span><span className="badge-num">{pendingReports}</span></div><Btn v="ghost" s="sm" onClick={()=>onNav("A08")}>전체 보기</Btn></div>
          {state.reports.slice(0,3).map((r)=>(
            <div key={r.id} className="list-row" style={{cursor:"pointer"}} onClick={()=>onNav("A08")}>
              <div className="list-row-left"><div className="list-row-title">{r.reason||r.type||"신고"}</div><div className="list-row-sub">{r.author?`${r.author}의 코멘트`:r.target||"—"}</div></div>
              <Badge t={(r.status||"검토 중")==="처리됨"?"grey":"red"}>{r.status||"검토 중"}</Badge>
            </div>
          ))}
          {!state.reports.length && <div style={{padding:"20px 0",textAlign:"center",color:TDS.textTertiary,fontSize:13}}>대기 중인 신고가 없습니다</div>}
        </Card>
        <Card>
          <div className="card-hdr"><span className="card-title">교사 자격 검증 큐</span><Btn v="ghost" s="sm" onClick={()=>onNav("A06")}>전체 보기</Btn></div>
          {state.teacherApplications.length ? state.teacherApplications.slice(0,3).map((t)=>(
            <div key={t.id} className="list-row">
              <Av name={(t.name||"?")[0]} size="sm" />
              <div className="list-row-left"><div className="list-row-title">{t.name}</div><div className="list-row-sub">{t.school} {t.subject}</div></div>
              <Badge t={t.status==="승인됨"?"green":t.status==="반려됨"?"red":"orange"}>{t.status}</Badge>
            </div>
          )) : (
            [["김민준 교사","서울고등학교 수학"],["박재원 교사","대전고 과학"]].map(([n,school])=>(
              <div key={n} className="list-row">
                <Av name={n[0]} size="sm" />
                <div className="list-row-left"><div className="list-row-title">{n}</div><div className="list-row-sub">{school}</div></div>
                <Btn v="primary" s="sm" onClick={()=>onNav("A06")}>검토</Btn>
              </div>
            ))
          )}
        </Card>
      </div>
      <Card>
        <div style={{padding:"0 0 16px"}}><div className="card-title">시스템 로그</div></div>
        {[["INFO","API","GET /v1/students/me/graph — 142ms"],["WARN","Redis","메모리 사용량 75% 초과"],["INFO","ML","양자컴퓨팅 시드 처리 완료 (job_id: abc123)"],["ERROR","DB","Connection pool exhausted — retrying..."]].map(([lv,svc,msg],i)=>(
          <div key={i} className="log-item">
            <span className={`log-lv log-${lv==="INFO"?"info":lv==="WARN"?"warn":"error"}`}>{lv}</span>
            <span style={{color:TDS.blue500,fontWeight:600}}>[{svc}]</span>
            <span style={{color:TDS.textSecondary}}>{msg}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

function A02({ onNav }) {
  const { state, actions } = useStore();
  const users = state.adminUsers;
  const [ft, setFt] = useState("전체");
  const [q, setQ] = useState("");
  useEffect(()=>{ if(!users.length) actions.loadAdminUsers(); /* eslint-disable-next-line */ }, []);

  const stType={활성:"green",정지됨:"orange",삭제됨:"red"};
  const counts = {
    전체:users.length,
    학생:users.filter(u=>u.role==="학생").length,
    교사:users.filter(u=>u.role==="교사").length,
    정지됨:users.filter(u=>u.status==="정지됨").length,
    삭제됨:users.filter(u=>u.status==="삭제됨").length,
  };
  const filtered = users
    .filter(u=> ft==="전체" ? true : (ft==="학생"||ft==="교사") ? u.role===ft : u.status===ft)
    .filter(u=> !q.trim() || (u.name+u.email).toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="content">
      <div className="row-between mb16" style={{marginBottom:16}}><div className="sec-title">사용자 관리</div></div>
      <div className="row g-12 mb16" style={{gap:12,marginBottom:16}}>
        <div className="tab-pill-wrap">
          {[["전체",counts.전체],["학생",counts.학생],["교사",counts.교사],["정지됨",counts.정지됨],["삭제됨",counts.삭제됨]].map(([t,c])=>(
            <div key={t} className={`tab-pill${ft===t?" active":""}`} onClick={()=>setFt(t)}>{t} ({c})</div>
          ))}
        </div>
        <div style={{flex:1}} />
        <div className="search-wrap" style={{width:240}}><span>🔍</span><input placeholder="이름, 이메일 검색..." value={q} onChange={e=>setQ(e.target.value)} /></div>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>이름</th><th>이메일</th><th>역할</th><th>가입일</th><th>상태</th><th>마지막 로그인</th><th>처리</th></tr></thead>
          <tbody>
            {filtered.map(u=>(
              <tr key={u.id}>
                <td><div className="row g-8" style={{gap:8}}><Av name={u.name[0]} size="xs"/>{u.name}</div></td>
                <td style={{color:TDS.textTertiary}}>{u.email}</td>
                <td><Badge t={u.role==="교사"?"blue":"grey"}>{u.role}</Badge></td>
                <td style={{color:TDS.textTertiary}}>{u.joined}</td>
                <td><Badge t={stType[u.status]}>{u.status}</Badge></td>
                <td style={{color:TDS.textTertiary}}>{u.lastLogin}</td>
                <td>
                  {u.status==="삭제됨" ? (
                    <span style={{fontSize:12,color:TDS.textTertiary}}>—</span>
                  ) : (
                    <div className="row g-8" style={{gap:6}}>
                      {u.status==="정지됨"
                        ? <Btn v="secondary" s="sm" onClick={()=>actions.restoreUser(u.id)} style={{color:TDS.success}}>정지 해제</Btn>
                        : <Btn v="secondary" s="sm" onClick={()=>actions.suspendUser(u.id,"관리자 조치")} style={{color:TDS.warning}}>정지</Btn>}
                      <Btn v="secondary" s="sm" onClick={()=>actions.deleteUser(u.id)} style={{color:TDS.danger}}>삭제</Btn>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={7} style={{textAlign:"center",padding:"32px 0",color:TDS.textTertiary}}>조건에 맞는 사용자가 없습니다</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="row-between mt16" style={{marginTop:14}}>
        <span style={{fontSize:13,color:TDS.textTertiary}}>총 {filtered.length}명 표시</span>
      </div>
    </div>
  );
}

function A13({ onNav }) {
  const services=[
    {n:"API 서버",st:"정상",c:TDS.success,up:"99.98%",resp:"142ms",req:"48,291"},
    {n:"ML 파이프라인",st:"정상",c:TDS.success,up:"99.95%",resp:"8.3s",req:"1,203"},
    {n:"STT 서버",st:"정상",c:TDS.success,up:"99.90%",resp:"2.1s",req:"342"},
    {n:"Redis 캐시",st:"경고",c:TDS.warning,up:"99.82%",resp:"0.8ms",req:"892K"},
    {n:"PostgreSQL",st:"정상",c:TDS.success,up:"100%",resp:"12ms",req:"128K"},
    {n:"임베딩 모델",st:"정상",c:TDS.success,up:"99.97%",resp:"1.2s",req:"892"},
  ];
  return (
    <div className="content">
      <Notice type="success" className="mb24"><TFI>✅</TFI> 모든 시스템 정상 운영 중 · 마지막 확인: 2026.06.02 15:47:23</Notice>
      <div className="grid3 g-16 mb24" style={{gap:16,marginBottom:24}}>
        {services.map(sv=>(
          <Card key={sv.n}>
            <div className="row g-8 mb12" style={{gap:8,marginBottom:12}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:sv.c}} />
              <span style={{fontSize:15,fontWeight:700}}>{sv.n}</span>
              <Badge t={sv.st==="정상"?"green":"orange"}>{sv.st}</Badge>
            </div>
            <div className="grid3 g-8" style={{gap:8}}>
              {[["업타임",sv.up],["응답",sv.resp],["오늘",sv.req]].map(([l,v])=>(
                <div key={l}><div style={{fontSize:10,color:TDS.textTertiary}}>{l}</div><div style={{fontSize:13,fontWeight:700}}>{v}</div></div>
              ))}
            </div>
            <div className="prog-wrap mt12" style={{marginTop:12}}>
              <div className="prog-fill" style={{width:sv.st==="경고"?"78%":"95%",background:sv.c}} />
            </div>
          </Card>
        ))}
      </div>
      <Card>
        <div className="card-hdr"><div className="card-title">시스템 로그</div><Btn v="ghost" s="sm" onClick={()=>onNav("A21")}>감사 로그 →</Btn></div>
        {[["INFO","API","GET /v1/students/me/graph — 142ms"],["WARN","Redis","메모리 사용량 75% 초과 경보"],["INFO","ML","양자컴퓨팅 시드 처리 완료"],["ERROR","DB","Connection pool exhausted — retrying..."]].map(([lv,svc,msg],i)=>(
          <div key={i} className="log-item">
            <span className={`log-lv log-${lv==="INFO"?"info":lv==="WARN"?"warn":"error"}`}>{lv}</span>
            <span style={{color:TDS.blue500,fontWeight:600}}>[{svc}]</span>
            <span style={{color:TDS.textSecondary}}>{msg}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

function A21({ onNav }) {
  const logs=[
    {who:"관리자",ac:"user.suspend",tgt:"이수진 (teacher)",sv:"high",t:"15분 전"},
    {who:"admin_kim",ac:"user.list.read",tgt:"전체 목록",sv:"low",t:"1시간 전"},
    {who:"관리자",ac:"teacher.verify.approve",tgt:"김민준",sv:"medium",t:"2시간 전"},
    {who:"admin_lee",ac:"system.config.read",tgt:"ML 모델 설정",sv:"low",t:"3시간 전"},
    {who:"관리자",ac:"comment.force_delete",tgt:"코멘트 #4729",sv:"high",t:"어제"},
  ];
  const svType={high:"red",medium:"orange",low:"grey"};
  return (
    <div className="content">
      <div className="row-between mb16" style={{marginBottom:16}}>
        <div className="sec-title">감사 로그</div>
        <Btn v="ghost" s="sm" onClick={()=>onNav("A23")}>내보내기</Btn>
      </div>
      <div className="row g-12 mb16" style={{gap:12,marginBottom:16}}>
        <div className="search-wrap" style={{flex:1}}><span>🔍</span><input placeholder="관리자, 액션, 대상 검색..." /></div>
        <input className="inp" style={{width:200}} type="date" defaultValue="2026-06-02" />
        <select className="inp" style={{width:160}}>
          <option>모든 심각도</option><option>High</option><option>Medium</option><option>Low</option>
        </select>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>관리자</th><th>액션</th><th>대상</th><th>심각도</th><th>시각</th></tr></thead>
          <tbody>
            {logs.map((l,i)=>(
              <tr key={i} style={{cursor:"pointer"}} onClick={()=>onNav("A22")}>
                <td><div className="row g-8" style={{gap:8}}><Av name={l.who[0]} size="xs"/>{l.who}</div></td>
                <td><code style={{fontSize:12,background:TDS.bgTertiary,padding:"2px 6px",borderRadius:4}}>{l.ac}</code></td>
                <td style={{color:TDS.textSecondary}}>{l.tgt}</td>
                <td><Badge t={svType[l.sv]}>{l.sv}</Badge></td>
                <td style={{color:TDS.textTertiary}}>{l.t}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Admin 미구현 화면들 ── */

/* A03 사용자 상세 */
function A03({ onNav }) {
  const user={id:"U-1024",name:"이수진",email:"sujin@school.ac.kr",role:"교사",status:"정지됨",joined:"2025-11-01",lastLogin:"2026-01-19",nodes:1204,tier:"T1"};
  return (
    <div className="content">
      <div className="row-between mb16" style={{marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>onNav("A02")}>← 목록</button>
          <div className="sec-title">{user.name} 상세</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn v="secondary" s="sm" onClick={()=>onNav("A04")}>정지/해제</Btn>
          <Btn v="danger" s="sm" onClick={()=>onNav("A05")}>강제 삭제 [T2]</Btn>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"280px 1fr",gap:16}}>
        <div className="card card-p">
          <div style={{textAlign:"center",marginBottom:16}}>
            <div style={{width:72,height:72,borderRadius:"50%",background:TDS.success,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:30,fontWeight:700,margin:"0 auto 12px"}}>{user.name[0]}</div>
            <div style={{fontSize:18,fontWeight:700}}>{user.name}</div>
            <div style={{fontSize:13,color:TDS.textTertiary}}>{user.email}</div>
            <div style={{marginTop:8,padding:"3px 12px",borderRadius:20,background:TDS.dangerBg,color:TDS.danger,fontSize:12,fontWeight:600,display:"inline-block"}}>{user.status}</div>
          </div>
          {[["역할",user.role],["가입일",user.joined],["마지막 로그인",user.lastLogin],["총 노드",`${user.nodes.toLocaleString()}개`],["사용자 ID",user.id]].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${TDS.bgTertiary}`,fontSize:13}}>
              <span style={{color:TDS.textTertiary}}>{k}</span><span style={{fontWeight:500}}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div className="card card-p">
            <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>교사 자격 정보</div>
            <div style={{padding:"12px",background:TDS.warningBg,borderRadius:8,fontSize:13,color:TDS.warning}}>⚠️ 자격 정지 상태 - A04에서 해제 가능</div>
          </div>
          <div className="card card-p">
            <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>최근 감사 로그</div>
            {[["user.suspend","계정 정지 처리","high","1일 전"],["teacher.verify.approve","자격 검증 승인","medium","15일 전"]].map(([ac,d,sv,t])=>(
              <div key={ac} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:`1px solid ${TDS.bgTertiary}`,fontSize:13}}>
                <code style={{fontSize:11,background:TDS.bgTertiary,padding:"2px 6px",borderRadius:4,flexShrink:0}}>{ac}</code>
                <span style={{color:TDS.textSecondary,flex:1}}>{d}</span>
                <span style={{color:TDS.textTertiary}}>{t}</span>
              </div>
            ))}
          </div>
          <div className="card card-p">
            <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>담당 학생 ({user.role==="교사"?"3명":"-"})</div>
            {user.role==="교사"?["김학생 (2학년 3반)","이학생 (2학년 5반)","박학생 (3학년 1반)"].map(s=>(
              <div key={s} style={{padding:"6px 0",borderBottom:`1px solid ${TDS.bgTertiary}`,fontSize:13,color:TDS.textSecondary}}>{s}</div>
            )):<div style={{color:TDS.textTertiary,fontSize:13}}>해당 없음 (학생 계정)</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* A04 계정 정지·해제 */
function A04({ onNav }) {
  const [step, setStep] = useState(0);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("7일");
  const isSuspended = false;
  return (
    <div className="content" style={{maxWidth:560,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("A03")}>← 사용자 상세</button>
        <div style={{fontSize:20,fontWeight:700}}>계정 {isSuspended?"해제":"정지"}</div>
      </div>
      {step===0&&(
        <>
          <div className="card card-p" style={{marginBottom:16}}>
            <div style={{display:"flex",gap:12,marginBottom:16}}>
              <Av name="이" size="sm" />
              <div><div style={{fontWeight:700}}>이수진</div><div style={{fontSize:12,color:TDS.textTertiary}}>sujin@school.ac.kr · 교사</div></div>
            </div>
            {!isSuspended&&(
              <>
                <div className="inp-group"><label className="inp-label">정지 기간</label>
                  <select className="inp" value={duration} onChange={e=>setDuration(e.target.value)}>
                    {["3일","7일","14일","30일","무기한"].map(d=><option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="inp-group"><label className="inp-label">정지 사유 (필수)</label>
                  <textarea className="inp" rows={3} placeholder="사유를 입력하세요..." value={reason} onChange={e=>setReason(e.target.value)} />
                </div>
              </>
            )}
            {isSuspended&&<Notice type="warning">현재 정지 상태입니다. 해제하면 즉시 로그인이 가능해집니다.</Notice>}
          </div>
          <Notice type="danger" style={{marginBottom:16}}>이 액션은 감사 로그에 기록됩니다.</Notice>
          <div style={{display:"flex",gap:8}}>
            <Btn v="secondary" s="md" fw onClick={()=>onNav("A03")}>취소</Btn>
            <Btn v={isSuspended?"primary":"danger"} s="md" fw disabled={!isSuspended&&!reason} onClick={()=>setStep(1)}>
              {isSuspended?"계정 해제 확인":"정지 확인"}
            </Btn>
          </div>
        </>
      )}
      {step===1&&(
        <div className="card card-p" style={{textAlign:"center",padding:"40px 24px"}}>
          <TFI s={48}>{isSuspended?"✅":"🚫"}</TFI>
          <div style={{fontSize:18,fontWeight:700,marginTop:16,marginBottom:8}}>계정 {isSuspended?"해제":"정지"}가 완료되었습니다</div>
          <div style={{fontSize:13,color:TDS.textTertiary,marginBottom:24}}>사유: {reason||"해제 처리"} · 기간: {!isSuspended?duration:"—"}</div>
          <Btn v="primary" s="md" onClick={()=>onNav("A02")}>목록으로</Btn>
        </div>
      )}
    </div>
  );
}

/* A05 강제 삭제 [T2] */
function A05({ onNav }) {
  const [step, setStep] = useState(0);
  const [reason, setReason] = useState("");
  const [mfa, setMfa] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const steps=["1차 확인","사유 입력","MFA 재인증","최종 확인","실행"];
  return (
    <div className="content" style={{maxWidth:560,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("A03")}>← 사용자 상세</button>
        <div style={{fontSize:20,fontWeight:700,color:TDS.danger}}>강제 삭제 [Tier 2]</div>
      </div>
      <Notice type="danger" style={{marginBottom:20}}>
        <div style={{fontWeight:700,marginBottom:6}}>⚠️ admin.investigation 등급 작업</div>
        보안팀에 즉시 통보됩니다. 모든 단계가 감사 로그에 기록됩니다.
      </Notice>
      {/* 5단계 진행 표시 */}
      <div style={{display:"flex",gap:4,marginBottom:24}}>
        {steps.map((s,i)=>(
          <div key={i} style={{flex:1,height:4,borderRadius:2,background:i<=step?TDS.danger:TDS.borderDefault,transition:"background .3s"}} />
        ))}
      </div>
      {step===0&&(
        <div className="card card-p">
          <div style={{fontSize:15,fontWeight:700,marginBottom:12}}>1단계: 삭제 대상 확인</div>
          <div style={{padding:"12px",background:TDS.dangerBg,borderRadius:8,marginBottom:16}}>
            <div style={{fontWeight:700,color:TDS.danger,marginBottom:4}}>이수진 (sujin@school.ac.kr)</div>
            <div style={{fontSize:13,color:TDS.danger}}>교사 · 노드 1,204개 · 가입 2025-11-01</div>
          </div>
          <div style={{fontSize:13,color:TDS.textTertiary,marginBottom:16,lineHeight:1.6}}>이 작업은 사용자의 모든 데이터를 즉시 삭제합니다. 30일 복구 유예가 없으며 즉시 crypto-shredding이 실행됩니다.</div>
          <Btn v="danger" s="md" fw onClick={()=>setStep(1)}>다음 단계</Btn>
        </div>
      )}
      {step===1&&(
        <div className="card card-p">
          <div style={{fontSize:15,fontWeight:700,marginBottom:12}}>2단계: 삭제 사유 입력 (X-Investigation-Reason)</div>
          <div className="inp-group"><label className="inp-label">사유 (필수)</label>
            <textarea className="inp" rows={4} placeholder="강제 삭제 사유를 상세히 입력하세요..." value={reason} onChange={e=>setReason(e.target.value)} />
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn v="secondary" s="sm" onClick={()=>setStep(0)}>이전</Btn>
            <Btn v="danger" s="sm" disabled={reason.length<10} onClick={()=>setStep(2)}>다음 단계</Btn>
          </div>
        </div>
      )}
      {step===2&&(
        <div className="card card-p">
          <div style={{fontSize:15,fontWeight:700,marginBottom:12}}>3단계: MFA 재인증</div>
          <div className="inp-group"><label className="inp-label">인증 코드 (6자리)</label>
            <input className="inp" placeholder="000000" maxLength={6} value={mfa} onChange={e=>setMfa(e.target.value)} />
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn v="secondary" s="sm" onClick={()=>setStep(1)}>이전</Btn>
            <Btn v="danger" s="sm" disabled={mfa.length!==6} onClick={()=>setStep(3)}>인증 확인</Btn>
          </div>
        </div>
      )}
      {step===3&&(
        <div className="card card-p">
          <div style={{fontSize:15,fontWeight:700,marginBottom:12,color:TDS.danger}}>4단계: 최종 확인 — 되돌릴 수 없습니다</div>
          <div style={{padding:"16px",background:TDS.dangerBg,borderRadius:8,marginBottom:16,fontSize:13,color:TDS.danger,lineHeight:1.7}}>
            이수진 (sujin@school.ac.kr)의 모든 데이터가 즉시 삭제됩니다.<br/>
            보안팀에 Slack + 이메일로 즉시 통보됩니다.<br/>
            audit_logs.severity = critical로 기록됩니다.
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
            <input type="checkbox" id="final-confirm" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} />
            <label htmlFor="final-confirm" style={{fontSize:13,color:TDS.danger,fontWeight:600}}>위 내용을 이해했으며 영구 삭제를 실행합니다</label>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn v="secondary" s="sm" onClick={()=>setStep(2)}>이전</Btn>
            <Btn v="danger" s="sm" disabled={!confirmed} onClick={()=>setStep(4)}>강제 삭제 실행</Btn>
          </div>
        </div>
      )}
      {step===4&&(
        <div className="card card-p" style={{textAlign:"center",padding:"40px 24px"}}>
          <TFI s={48}>✅</TFI>
          <div style={{fontSize:18,fontWeight:700,marginTop:16,marginBottom:8}}>강제 삭제 완료</div>
          <div style={{fontSize:13,color:TDS.textTertiary,marginBottom:24}}>보안팀에 통보 완료 · 감사 로그 기록 완료</div>
          <Btn v="primary" s="md" onClick={()=>onNav("A02")}>사용자 목록으로</Btn>
        </div>
      )}
    </div>
  );
}

/* A06 교사 자격 검증 큐 */
function A06({ onNav }) {
  const { state, actions } = useStore();
  const mockQueue=[
    {id:"tapp_m1",name:"김선생",school:"○○고",subject:"물리학",submittedAt:Date.parse("2026-01-20"),docs:2,status:"검토 중"},
    {id:"tapp_m2",name:"박교사",school:"△△고",subject:"수학",submittedAt:Date.parse("2026-01-19"),docs:2,status:"검토 중"},
    {id:"tapp_m3",name:"이강사",school:"□□중",subject:"화학",submittedAt:Date.parse("2026-01-18"),docs:1,status:"검토 중"},
  ];
  // store 신청(교사가 T01에서 제출한 것) 우선 + 목업 큐
  const queue = [...state.teacherApplications, ...mockQueue];
  const pending = queue.filter(q=>q.status==="검토 중").length;
  return (
    <div className="content">
      <div className="row-between mb16" style={{marginBottom:16}}>
        <div className="sec-title">교사 자격 검증 큐 ({pending}건 대기)</div>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>신청자</th><th>소속</th><th>교과목</th><th>신청일</th><th>서류</th><th>상태</th><th>처리</th></tr></thead>
          <tbody>
            {queue.map((q)=>(
              <tr key={q.id}>
                <td><div style={{display:"flex",gap:8,alignItems:"center"}}><Av name={(q.name||"?")[0]} size="xs"/>{q.name}</div></td>
                <td style={{color:TDS.textSecondary}}>{q.school}</td>
                <td style={{color:TDS.textSecondary}}>{q.subject}</td>
                <td style={{color:TDS.textTertiary}}>{q.submittedAt?new Date(q.submittedAt).toISOString().slice(0,10):"—"}</td>
                <td><Badge t="blue">{q.docs||1}개</Badge></td>
                <td><Badge t={q.status==="승인됨"?"green":q.status==="반려됨"?"red":"orange"}>{q.status}</Badge></td>
                <td>
                  {q.status==="검토 중" ? (
                    <div className="row g-8" style={{gap:6}}>
                      <Btn v="primary" s="sm" onClick={()=>actions.approveTeacherApp(q.id,true)}>승인</Btn>
                      <Btn v="secondary" s="sm" style={{color:TDS.danger}} onClick={()=>actions.approveTeacherApp(q.id,false)}>반려</Btn>
                    </div>
                  ) : <span style={{fontSize:12,color:TDS.textTertiary}}>완료</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* A07 교사 자격 상세 검토 */
function A07({ onNav }) {
  const [decision,setDecision]=useState(null);
  return (
    <div className="content" style={{maxWidth:640,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("A06")}>← 큐</button>
        <div style={{fontSize:20,fontWeight:700}}>자격 상세 검토</div>
      </div>
      {decision&&<Notice type={decision==="approve"?"success":"danger"} style={{marginBottom:16}}>{decision==="approve"?"✅ 승인 완료":"❌ 거부 완료"} — 감사 로그 기록됨</Notice>}
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{display:"flex",gap:12,marginBottom:16}}>
          <Av name="김" size="md" />
          <div><div style={{fontSize:16,fontWeight:700}}>김선생</div><div style={{fontSize:13,color:TDS.textTertiary}}>teacher@school.ac.kr · 신청 2026-01-20</div></div>
        </div>
        {[["소속 학교","○○고등학교"],["교과목","물리학"],["교원 자격증 번호","KR-EDU-2020-XXXXX"]].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${TDS.bgTertiary}`,fontSize:13}}>
            <span style={{color:TDS.textTertiary}}>{k}</span><span style={{fontWeight:500}}>{v}</span>
          </div>
        ))}
      </div>
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>첨부 서류</div>
        {[["📎 교원자격증.pdf","428 KB","PDF"],["📎 재직증명서_2026.pdf","215 KB","PDF"]].map(([n,sz,t])=>(
          <div key={n} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",background:TDS.bgSecondary,borderRadius:8,marginBottom:8}}>
            <TFI s={20}>{n.split(" ")[0]}</TFI>
            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{n.split(" ").slice(1).join(" ")}</div><div style={{fontSize:11,color:TDS.textTertiary}}>{sz} · {t}</div></div>
            <Btn v="ghost" s="sm">열기</Btn>
          </div>
        ))}
      </div>
      <div className="inp-group"><label className="inp-label">검토 메모</label><textarea className="inp" rows={2} placeholder="내부 메모..." /></div>
      <div style={{display:"flex",gap:8,marginTop:16}}>
        <Btn v="danger" s="md" fw disabled={!!decision} onClick={()=>{setDecision("reject");setTimeout(()=>onNav("A06"),1500);}}>거부</Btn>
        <Btn v="primary" s="md" fw disabled={!!decision} onClick={()=>{setDecision("approve");setTimeout(()=>onNav("A06"),1500);}}>승인</Btn>
      </div>
    </div>
  );
}

/* A08 신고 큐 */
function A08({ onNav }) {
  const { state, actions } = useStore();
  useEffect(()=>{ if(!state.reports.length) actions.loadReports(); /* eslint-disable-next-line */ }, []);

  // store 신고(학생이 S24에서 신고한 것 포함) → 표 행으로 정규화
  const rows = state.reports.map(r=>({
    id:r.id,
    type:r.reason || r.type || "신고",
    reporter:r.reporter || "학생",
    target:r.content ? `${r.author||""}의 코멘트: "${(r.content||"").slice(0,20)}…"` : (r.target||"—"),
    date:r.date || new Date().toISOString().slice(0,10),
    priority:r.priority || (String(r.reason||"").includes("개인정보")?"high":"medium"),
    status:r.status || "검토 중",
  }));
  const highCount = rows.filter(r=>r.priority==="high").length;

  return (
    <div className="content">
      <div className="row-between mb16" style={{marginBottom:16}}>
        <div className="sec-title">신고 큐 ({rows.length}건)</div>
        <div style={{display:"flex",gap:8}}>
          {highCount>0 && <Badge t="red">고우선순위 {highCount}건</Badge>}
        </div>
      </div>
      {!rows.length && <div style={{textAlign:"center",padding:"48px 0",color:TDS.textTertiary,fontSize:14}}>처리할 신고가 없습니다</div>}
      {!!rows.length && (
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>신고 ID</th><th>유형</th><th>신고자</th><th>대상</th><th>신고일</th><th>우선순위</th><th>상태</th><th>처리</th></tr></thead>
          <tbody>
            {rows.map((r)=>(
              <tr key={r.id}>
                <td><code style={{fontSize:11}}>{r.id}</code></td>
                <td><Badge t={String(r.type).includes("개인정보")?"red":"grey"}>{r.type}</Badge></td>
                <td style={{color:TDS.textSecondary}}>{r.reporter}</td>
                <td style={{color:TDS.textTertiary,fontSize:12}}>{r.target}</td>
                <td style={{color:TDS.textTertiary}}>{r.date}</td>
                <td><Badge t={r.priority==="high"?"red":"orange"}>{r.priority}</Badge></td>
                <td><Badge t={r.status==="처리됨"?"green":"grey"}>{r.status}</Badge></td>
                <td>
                  {r.status==="처리됨"
                    ? <span style={{fontSize:12,color:TDS.textTertiary}}>완료</span>
                    : <Btn v="primary" s="sm" onClick={()=>actions.resolveReport(r.id,"처리")}>처리</Btn>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

/* A09 신고 상세·처리 */
function A09({ onNav }) {
  const [decision,setDecision]=useState(null);
  return (
    <div className="content" style={{maxWidth:640,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("A08")}>← 큐</button>
        <div style={{fontSize:20,fontWeight:700}}>신고 상세·처리</div>
      </div>
      {decision&&<Notice type={decision==="dismiss"?"warning":"danger"} style={{marginBottom:16}}>{decision==="dismiss"?"신고가 기각되었습니다":"처리 완료 — 해당 코멘트가 삭제되었습니다"}</Notice>}
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
          <div style={{fontWeight:700}}>R-001 · 부적절 코멘트</div>
          <Badge t="red">high</Badge>
        </div>
        {[["신고자","홍길동 (학생)"],["신고일","2026-01-20 14:32"],["대상","박교사의 코멘트 #4729"]].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${TDS.bgTertiary}`,fontSize:13}}>
            <span style={{color:TDS.textTertiary}}>{k}</span><span>{v}</span>
          </div>
        ))}
      </div>
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>신고된 코멘트 내용</div>
        <div style={{padding:"12px",background:TDS.dangerBg,borderRadius:8,fontSize:13,color:TDS.textPrimary,borderLeft:`4px solid ${TDS.danger}`}}>
          "이 정도 수준으로는 대학교도 못 가겠다. 공부 그만해."
        </div>
      </div>
      <div className="inp-group"><label className="inp-label">처리 메모</label><textarea className="inp" rows={2} placeholder="처리 사유..." /></div>
      <div style={{display:"flex",gap:8,marginTop:16}}>
        <Btn v="ghost" s="md" fw disabled={!!decision} onClick={()=>setDecision("dismiss")}>기각</Btn>
        <Btn v="secondary" s="md" fw disabled={!!decision} onClick={()=>onNav("A10")}>코멘트 검토</Btn>
        <Btn v="danger" s="md" fw disabled={!!decision} onClick={()=>setDecision("delete")}>코멘트 삭제</Btn>
      </div>
    </div>
  );
}

/* A10 신고된 코멘트 목록 */
function A10({ onNav }) {
  const comments=[
    {id:"C-4729",author:"박교사",content:"이 정도 수준으로는...",reports:3,status:"검토 중"},
    {id:"C-4401",author:"김학생",content:"스팸 메시지입니다",reports:1,status:"검토 중"},
    {id:"C-4110",author:"이강사",content:"개인 연락처가 포함된...",reports:2,status:"삭제됨"},
  ];
  return (
    <div className="content">
      <div className="row-between mb16" style={{marginBottom:16}}>
        <div className="sec-title">신고된 코멘트</div>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>코멘트 ID</th><th>작성자</th><th>내용 (발췌)</th><th>신고 수</th><th>상태</th><th>처리</th></tr></thead>
          <tbody>
            {comments.map((c,i)=>(
              <tr key={i}>
                <td><code style={{fontSize:11}}>{c.id}</code></td>
                <td>{c.author}</td>
                <td style={{color:TDS.textSecondary,fontSize:12,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.content}</td>
                <td><Badge t="red">{c.reports}건</Badge></td>
                <td><Badge t={c.status==="삭제됨"?"grey":"orange"}>{c.status}</Badge></td>
                <td><Btn v={c.status==="삭제됨"?"ghost":"danger"} s="sm" disabled={c.status==="삭제됨"} onClick={()=>onNav("A11")}>삭제 확인</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* A11 코멘트 강제 삭제 확인 */
function A11({ onNav }) {
  const [done,setDone]=useState(false);
  return (
    <div className="content" style={{maxWidth:540,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("A10")}>← 목록</button>
        <div style={{fontSize:20,fontWeight:700}}>코멘트 강제 삭제 확인</div>
      </div>
      {done
        ? <div className="card card-p" style={{textAlign:"center",padding:"40px"}}><TFI s={48}>✅</TFI><div style={{fontSize:18,fontWeight:700,marginTop:16}}>삭제 완료</div><div style={{fontSize:13,color:TDS.textTertiary,marginTop:8,marginBottom:24}}>감사 로그에 기록되었습니다</div><Btn v="primary" s="md" onClick={()=>onNav("A10")}>목록으로</Btn></div>
        : <>
          <div className="card card-p" style={{marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>삭제 대상 코멘트</div>
            <div style={{padding:"12px",background:TDS.dangerBg,borderRadius:8,fontSize:13,color:TDS.textPrimary,borderLeft:`4px solid ${TDS.danger}`,marginBottom:12}}>
              "이 정도 수준으로는 대학교도 못 가겠다. 공부 그만해."
            </div>
            {[["작성자","박교사"],["작성일","2026-01-19 10:23"],["신고 수","3건"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:13}}>
                <span style={{color:TDS.textTertiary}}>{k}</span><span>{v}</span>
              </div>
            ))}
          </div>
          <Notice type="danger" style={{marginBottom:16}}>삭제 후 작성자에게 알림이 전송됩니다. 삭제된 코멘트는 30일 후 완전히 제거됩니다.</Notice>
          <div style={{display:"flex",gap:8}}>
            <Btn v="secondary" s="md" fw onClick={()=>onNav("A10")}>취소</Btn>
            <Btn v="danger" s="md" fw onClick={()=>setDone(true)}>삭제 실행</Btn>
          </div>
        </>
      }
    </div>
  );
}

/* A12 데이터 스냅샷 [T2] */
function A12({ onNav }) {
  const [step,setStep]=useState(0);
  const snaps=[
    {id:"SNAP-001",user:"홍길동",type:"전체",size:"12.4 MB",created:"2026-01-15",expires:"2026-02-14"},
    {id:"SNAP-002",user:"이수진",type:"그래프",size:"3.2 MB",created:"2026-01-10",expires:"2026-02-09"},
  ];
  return (
    <div className="content">
      <div className="row-between mb16" style={{marginBottom:16}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}><div className="sec-title">데이터 스냅샷</div><Badge t="red">[T2]</Badge></div>
        <Btn v="danger" s="sm" onClick={()=>setStep(step===0?1:0)}>{step===0?"신규 스냅샷":"취소"}</Btn>
      </div>
      {step===1&&(
        <div className="card card-p" style={{marginBottom:16,border:`1px solid ${TDS.danger}`}}>
          <Notice type="danger" style={{marginBottom:16}}>스냅샷 생성은 감사 로그에 기록됩니다. (admin.investigation 등급)</Notice>
          <div className="inp-group"><label className="inp-label">대상 사용자</label><input className="inp" placeholder="사용자 ID 또는 이메일..." /></div>
          <div className="inp-group"><label className="inp-label">스냅샷 범위</label>
            <select className="inp"><option>전체 데이터</option><option>그래프</option><option>문서</option><option>음성</option></select>
          </div>
          <div className="inp-group"><label className="inp-label">사유 (X-Investigation-Reason)</label><textarea className="inp" rows={2} placeholder="스냅샷 생성 사유..." /></div>
          <Btn v="danger" s="sm" fw onClick={()=>setStep(0)}>스냅샷 생성</Btn>
        </div>
      )}
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>스냅샷 ID</th><th>사용자</th><th>범위</th><th>크기</th><th>생성일</th><th>만료일</th><th>다운로드</th></tr></thead>
          <tbody>
            {snaps.map((s,i)=>(
              <tr key={i}>
                <td><code style={{fontSize:11}}>{s.id}</code></td>
                <td>{s.user}</td>
                <td><Badge t="blue">{s.type}</Badge></td>
                <td style={{color:TDS.textTertiary}}>{s.size}</td>
                <td style={{color:TDS.textTertiary}}>{s.created}</td>
                <td style={{color:TDS.warning}}>{s.expires}</td>
                <td><Btn v="primary" s="sm">다운로드</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* A14 운영 메트릭 */
function A14({ onNav }) {
  const metrics=[
    {label:"일평균 API 요청",value:"247,832",trend:"+12%",color:TDS.blue500},
    {label:"P95 응답 시간",value:"142ms",trend:"-8ms",color:TDS.success},
    {label:"에러율",value:"0.03%",trend:"-0.01%",color:TDS.success},
    {label:"동시 활성 사용자",value:"1,284",trend:"+87",color:TDS.blue500},
    {label:"ML 처리 대기열",value:"23개",trend:"+5",color:TDS.warning},
    {label:"스토리지 사용량",value:"2.4 TB / 10 TB",trend:"+0.1 TB",color:TDS.textPrimary},
  ];
  const endpoints=[
    {path:"/v1/graph/nodes",rps:824,p95:"89ms",err:"0.01%"},
    {path:"/v1/voice/sessions",rps:312,p95:"234ms",err:"0.05%"},
    {path:"/v1/format/generate",rps:156,p95:"1.2s",err:"0.12%"},
    {path:"/v1/auth/login",rps:89,p95:"320ms",err:"0.08%"},
  ];
  return (
    <div className="content">
      <div className="sec-title mb16" style={{marginBottom:16}}>운영 메트릭</div>
      <div className="grid4 mb24" style={{marginBottom:24}}>
        {metrics.map(m=>(
          <div key={m.label} className="card card-p" style={{position:"relative"}}>
            <div style={{fontSize:12,color:TDS.textTertiary,marginBottom:6}}>{m.label}</div>
            <div style={{fontSize:22,fontWeight:700,color:m.color}}>{m.value}</div>
            <div style={{fontSize:11,color:m.trend.startsWith("-")||m.trend==="0.01%"?TDS.success:TDS.warning,marginTop:4}}>{m.trend}</div>
          </div>
        ))}
      </div>
      <div className="card card-p mb24" style={{marginBottom:24}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>엔드포인트별 트래픽</div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>엔드포인트</th><th>RPS</th><th>P95</th><th>에러율</th></tr></thead>
            <tbody>
              {endpoints.map((e,i)=>(
                <tr key={i}>
                  <td><code style={{fontSize:11}}>{e.path}</code></td>
                  <td style={{fontWeight:600}}>{e.rps}</td>
                  <td style={{color:parseInt(e.p95)>500?TDS.warning:TDS.success}}>{e.p95}</td>
                  <td><Badge t={parseFloat(e.err)>0.1?"orange":"grey"}>{e.err}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* A15 임베딩 모델 목록 */
function A15({ onNav }) {
  const models=[
    {name:"text-embedding-3-large",provider:"OpenAI",dim:3072,status:"활성",latency:"45ms",deployed:"2026-01-01"},
    {name:"bge-m3",provider:"BAAI",dim:1024,status:"대기",latency:"28ms",deployed:"—"},
    {name:"text-embedding-ada-002",provider:"OpenAI",dim:1536,status:"아카이브",latency:"52ms",deployed:"2025-06-01"},
  ];
  return (
    <div className="content">
      <div className="row-between mb16" style={{marginBottom:16}}>
        <div className="sec-title">임베딩 모델 목록</div>
        <Btn v="primary" s="sm" onClick={()=>onNav("A16")}>모델 교체</Btn>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>모델명</th><th>제공사</th><th>차원</th><th>레이턴시</th><th>상태</th><th>배포일</th></tr></thead>
          <tbody>
            {models.map((m,i)=>(
              <tr key={i} style={{background:m.status==="활성"?TDS.blue50:"transparent"}}>
                <td><div style={{fontWeight:m.status==="활성"?700:400}}>{m.name}</div></td>
                <td style={{color:TDS.textTertiary}}>{m.provider}</td>
                <td style={{fontWeight:600}}>{m.dim.toLocaleString()}</td>
                <td style={{color:parseInt(m.latency)>50?TDS.warning:TDS.success}}>{m.latency}</td>
                <td><Badge t={m.status==="활성"?"blue":m.status==="대기"?"orange":"grey"}>{m.status}</Badge></td>
                <td style={{color:TDS.textTertiary}}>{m.deployed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* A16 임베딩 모델 교체 */
function A16({ onNav }) {
  const [step,setStep]=useState(0);
  const [sel,setSel]=useState("bge-m3");
  return (
    <div className="content" style={{maxWidth:640,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("A15")}>← 목록</button>
        <div style={{fontSize:20,fontWeight:700}}>임베딩 모델 교체</div>
      </div>
      <Notice type="warning" style={{marginBottom:20}}>모델 교체 후 전체 노드 재임베딩이 수행됩니다. 처리 시간: 약 2~4시간 (노드 10만개 기준)</Notice>
      {step===0&&(
        <div className="card card-p">
          <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>새 모델 선택</div>
          {[{name:"bge-m3",provider:"BAAI",dim:1024,note:"다국어 지원, 빠른 추론"},
            {name:"text-embedding-3-small",provider:"OpenAI",dim:1536,note:"고품질, OpenAI API 필요"}].map(m=>(
            <div key={m.name} onClick={()=>setSel(m.name)} style={{padding:"12px",borderRadius:8,border:`1px solid ${sel===m.name?TDS.blue500:TDS.borderDefault}`,background:sel===m.name?TDS.blue50:"transparent",marginBottom:8,cursor:"pointer"}}>
              <div style={{fontWeight:600,fontSize:14}}>{m.name}</div>
              <div style={{fontSize:12,color:TDS.textTertiary}}>{m.provider} · {m.dim}차원 · {m.note}</div>
            </div>
          ))}
          <Btn v="primary" s="md" fw style={{marginTop:12}} onClick={()=>setStep(1)}>교체 시작</Btn>
        </div>
      )}
      {step===1&&(
        <div className="card card-p" style={{textAlign:"center",padding:"40px"}}>
          <div style={{fontSize:40,marginBottom:16}}>⚙️</div>
          <div style={{fontSize:18,fontWeight:700,marginBottom:8}}>재임베딩 진행 중</div>
          <div style={{height:8,background:TDS.bgTertiary,borderRadius:4,marginBottom:12,overflow:"hidden"}}><div style={{height:"100%",width:"34%",background:TDS.blue500,borderRadius:4,animation:"none"}} /></div>
          <div style={{fontSize:13,color:TDS.textTertiary}}>34% 완료 · 34,201 / 100,000 노드</div>
          <Btn v="secondary" s="sm" style={{marginTop:16}} onClick={()=>onNav("A15")}>백그라운드에서 계속</Btn>
        </div>
      )}
    </div>
  );
}

/* A17 시스템 공지 목록 */
function A17({ onNav }) {
  const { state, actions } = useStore();
  const notices = state.announcements;
  useEffect(()=>{ if(!notices.length) actions.loadAnnouncements(); /* eslint-disable-next-line */ }, []);
  const fmt = ts => ts ? new Date(ts).toISOString().slice(0,10) : "—";
  return (
    <div className="content">
      <div className="row-between mb16" style={{marginBottom:16}}>
        <div className="sec-title">시스템 공지 목록 ({notices.length})</div>
        <Btn v="primary" s="sm" onClick={()=>onNav("A18")}>+ 새 공지</Btn>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>ID</th><th>제목</th><th>대상</th><th>발행일</th><th>상태</th><th>수정</th></tr></thead>
          <tbody>
            {notices.map((n)=>(
              <tr key={n.id}>
                <td><code style={{fontSize:11}}>{n.id}</code></td>
                <td style={{fontWeight:500}}>{n.title}</td>
                <td style={{color:TDS.textTertiary}}>{n.target}</td>
                <td style={{color:TDS.textTertiary}}>{fmt(n.publishedAt)}</td>
                <td><Badge t={n.status==="발행됨"?"blue":n.status==="예약됨"?"orange":"grey"}>{n.status}</Badge></td>
                <td><Btn v="ghost" s="sm" onClick={()=>onNav("A18")}>편집</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* A18 공지 발행·편집 */
function A18({ onNav }) {
  const { actions } = useStore();
  const [title,setTitle]=useState("");
  const [content,setContent]=useState("");
  const [target,setTarget]=useState("전체");
  const [schedule,setSchedule]=useState(false);
  const [done,setDone]=useState(false);
  const [busy,setBusy]=useState(false);
  const publish = async () => {
    if(!title||!content) return;
    setBusy(true);
    try {
      await actions.publishAnnouncement({ title:title.trim(), body:content.trim(), target, status: schedule?"예약됨":"발행됨" });
      setDone(true);
    } finally { setBusy(false); }
  };
  return (
    <div className="content" style={{maxWidth:640,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("A17")}>← 목록</button>
        <div style={{fontSize:20,fontWeight:700}}>공지 발행·편집</div>
      </div>
      {done
        ? <div className="card card-p" style={{textAlign:"center",padding:"40px"}}><TFI s={48} color={TDS.blue500}>📢</TFI><div style={{fontSize:18,fontWeight:700,marginTop:16}}>공지가 {schedule?"예약":"발행"}되었습니다</div><Btn v="primary" s="md" style={{marginTop:24}} onClick={()=>onNav("A17")}>목록으로</Btn></div>
        : <div className="card card-p">
          <div className="inp-group"><label className="inp-label">제목</label><input className="inp" placeholder="공지 제목..." value={title} onChange={e=>setTitle(e.target.value)} disabled={busy} /></div>
          <div className="inp-group"><label className="inp-label">내용</label><textarea className="inp" rows={6} placeholder="공지 내용..." value={content} onChange={e=>setContent(e.target.value)} disabled={busy} /></div>
          <div className="inp-group"><label className="inp-label">대상</label>
            <select className="inp" value={target} onChange={e=>setTarget(e.target.value)} disabled={busy}>
              <option>전체</option><option>학생</option><option>교사</option>
            </select>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
            <input type="checkbox" id="schedule-chk" checked={schedule} onChange={e=>setSchedule(e.target.checked)} />
            <label htmlFor="schedule-chk" style={{fontSize:13}}>예약 발행</label>
            {schedule&&<input className="inp" type="datetime-local" style={{flex:1,marginLeft:8}} />}
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn v="secondary" s="md" fw onClick={()=>onNav("A17")} disabled={busy}>취소</Btn>
            <Btn v="primary" s="md" fw disabled={!title||!content||busy} onClick={publish} style={busy?{opacity:.7,cursor:"not-allowed"}:undefined}>{busy?"처리 중…":(schedule?"예약":"즉시 발행")}</Btn>
          </div>
        </div>
      }
    </div>
  );
}

/* A19 JWKS 키 회전 [T2] */
function A19({ onNav }) {
  const [step,setStep]=useState(0);
  const [mfa,setMfa]=useState("");
  const [reason,setReason]=useState("");
  return (
    <div className="content" style={{maxWidth:540,margin:"0 auto"}}>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:20}}>
        <div style={{fontSize:20,fontWeight:700}}>JWKS 키 회전 승인</div><Badge t="red">[T2]</Badge>
      </div>
      <Notice type="danger" style={{marginBottom:20}}>키 회전 후 모든 활성 세션이 무효화됩니다. 사용자는 재로그인이 필요합니다.</Notice>
      {step===0&&(
        <div className="card card-p">
          <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>현재 키 상태</div>
          {[["현재 키 ID","key-2026-01-001"],["생성일","2026-01-01"],["만료 예정","2026-07-01"],["서명 알고리즘","RS256"]].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${TDS.bgTertiary}`,fontSize:13}}>
              <span style={{color:TDS.textTertiary}}>{k}</span><span style={{fontFamily:"monospace",fontSize:12}}>{v}</span>
            </div>
          ))}
          <div className="inp-group" style={{marginTop:16}}><label className="inp-label">회전 사유</label><textarea className="inp" rows={2} placeholder="키 회전 사유..." value={reason} onChange={e=>setReason(e.target.value)} /></div>
          <div className="inp-group"><label className="inp-label">MFA 인증 코드</label><input className="inp" placeholder="6자리 코드" value={mfa} onChange={e=>setMfa(e.target.value)} /></div>
          <Btn v="danger" s="md" fw disabled={!reason||mfa.length!==6} onClick={()=>setStep(1)}>키 회전 실행</Btn>
        </div>
      )}
      {step===1&&(
        <div className="card card-p" style={{textAlign:"center",padding:"40px"}}>
          <TFI s={48} color={TDS.warning}>🔑</TFI>
          <div style={{fontSize:18,fontWeight:700,marginTop:16,marginBottom:8}}>키 회전 완료</div>
          <div style={{fontSize:13,color:TDS.textTertiary,marginBottom:24}}>새 키: key-2026-01-002 · 보안팀에 통보됨</div>
          <Btn v="primary" s="md" onClick={()=>onNav("A13")}>시스템 헬스로</Btn>
        </div>
      )}
    </div>
  );
}

/* A20 Redis fail-close 토글 [T2] */
function A20({ onNav }) {
  const [isFailClose, setIsFailClose] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <div className="content" style={{maxWidth:540,margin:"0 auto"}}>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:20}}>
        <div style={{fontSize:20,fontWeight:700}}>Redis fail-close 토글</div><Badge t="red">[T2]</Badge>
      </div>
      <Notice type={isFailClose?"danger":"warning"} style={{marginBottom:20}}>
        {isFailClose
          ? "⚠️ fail-close 활성화 상태: Redis 장애 시 모든 W 작업이 차단됩니다."
          : "현재 fail-open 상태: Redis 장애 시 캐시 없이 DB에 직접 접근합니다."
        }
      </Notice>
      {done
        ? <div className="card card-p" style={{textAlign:"center",padding:"40px"}}><TFI s={48}>{isFailClose?"🔓":"🔒"}</TFI><div style={{fontSize:18,fontWeight:700,marginTop:16}}>{isFailClose?"fail-open으로 전환됨":"fail-close로 전환됨"}</div><div style={{fontSize:13,color:TDS.textTertiary,marginTop:8,marginBottom:24}}>보안팀에 통보됨 · 감사 로그 기록됨</div><Btn v="primary" s="md" onClick={()=>onNav("A13")}>시스템 헬스로</Btn></div>
        : <div className="card card-p">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 0"}}>
            <div><div style={{fontWeight:700}}>Redis fail-close</div><div style={{fontSize:12,color:TDS.textTertiary}}>Redis 장애 시 W 작업 차단</div></div>
            <div onClick={()=>setIsFailClose(!isFailClose)} style={{width:48,height:28,borderRadius:14,background:isFailClose?TDS.danger:TDS.bgTertiary,position:"relative",cursor:"pointer",transition:"background .2s"}}>
              <div style={{width:22,height:22,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:isFailClose?23:3,transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.2)"}} />
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,padding:"12px",background:TDS.dangerBg,borderRadius:8}}>
            <input type="checkbox" id="redis-confirm" checked={confirm} onChange={e=>setConfirm(e.target.checked)} />
            <label htmlFor="redis-confirm" style={{fontSize:13,color:TDS.danger}}>이 작업이 서비스에 미치는 영향을 이해했습니다</label>
          </div>
          <Btn v="danger" s="md" fw disabled={!confirm} onClick={()=>setDone(true)}>설정 변경 적용</Btn>
        </div>
      }
    </div>
  );
}

/* A22 감사 로그 상세 */
function A22({ onNav }) {
  const log={id:"AL-2026012015432",who:"관리자",action:"user.suspend",target:"이수진 (U-1024)",severity:"high",time:"2026-01-20 15:43:21",ip:"192.168.1.1",reason:"반복적 불량 코멘트 작성",traceId:"01HXY2KQNPZ..."};
  return (
    <div className="content" style={{maxWidth:640,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("A21")}>← 감사 로그</button>
        <div style={{fontSize:20,fontWeight:700}}>감사 로그 상세</div>
      </div>
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
          <code style={{fontSize:12,background:TDS.bgTertiary,padding:"4px 8px",borderRadius:4}}>{log.id}</code>
          <Badge t="red">{log.severity}</Badge>
        </div>
        {[
          ["액션",log.action],["실행자",log.who],["대상",log.target],["시각",log.time],
          ["IP",log.ip],["사유",log.reason],["Trace ID",log.traceId],
        ].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${TDS.bgTertiary}`,fontSize:13}}>
            <span style={{color:TDS.textTertiary,minWidth:80}}>{k}</span>
            <span style={{fontFamily:k==="액션"||k==="Trace ID"||k==="IP"?"monospace":"inherit",fontSize:k==="액션"||k==="Trace ID"?11:13,color:TDS.textPrimary,textAlign:"right"}}>{v}</span>
          </div>
        ))}
      </div>
      <div className="card card-p">
        <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>Raw 페이로드</div>
        <pre style={{fontSize:11,background:TDS.bgSecondary,padding:"12px",borderRadius:8,overflow:"auto",color:TDS.textSecondary}}>{JSON.stringify({action:log.action,target_id:"U-1024",reason:log.reason,severity:log.severity,timestamp:"2026-01-20T15:43:21Z"},null,2)}</pre>
      </div>
    </div>
  );
}

/* A23 감사 로그 내보내기 */
function A23({ onNav }) {
  const [fmt,setFmt]=useState("JSON");
  const [range,setRange]=useState("7일");
  const [filters,setFilters]=useState({severity:"전체",action:""});
  const [done,setDone]=useState(false);
  return (
    <div className="content" style={{maxWidth:560,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("A21")}>← 감사 로그</button>
        <div style={{fontSize:20,fontWeight:700}}>감사 로그 내보내기</div>
      </div>
      {done
        ? <div className="card card-p" style={{textAlign:"center",padding:"40px"}}><TFI s={48} color={TDS.blue500}>📤</TFI><div style={{fontSize:18,fontWeight:700,marginTop:16}}>내보내기 완료</div><div style={{fontSize:13,color:TDS.textTertiary,marginTop:8,marginBottom:24}}>audit_log_20260120.{fmt.toLowerCase()} · 2.4 MB</div><Btn v="primary" s="md" onClick={()=>setDone(false)}>다운로드</Btn></div>
        : <div className="card card-p">
          <div className="inp-group"><label className="inp-label">기간</label>
            <select className="inp" value={range} onChange={e=>setRange(e.target.value)}>
              {["24시간","7일","30일","90일","사용자 정의"].map(r=><option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="inp-group"><label className="inp-label">심각도 필터</label>
            <select className="inp" value={filters.severity} onChange={e=>setFilters({...filters,severity:e.target.value})}>
              {["전체","critical","high","medium","low"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="inp-group"><label className="inp-label">액션 필터 (선택)</label>
            <input className="inp" placeholder="예: user.suspend" value={filters.action} onChange={e=>setFilters({...filters,action:e.target.value})} />
          </div>
          <div className="inp-group"><label className="inp-label">포맷</label>
            <div style={{display:"flex",gap:8}}>
              {["JSON","CSV"].map(f=><Btn key={f} v={fmt===f?"primary":"secondary"} s="sm" onClick={()=>setFmt(f)}>{f}</Btn>)}
            </div>
          </div>
          <Btn v="primary" s="md" fw onClick={()=>setDone(true)}>내보내기 시작</Btn>
        </div>
      }
    </div>
  );
}

/* A24 Investigation 발동 [T2] */
function A24({ onNav }) {
  const [step,setStep]=useState(0);
  const [target,setTarget]=useState("");
  const [reason,setReason]=useState("");
  const [mfa,setMfa]=useState("");
  return (
    <div className="content" style={{maxWidth:540,margin:"0 auto"}}>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:16}}>
        <div style={{fontSize:20,fontWeight:700,color:TDS.danger}}>Investigation 발동</div><Badge t="red">[T2]</Badge>
      </div>
      <Notice type="danger" style={{marginBottom:20}}>
        <div style={{fontWeight:700,marginBottom:6}}>admin.investigation 등급 · 보안팀 즉시 통보</div>
        모든 단계가 감사 로그(severity=critical)에 기록됩니다.
      </Notice>
      <div style={{display:"flex",gap:4,marginBottom:24}}>
        {["대상","사유","MFA","실행"].map((s,i)=>(
          <div key={i} style={{flex:1,height:4,borderRadius:2,background:i<=step?TDS.danger:TDS.borderDefault}} />
        ))}
      </div>
      {step===0&&(
        <div className="card card-p">
          <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>조사 대상</div>
          <div className="inp-group"><label className="inp-label">사용자 ID 또는 이메일</label><input className="inp" placeholder="조사 대상 입력..." value={target} onChange={e=>setTarget(e.target.value)} /></div>
          <div className="inp-group"><label className="inp-label">조사 범위</label>
            <select className="inp"><option>전체 데이터</option><option>그래프</option><option>음성</option><option>코멘트</option></select>
          </div>
          <Btn v="danger" s="md" fw disabled={!target} onClick={()=>setStep(1)}>다음</Btn>
        </div>
      )}
      {step===1&&(
        <div className="card card-p">
          <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>조사 사유 (X-Investigation-Reason)</div>
          <textarea className="inp" rows={5} placeholder="상세한 조사 사유를 입력하세요..." value={reason} onChange={e=>setReason(e.target.value)} />
          <div style={{display:"flex",gap:8,marginTop:16}}>
            <Btn v="secondary" s="sm" onClick={()=>setStep(0)}>이전</Btn>
            <Btn v="danger" s="sm" disabled={reason.length<20} onClick={()=>setStep(2)}>다음</Btn>
          </div>
        </div>
      )}
      {step===2&&(
        <div className="card card-p">
          <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>MFA 재인증</div>
          <div className="inp-group"><label className="inp-label">인증 코드</label><input className="inp" placeholder="6자리 코드" maxLength={6} value={mfa} onChange={e=>setMfa(e.target.value)} /></div>
          <div style={{display:"flex",gap:8}}>
            <Btn v="secondary" s="sm" onClick={()=>setStep(1)}>이전</Btn>
            <Btn v="danger" s="sm" disabled={mfa.length!==6} onClick={()=>setStep(3)}>인증 확인</Btn>
          </div>
        </div>
      )}
      {step===3&&(
        <div className="card card-p" style={{textAlign:"center",padding:"40px"}}>
          <TFI s={48} color={TDS.blue500}>🔎</TFI>
          <div style={{fontSize:18,fontWeight:700,marginTop:16,marginBottom:8}}>Investigation 발동됨</div>
          <div style={{fontSize:13,color:TDS.textTertiary,marginBottom:8}}>대상: {target}</div>
          <div style={{fontSize:12,color:TDS.danger,marginBottom:24}}>보안팀 Slack + 이메일 통보 완료 · severity=critical</div>
          <Btn v="primary" s="md" onClick={()=>onNav("A21")}>감사 로그 확인</Btn>
        </div>
      )}
    </div>
  );
}

/* A25 학기·과목 마스터 */
function A25({ onNav }) {
  const [adding,setAdding]=useState(false);
  const semesters=[
    {id:"S-2026-1",name:"2026년 1학기",start:"2026-03-01",end:"2026-08-31",subjects:8},
    {id:"S-2025-2",name:"2025년 2학기",start:"2025-09-01",end:"2026-02-28",subjects:12},
  ];
  return (
    <div className="content">
      <div className="row-between mb16" style={{marginBottom:16}}>
        <div className="sec-title">학기·과목 마스터</div>
        <Btn v="primary" s="sm" onClick={()=>setAdding(!adding)}>+ 추가</Btn>
      </div>
      {adding&&(
        <div className="card card-p" style={{marginBottom:16,border:`1px solid ${TDS.blue500}`}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div className="inp-group"><label className="inp-label">학기명</label><input className="inp" placeholder="2026년 2학기" /></div>
            <div className="inp-group"><label className="inp-label">과목 수</label><input className="inp" type="number" placeholder="10" /></div>
            <div className="inp-group"><label className="inp-label">시작일</label><input className="inp" type="date" /></div>
            <div className="inp-group"><label className="inp-label">종료일</label><input className="inp" type="date" /></div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn v="secondary" s="sm" onClick={()=>setAdding(false)}>취소</Btn>
            <Btn v="primary" s="sm">저장</Btn>
          </div>
        </div>
      )}
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>ID</th><th>학기명</th><th>시작</th><th>종료</th><th>과목 수</th><th>수정</th></tr></thead>
          <tbody>
            {semesters.map((s,i)=>(
              <tr key={i}>
                <td><code style={{fontSize:11}}>{s.id}</code></td>
                <td style={{fontWeight:500}}>{s.name}</td>
                <td style={{color:TDS.textTertiary}}>{s.start}</td>
                <td style={{color:TDS.textTertiary}}>{s.end}</td>
                <td><Badge t="blue">{s.subjects}개</Badge></td>
                <td><Btn v="ghost" s="sm">편집</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* A26 양식 템플릿 마스터 */
function A26({ onNav }) {
  const templates=[
    {id:"T-001",name:"자기소개서 A",category:"자소서",usages:234,active:true},
    {id:"T-002",name:"세특 요약",category:"세특",usages:189,active:true},
    {id:"T-003",name:"진학 계획 A",category:"진학",usages:87,active:true},
    {id:"T-004",name:"봉사 활동 보고서",category:"봉사",usages:45,active:false},
  ];
  return (
    <div className="content">
      <div className="row-between mb16" style={{marginBottom:16}}>
        <div className="sec-title">양식 템플릿 마스터</div>
        <Btn v="primary" s="sm">+ 새 템플릿</Btn>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>ID</th><th>템플릿명</th><th>카테고리</th><th>사용 횟수</th><th>활성</th><th>수정</th></tr></thead>
          <tbody>
            {templates.map((t,i)=>(
              <tr key={i}>
                <td><code style={{fontSize:11}}>{t.id}</code></td>
                <td style={{fontWeight:500}}>{t.name}</td>
                <td><Badge t="blue">{t.category}</Badge></td>
                <td style={{fontWeight:600}}>{t.usages.toLocaleString()}</td>
                <td><Badge t={t.active?"blue":"grey"}>{t.active?"활성":"비활성"}</Badge></td>
                <td><Btn v="ghost" s="sm">편집</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* A27 Enum 마스터 */
function A27({ onNav }) {
  const enums=[
    {key:"node_type",values:["개념","사건","인물","장소","기관","수식","기타"],count:7},
    {key:"edge_type",values:["하위 개념","상위 개념","관련","참조","대립","인과"],count:6},
    {key:"report_status",values:["대기","처리 중","완료","거부"],count:4},
    {key:"user_role",values:["학생","교사","관리자"],count:3},
  ];
  const [open,setOpen]=useState(null);
  return (
    <div className="content" style={{maxWidth:700,margin:"0 auto"}}>
      <div style={{fontSize:20,fontWeight:700,marginBottom:20}}>Enum 마스터</div>
      {enums.map((e,i)=>(
        <div key={i} className="card card-p" style={{marginBottom:12,cursor:"pointer"}} onClick={()=>setOpen(open===i?null:i)}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <code style={{fontSize:13,fontWeight:700,color:TDS.blue500}}>{e.key}</code>
              <span style={{fontSize:12,color:TDS.textTertiary,marginLeft:8}}>{e.count}개 값</span>
            </div>
            <span style={{color:TDS.textTertiary,fontSize:18}}>{open===i?"∧":"∨"}</span>
          </div>
          {open===i&&(
            <div style={{marginTop:12,display:"flex",flexWrap:"wrap",gap:8}}>
              {e.values.map(v=>(
                <div key={v} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 12px",background:TDS.bgSecondary,borderRadius:20,border:`1px solid ${TDS.borderDefault}`,fontSize:13}}>
                  {v}<span style={{cursor:"pointer",color:TDS.textTertiary,fontSize:12}}>✕</span>
                </div>
              ))}
              <div style={{padding:"4px 12px",borderRadius:20,border:`2px dashed ${TDS.borderDefault}`,fontSize:13,color:TDS.textTertiary,cursor:"pointer"}}>+ 추가</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* A28 시스템 설정 */
function A28({ onNav }) {
  const settings=[
    {section:"보안",items:[
      {key:"session_ttl_hours",label:"세션 유효 시간 (시간)",value:"4",type:"number"},
      {key:"mfa_required",label:"MFA 필수",value:true,type:"bool"},
      {key:"max_login_attempts",label:"최대 로그인 시도",value:"5",type:"number"},
    ]},
    {section:"자원 한도",items:[
      {key:"node_limit",label:"사용자당 최대 노드",value:"10000",type:"number"},
      {key:"storage_limit_gb",label:"사용자당 스토리지 (GB)",value:"10",type:"number"},
      {key:"voice_session_max_min",label:"음성 세션 최대 (분)",value:"240",type:"number"},
    ]},
    {section:"ML",items:[
      {key:"ml_confidence_threshold",label:"ML 신뢰도 임계값",value:"0.75",type:"number"},
      {key:"pruning_auto",label:"자동 가지치기",value:false,type:"bool"},
    ]},
  ];
  return (
    <div className="content" style={{maxWidth:700,margin:"0 auto"}}>
      <div style={{fontSize:20,fontWeight:700,marginBottom:20}}>시스템 설정</div>
      {settings.map((s,si)=>(
        <div key={si} className="card card-p" style={{marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:700,marginBottom:14,color:TDS.textPrimary}}>{s.section}</div>
          {s.items.map((item,ii)=>(
            <div key={ii} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:ii<s.items.length-1?`1px solid ${TDS.bgTertiary}`:"none"}}>
              <div>
                <div style={{fontSize:13,fontWeight:500,color:TDS.textPrimary}}>{item.label}</div>
                <code style={{fontSize:10,color:TDS.textTertiary}}>{item.key}</code>
              </div>
              {item.type==="bool"
                ? <div style={{width:44,height:26,borderRadius:13,background:item.value?TDS.blue500:TDS.bgTertiary,position:"relative",cursor:"pointer"}} onClick={()=>{}}>
                    <div style={{width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:item.value?21:3,boxShadow:"0 1px 4px rgba(0,0,0,.2)"}} />
                  </div>
                : <input className="inp" type="number" defaultValue={item.value} style={{width:100,textAlign:"right"}} />
              }
            </div>
          ))}
        </div>
      ))}
      <Btn v="primary" s="lg" fw>모든 설정 저장</Btn>
    </div>
  );
}

/* A29 관리자 목록 */
function A29({ onNav }) {
  const admins=[
    {name:"admin_kim",email:"kim@admin.ac.kr",tier:"T2",last:"2026-01-20",actions:342},
    {name:"admin_lee",email:"lee@admin.ac.kr",tier:"T1",last:"2026-01-20",actions:128},
    {name:"admin_park",email:"park@admin.ac.kr",tier:"T1",last:"2026-01-18",actions:89},
  ];
  return (
    <div className="content">
      <div className="row-between mb16" style={{marginBottom:16}}>
        <div className="sec-title">관리자 목록 ({admins.length}명)</div>
        <Btn v="secondary" s="sm" onClick={()=>onNav("A30")}>Tier 변경 [T2]</Btn>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>관리자</th><th>이메일</th><th>Tier</th><th>마지막 접속</th><th>총 액션 수</th><th>이력</th></tr></thead>
          <tbody>
            {admins.map((a,i)=>(
              <tr key={i}>
                <td><div style={{display:"flex",gap:8,alignItems:"center"}}><Av name={a.name[6]} size="xs"/>{a.name}</div></td>
                <td style={{color:TDS.textTertiary}}>{a.email}</td>
                <td><Badge t={a.tier==="T2"?"red":"blue"}>{a.tier}</Badge></td>
                <td style={{color:TDS.textTertiary}}>{a.last}</td>
                <td style={{fontWeight:600}}>{a.actions.toLocaleString()}</td>
                <td><Btn v="ghost" s="sm" onClick={()=>onNav("A31")}>이력</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* A30 Tier 변경 [T2] */
function A30({ onNav }) {
  const [sel,setSel]=useState(null);
  const [tier,setTier]=useState("T1");
  const [reason,setReason]=useState("");
  const [done,setDone]=useState(false);
  const admins=["admin_lee (T1)","admin_park (T1)"];
  return (
    <div className="content" style={{maxWidth:540,margin:"0 auto"}}>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:16}}>
        <div style={{fontSize:20,fontWeight:700}}>관리자 Tier 변경</div><Badge t="red">[T2]</Badge>
      </div>
      <Notice type="danger" style={{marginBottom:20}}>Tier 변경은 즉시 적용됩니다. 보안팀에 통보됩니다.</Notice>
      {done
        ? <div className="card card-p" style={{textAlign:"center",padding:"40px"}}><TFI s={48}>✅</TFI><div style={{fontSize:18,fontWeight:700,marginTop:16}}>Tier 변경 완료</div><div style={{fontSize:13,color:TDS.textTertiary,marginTop:8,marginBottom:24}}>{sel} → {tier}</div><Btn v="primary" s="md" onClick={()=>onNav("A29")}>관리자 목록으로</Btn></div>
        : <div className="card card-p">
          <div className="inp-group"><label className="inp-label">대상 관리자</label>
            <select className="inp" value={sel||""} onChange={e=>setSel(e.target.value)}>
              <option value="">선택하세요</option>
              {admins.map(a=><option key={a}>{a}</option>)}
            </select>
          </div>
          <div className="inp-group"><label className="inp-label">변경할 Tier</label>
            <div style={{display:"flex",gap:8}}>
              {["T1","T2"].map(t=><Btn key={t} v={tier===t?"primary":"secondary"} s="sm" onClick={()=>setTier(t)}>{t}</Btn>)}
            </div>
          </div>
          <div className="inp-group"><label className="inp-label">변경 사유</label><textarea className="inp" rows={2} placeholder="사유..." value={reason} onChange={e=>setReason(e.target.value)} /></div>
          <Btn v="danger" s="md" fw disabled={!sel||!reason} onClick={()=>setDone(true)}>Tier 변경 적용</Btn>
        </div>
      }
    </div>
  );
}

/* A31 본인 활동 이력 */
function A31({ onNav }) {
  const logs=[
    {action:"user.suspend","target":"이수진",sv:"high",time:"2026-01-20 15:43"},
    {action:"teacher.verify.approve",target:"김민준",sv:"medium",time:"2026-01-20 11:22"},
    {action:"user.list.read",target:"전체 조회",sv:"low",time:"2026-01-20 09:15"},
    {action:"audit.log.export",target:"7일 로그",sv:"medium",time:"2026-01-19 16:44"},
    {action:"system.config.read",target:"ML 설정",sv:"low",time:"2026-01-19 14:30"},
  ];
  return (
    <div className="content">
      <div className="sec-title mb16" style={{marginBottom:16}}>본인 활동 이력</div>
      <div className="card card-p">
        <div style={{fontSize:13,color:TDS.textTertiary,marginBottom:12}}>현재 세션 관리자: admin_kim · Tier 2</div>
        {logs.map((l,i)=>(
          <div key={i} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:i<logs.length-1?`1px solid ${TDS.bgTertiary}`:"none"}}>
            <code style={{fontSize:11,color:TDS.blue500,flexShrink:0,background:TDS.blue50,padding:"2px 6px",borderRadius:4,alignSelf:"flex-start"}}>{l.action}</code>
            <div style={{flex:1,fontSize:13,color:TDS.textSecondary}}>{l.target}</div>
            <Badge t={l.sv==="high"?"red":l.sv==="medium"?"orange":"grey"} style={{flexShrink:0}}>{l.sv}</Badge>
            <div style={{fontSize:11,color:TDS.textDisabled,flexShrink:0,minWidth:120,textAlign:"right"}}>{l.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* A32 디버깅 신청 (5단계) */
function A32({ onNav }) {
  const [step,setStep]=useState(0);
  const [form,setForm]=useState({target:"",trace:"",desc:"",level:"debug"});
  const updateForm = k => e => setForm({...form,[k]:e.target.value});
  const steps=["대상 선택","정보 입력","확인","실행","완료"];
  return (
    <div className="content" style={{maxWidth:560,margin:"0 auto"}}>
      <div style={{fontSize:20,fontWeight:700,marginBottom:16}}>디버깅 신청</div>
      <div style={{display:"flex",gap:4,marginBottom:24}}>
        {steps.map((s,i)=>(
          <div key={i} style={{flex:1,textAlign:"center"}}>
            <div style={{height:4,borderRadius:2,background:i<=step?TDS.blue500:TDS.borderDefault,marginBottom:6}} />
            <div style={{fontSize:9,color:i<=step?TDS.blue500:TDS.textDisabled,fontWeight:i===step?700:400}}>{s}</div>
          </div>
        ))}
      </div>
      {step===0&&(
        <div className="card card-p">
          <div className="inp-group"><label className="inp-label">디버그 대상</label>
            <select className="inp" value={form.target} onChange={updateForm("target")}>
              <option value="">선택하세요</option>
              <option>특정 사용자</option><option>특정 그래프</option><option>ML 작업</option><option>시스템 전체</option>
            </select>
          </div>
          <div className="inp-group"><label className="inp-label">로그 레벨</label>
            <div style={{display:"flex",gap:8}}>
              {["debug","info","warn","error"].map(l=><Btn key={l} v={form.level===l?"primary":"secondary"} s="sm" onClick={()=>setForm({...form,level:l})}>{l}</Btn>)}
            </div>
          </div>
          <Btn v="primary" s="md" fw disabled={!form.target} onClick={()=>setStep(1)}>다음</Btn>
        </div>
      )}
      {step===1&&(
        <div className="card card-p">
          <div className="inp-group"><label className="inp-label">Trace ID (선택)</label><input className="inp" placeholder="01HXY..." value={form.trace} onChange={updateForm("trace")} /></div>
          <div className="inp-group"><label className="inp-label">디버그 설명</label><textarea className="inp" rows={4} placeholder="재현 방법, 예상 동작, 실제 동작..." value={form.desc} onChange={updateForm("desc")} /></div>
          <div style={{display:"flex",gap:8}}>
            <Btn v="secondary" s="sm" onClick={()=>setStep(0)}>이전</Btn>
            <Btn v="primary" s="sm" disabled={!form.desc} onClick={()=>setStep(2)}>다음</Btn>
          </div>
        </div>
      )}
      {step===2&&(
        <div className="card card-p">
          <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>디버깅 요청 확인</div>
          {[["대상",form.target],["레벨",form.level],["Trace ID",form.trace||"없음"],["설명",form.desc]].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${TDS.bgTertiary}`,fontSize:13}}>
              <span style={{color:TDS.textTertiary}}>{k}</span><span style={{maxWidth:300,textAlign:"right",overflow:"hidden",textOverflow:"ellipsis"}}>{v}</span>
            </div>
          ))}
          <div style={{display:"flex",gap:8,marginTop:16}}>
            <Btn v="secondary" s="sm" onClick={()=>setStep(1)}>이전</Btn>
            <Btn v="primary" s="sm" onClick={()=>setStep(3)}>실행 요청</Btn>
          </div>
        </div>
      )}
      {step===3&&(
        <div className="card card-p" style={{textAlign:"center",padding:"32px"}}>
          <div style={{fontSize:32,marginBottom:12}}>⏳</div>
          <div style={{fontSize:15,fontWeight:700}}>디버깅 세션 생성 중...</div>
          <div style={{fontSize:12,color:TDS.textTertiary,marginTop:8,marginBottom:24}}>세션 ID: DBG-2026-0120-001</div>
          <Btn v="primary" s="md" onClick={()=>setStep(4)}>완료 확인</Btn>
        </div>
      )}
      {step===4&&(
        <div className="card card-p" style={{textAlign:"center",padding:"40px"}}>
          <TFI s={48} color={TDS.warning}>🐛</TFI>
          <div style={{fontSize:18,fontWeight:700,marginTop:16,marginBottom:8}}>디버깅 세션 준비됨</div>
          <div style={{fontSize:13,color:TDS.textTertiary,marginBottom:24}}>세션 ID: DBG-2026-0120-001 · 24시간 유효</div>
          <div style={{display:"flex",gap:8,justifyContent:"center"}}>
            <Btn v="secondary" s="md" onClick={()=>setStep(0)}>새 요청</Btn>
            <Btn v="primary" s="md" onClick={()=>onNav("A13")}>시스템 헬스로</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Placeholder ── */
function Placeholder({ title, screen }) {
  return (
    <div className="content">
      <div className="empty">
        <div className="empty-icon"><TFI s={48} color={TDS.warning}>🚧</TFI></div>
        <div className="empty-title">{title}</div>
        <div className="empty-sub">화면이 준비 중입니다</div>
        <p style={{fontSize:11,color:TDS.textDisabled}}>{screen}</p>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   SCREEN MAP
────────────────────────────────────────────────────────────── */
function renderScreen(id, onNav) {
  const M={
    S01:<S01 onNav={onNav}/>,S03:<S03 onNav={onNav}/>,S04:<S04 onNav={onNav}/>,
    S05:<S05 onNav={onNav}/>,S06:<S06 onNav={onNav}/>,S07:<S07 onNav={onNav}/>,
    S08:<S08 onNav={onNav}/>,S09:<S09 onNav={onNav}/>,
    S10:<S10 onNav={onNav}/>,S11:<S11 onNav={onNav}/>,
    S12:<S12 onNav={onNav}/>,S13:<S13 onNav={onNav}/>,
    S14:<S14 onNav={onNav}/>,S15:<S15 onNav={onNav}/>,
    S16:<S16 onNav={onNav}/>,S17:<S17 onNav={onNav}/>,
    S18:<S18 onNav={onNav}/>,S19:<S19 onNav={onNav}/>,
    S20:<S20 onNav={onNav}/>,S21:<S21 onNav={onNav}/>,
    S22:<S22 onNav={onNav}/>,S23:<S23 onNav={onNav}/>,
    S24:<S24 onNav={onNav}/>,S25:<S25 onNav={onNav}/>,S26:<S26 onNav={onNav}/>,
    S27:<S27 onNav={onNav}/>,S28:<S28 onNav={onNav}/>,S29:<S29 onNav={onNav}/>,
    S30:<S30 onNav={onNav}/>,S31:<S31 onNav={onNav}/>,
    S32:<S32 onNav={onNav}/>,
    T01:<T01 onNav={onNav}/>,T02:<T02 onNav={onNav}/>,
    T03:<T03 onNav={onNav}/>,T04:<T04 onNav={onNav}/>,
    T05:<T05 onNav={onNav}/>,T06:<T06 onNav={onNav}/>,
    T07:<T07 onNav={onNav}/>,T08:<S06 onNav={onNav}/>,T09:<T09 onNav={onNav}/>,
    T10:<T10 onNav={onNav}/>,T11:<S24 onNav={onNav}/>,T12:<S15 onNav={onNav}/>,
    A00:<A00 onNav={onNav}/>,A01:<A01 onNav={onNav}/>,A02:<A02 onNav={onNav}/>,
    A03:<A03 onNav={onNav}/>,A04:<A04 onNav={onNav}/>,
    A05:<A05 onNav={onNav}/>,A06:<A06 onNav={onNav}/>,
    A07:<A07 onNav={onNav}/>,A08:<A08 onNav={onNav}/>,
    A09:<A09 onNav={onNav}/>,A10:<A10 onNav={onNav}/>,
    A11:<A11 onNav={onNav}/>,A12:<A12 onNav={onNav}/>,
    A13:<A13 onNav={onNav}/>,A14:<A14 onNav={onNav}/>,
    A15:<A15 onNav={onNav}/>,A16:<A16 onNav={onNav}/>,
    A17:<A17 onNav={onNav}/>,A18:<A18 onNav={onNav}/>,
    A19:<A19 onNav={onNav}/>,A20:<A20 onNav={onNav}/>,
    A21:<A21 onNav={onNav}/>,A22:<A22 onNav={onNav}/>,
    A23:<A23 onNav={onNav}/>,A24:<A24 onNav={onNav}/>,
    A25:<A25 onNav={onNav}/>,A26:<A26 onNav={onNav}/>,
    A27:<A27 onNav={onNav}/>,A28:<A28 onNav={onNav}/>,
    A29:<A29 onNav={onNav}/>,A30:<A30 onNav={onNav}/>,
    A31:<A31 onNav={onNav}/>,A32:<A32 onNav={onNav}/>,
  };
  return M[id]||<Placeholder title={id} screen={id} />;
}

/* ──────────────────────────────────────────────────────────────
   LAYOUT HELPER
────────────────────────────────────────────────────────────── */
/* 역할 공용 화면: 음성·양식·알림·설정 등은 학생/교사가 함께 사용 →
   어느 역할로 로그인해도 접근 가능하고, 현재 로그인한 역할의 레이아웃(사이드바)로 표시 */
const SHARED_SCREENS = ["S15","S16","S17","S18","S19","S20","S21","S22","S25","S26","S27","S30","S31","S32"];
function getLayout(s, sessionRole){
  if(["S01","S03","S04","A00"].includes(s))return "full";
  // 공용 화면(음성·양식·알림·설정)은 현재 로그인한 역할의 레이아웃으로 표시
  if(SHARED_SCREENS.includes(s) && sessionRole){
    return sessionRole==="teacher"?"teacher":sessionRole==="admin"?"admin":"student";
  }
  if(s.startsWith("T"))return "teacher";
  if(s.startsWith("A"))return "admin";
  return "student";
}
const NO_HDR=["S06","S16","T07","T08"];

/* ──────────────────────────────────────────────────────────────
   SCREEN PICKER FAB
────────────────────────────────────────────────────────────── */
const ALL_SCREENS=[
  ...S_NAV.map(n=>({...n,g:"학생"})),
  {id:"S02",icon:"🔐",label:"OAuth 콜백",g:"학생"},{id:"S03",icon:"🎉",label:"가입 환영",g:"학생"},
  {id:"S04",icon:"🌱",label:"시드 입력",g:"학생"},{id:"S07",icon:"🔵",label:"노드 상세",g:"학생"},
  {id:"S08",icon:"🔗",label:"엣지 상세",g:"학생"},{id:"S09",icon:"➕",label:"시드 추가",g:"학생"},
  {id:"S10",icon:"📜",label:"변경 이력",g:"학생"},{id:"S12",icon:"✏️",label:"텍스트 편집",g:"학생"},
  {id:"S13",icon:"📎",label:"PDF 업로드",g:"학생"},{id:"S14",icon:"🔍",label:"파싱 결과",g:"학생"},
  {id:"S16",icon:"🔴",label:"녹음 중",g:"학생"},{id:"S17",icon:"📋",label:"보고서 검토",g:"학생"},
  {id:"S18",icon:"👥",label:"참여자 관리",g:"학생"},{id:"S19",icon:"🤝",label:"매칭 제안",g:"학생"},
  {id:"S21",icon:"📄",label:"결과물 목록",g:"학생"},{id:"S22",icon:"📖",label:"결과물 상세",g:"학생"},
  {id:"S23",icon:"✂️",label:"가지치기 추천",g:"학생"},{id:"S26",icon:"📰",label:"피드",g:"학생"},
  {id:"S29",icon:"📤",label:"내보내기",g:"학생"},{id:"S31",icon:"👤",label:"계정 정보",g:"학생"},
  {id:"S32",icon:"🗑️",label:"계정 삭제",g:"학생"},
  ...T_NAV.map(n=>({...n,g:"교사"})),
  {id:"T01",icon:"📋",label:"자격 검증 신청",g:"교사"},{id:"T02",icon:"⏳",label:"자격 검증 상태",g:"교사"},
  {id:"T04",icon:"➕",label:"매핑 신청",g:"교사"},{id:"T05",icon:"📊",label:"매핑 상태",g:"교사"},
  {id:"T07",icon:"👤",label:"학생 상세 R",g:"교사"},{id:"T08",icon:"🧠",label:"그래프 R",g:"교사"},
  {id:"T09",icon:"🔵",label:"노드 상세 R",g:"교사"},{id:"T10",icon:"✍️",label:"코멘트 작성",g:"교사"},
  {id:"T12",icon:"🎙️",label:"회의 녹음",g:"교사"},
  {id:"A00",icon:"🔐",label:"관리자 로그인",g:"관리자"},
  ...A_NAV.map(n=>({...n,g:"관리자"})),
  {id:"A03",icon:"👤",label:"사용자 상세",g:"관리자"},{id:"A04",icon:"🚫",label:"계정 정지",g:"관리자"},
  {id:"A05",icon:"🗑️",label:"강제 삭제 T2",g:"관리자"},{id:"A07",icon:"✅",label:"자격 상세",g:"관리자"},
  {id:"A09",icon:"📋",label:"신고 상세",g:"관리자"},{id:"A10",icon:"💬",label:"신고된 코멘트",g:"관리자"},
  {id:"A11",icon:"🗑️",label:"코멘트 삭제",g:"관리자"},{id:"A12",icon:"📸",label:"스냅샷 T2",g:"관리자"},
  {id:"A15",icon:"🤖",label:"임베딩 모델",g:"관리자"},{id:"A16",icon:"🔄",label:"모델 교체",g:"관리자"},
  {id:"A17",icon:"📢",label:"공지 목록",g:"관리자"},{id:"A18",icon:"✍️",label:"공지 발행",g:"관리자"},
  {id:"A19",icon:"🔑",label:"JWKS T2",g:"관리자"},{id:"A20",icon:"⚡",label:"Redis T2",g:"관리자"},
  {id:"A22",icon:"📋",label:"감사 상세",g:"관리자"},{id:"A23",icon:"📤",label:"감사 내보내기",g:"관리자"},
  {id:"A24",icon:"🔎",label:"Investigation T2",g:"관리자"},{id:"A26",icon:"📝",label:"템플릿 마스터",g:"관리자"},
  {id:"A27",icon:"🏷️",label:"Enum 마스터",g:"관리자"},{id:"A28",icon:"⚙️",label:"시스템 설정",g:"관리자"},
  {id:"A30",icon:"🎯",label:"Tier 변경 T2",g:"관리자"},{id:"A31",icon:"📜",label:"활동 이력",g:"관리자"},
  {id:"A32",icon:"🐛",label:"디버깅 신청",g:"관리자"},
];
function ScreenPicker({ cur, onSel }) {
  const [q, setQ] = useState("");
  const gs=["학생","교사","관리자"];
  const seen=new Set();
  const filtered=ALL_SCREENS.filter(s=>!q||(s.label+s.id).toLowerCase().includes(q.toLowerCase())).filter(s=>{ if(seen.has(s.id))return false; seen.add(s.id); return true; });
  return (
    <div style={{position:"fixed",bottom:80,right:20,width:360,maxHeight:520,background:TDS.bgPrimary,borderRadius:16,boxShadow:"0 20px 60px rgba(0,0,0,.18)",border:`1px solid ${TDS.borderDefault}`,overflow:"hidden",display:"flex",flexDirection:"column",zIndex:9998}}>
      <div style={{padding:"14px 16px",borderBottom:`1px solid ${TDS.borderDefault}`}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:8,color:TDS.textPrimary}}>🗺 화면 목록 (76개)</div>
        <div className="search-wrap" style={{height:36}}><span>🔍</span><input placeholder="화면 ID 또는 이름 검색..." value={q} onChange={e=>setQ(e.target.value)} autoFocus /></div>
      </div>
      <div style={{overflowY:"auto",flex:1,padding:"6px 0"}}>
        {gs.map(g=>{
          const items=filtered.filter(s=>s.g===g);
          if(!items.length)return null;
          return (
            <div key={g}>
              <div style={{padding:"6px 16px 4px",fontSize:10,fontWeight:700,color:TDS.textTertiary,letterSpacing:".5px"}}>
                <TFI s={12}>{g==="학생"?"🎓":g==="교사"?"👩‍🏫":"🛡️"}</TFI>{" "}{g==="학생"?"학생":g==="교사"?"교사":"관리자"}
              </div>
              {items.map(s=>(
                <div key={s.id} onClick={()=>onSel(s.id)} style={{padding:"8px 16px",display:"flex",alignItems:"center",gap:10,cursor:"pointer",background:cur===s.id?TDS.blue50:"transparent",transition:"background .1s"}}>
                  <span style={{width:40,fontSize:11,color:TDS.textTertiary,fontFamily:"monospace",fontWeight:600}}>{s.id}</span>
                  {NAV_ICON_PATHS[s.icon]
                    ? <NavIcon name={s.icon} size={16} color={cur===s.id?TDS.blue500:"#6b7a90"} />
                    : <TFI s={16}>{s.icon}</TFI>}
                  <span style={{fontSize:14,color:cur===s.id?TDS.blue500:TDS.textPrimary,fontWeight:cur===s.id?700:400}}>{s.label}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   ROOT APP
────────────────────────────────────────────────────────────── */
/* 로그인 없이 접근 가능한 화면 (인증 게이트 예외) */
const PUBLIC_SCREENS = ["S01","S02","S03","S04","A00","T01"];
/* 화면 id → 요구 역할 (게이팅). 공용 화면은 현재 세션 역할을 그대로 허용 */
function requiredRole(s, sessionRole){
  if (SHARED_SCREENS.includes(s) && sessionRole) return sessionRole;
  if (s==="A00"||s.startsWith("A")) return "admin";
  if (s.startsWith("T")) return "teacher";
  return "student";
}

export default function App() {
  return (
    <StoreProvider>
      <AppShell />
      <Toast />
    </StoreProvider>
  );
}

function AppShell() {
  const { state } = useStore();
  const session = state.session;
  const [screen, setScreen] = useState("S01");
  const [picker, setPicker] = useState(false);
  const [preview, setPreview] = useState(false);  // 개발용: 게이트 우회하고 화면 미리보기 (디자인 검토)

  /* ── 인증 게이팅 ──
     - preview 모드(화면 목록에서 점프)면 우회
     - 로그인 안 됨 + 비공개 화면 → 로그인(S01)으로 리다이렉트
     - 로그인 됨 + 역할 불일치 → 자기 역할 홈으로 리다이렉트 */
  const nav = useCallback((id, opts={})=>{
    if (opts.preview) { setPreview(true); setScreen(id); return; }
    setPreview(false);
    setScreen(id);
  }, []);

  useEffect(()=>{
    if (preview) return;
    if (!session && !PUBLIC_SCREENS.includes(screen)) { setScreen("S01"); return; }
    if (session) {
      const need = requiredRole(screen, session.user.role);
      if (need !== session.user.role && !PUBLIC_SCREENS.includes(screen)) {
        const home = session.user.role==="admin"?"A01":session.user.role==="teacher"?"T03":"S05";
        setScreen(home);
      }
    }
  }, [session, screen, preview]);

  /* 로그인 직후 자동으로 역할 홈으로 진입 */
  const prevSession = useRef(null);
  useEffect(()=>{
    if (session && !prevSession.current) {
      const home = session.user.role==="admin"?"A01":session.user.role==="teacher"?"T03":"S05";
      setPreview(false); setScreen(home);
    }
    if (!session && prevSession.current) { setScreen("S01"); }
    prevSession.current = session;
  }, [session]);

  const layout = getLayout(screen, session?.user?.role);
  const sideNav = layout==="teacher"?T_NAV:layout==="admin"?A_NAV:S_NAV;
  const role = layout==="teacher"?"교사":layout==="admin"?"관리자":"학생";

  const devPicker = (
    <div style={{position:"fixed",bottom:20,right:20,zIndex:9999}}>
      <button onClick={()=>setPicker(!picker)} title="화면 목록 (개발용)" style={{background:TDS.blue500,color:"#fff",border:"none",borderRadius:"50%",width:52,height:52,fontSize:22,cursor:"pointer",boxShadow:`0 4px 20px rgba(49,130,246,.45)`}}><TFI>🗺</TFI></button>
      {picker&&<ScreenPicker cur={screen} onSel={id=>{nav(id,{preview:true});setPicker(false);}} />}
    </div>
  );

  if(layout==="full") return (
    <>
      <style>{CSS}</style>
      {renderScreen(screen, nav)}
      {devPicker}
    </>
  );

  const activeNav = sideNav.find(n=>n.id===screen)?.id || sideNav[0].id;
  const showHdr = !NO_HDR.includes(screen);

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <Sidebar nav={sideNav} active={activeNav} onNav={nav} role={role} dark={layout==="admin"} />
        <div className="main">
          {showHdr&&(
            <div className="hdr">
              <div className="row g-10" style={{gap:10}}>
                <span className="hdr-title">{TITLES[screen]||screen}</span>
              </div>
              <div className="hdr-actions"><GlobalHeader onNav={nav}/></div>
            </div>
          )}
          <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
            {renderScreen(screen, nav)}
          </div>
        </div>
      </div>
      {devPicker}
    </>
  );
}