/**
 * api/mockData.js — 백엔드 미구현 엔드포인트용 목업 데이터
 * ─────────────────────────────────────────────────────────
 * 백엔드에 연결된 엔드포인트가 생기면 이 파일에서 해당 데이터를 삭제하세요.
 * SEED_NODES / SEED_EDGES 는 로컬 UI 목업·스토리용으로만 남깁니다.
 * 실제 graph.fetch 는 빈 배열을 그대로 반환합니다 (더미 자동 주입 없음).
 */

// ── 그래프 초기 시드 ──────────────────────────────────────
export const SEED_NODES = [
  { id:"n1", label:"물리학",   kind:"root",  x:"50%", y:"48%", color:"#3182f6", size:64, cat:"핵심 노드" },
  { id:"n2", label:"양자역학", kind:"topic", x:"30%", y:"28%", color:"#4593fc", size:48, cat:"연결 노드" },
  { id:"n3", label:"고전역학", kind:"topic", x:"70%", y:"26%", color:"#22c55e", size:48, cat:"연결 노드" },
  { id:"n4", label:"전자기학", kind:"topic", x:"15%", y:"60%", color:"#f59e0b", size:44, cat:"연결 노드" },
  { id:"n5", label:"열역학",   kind:"topic", x:"83%", y:"58%", color:"#8b95a1", size:44, cat:"연결 노드" },
  { id:"n6", label:"실험물리", kind:"leaf",  x:"38%", y:"76%", color:"#22c55e", size:38, cat:"말단 노드" },
  { id:"n7", label:"이론물리", kind:"leaf",  x:"63%", y:"76%", color:"#3182f6", size:38, cat:"말단 노드" },
  { id:"n8", label:"전기회로", kind:"leaf",  x:"17%", y:"82%", color:"#f04452", size:32, cat:"말단 노드" },
];
export const SEED_EDGES = [
  { id:"e1", from:"n1", to:"n2" }, { id:"e2", from:"n1", to:"n3" },
  { id:"e3", from:"n1", to:"n4" }, { id:"e4", from:"n1", to:"n5" },
  { id:"e5", from:"n2", to:"n6" }, { id:"e6", from:"n3", to:"n7" },
  { id:"e7", from:"n4", to:"n8" },
];

// ── 코멘트 목업 ──────────────────────────────────────────
export const MOCK_COMMENTS = [
  { id:"C-5001", author:"김선생님", type:"노드",   target:"양자컴퓨팅 노드",  content:"이 노드에 관련 논문 링크를 추가해 보는 것은 어떨까요? arXiv의 최신 논문들을 참고하면 좋을 것 같습니다.", createdAt:Date.now()-600000,  replied:false, reports:0, status:"active" },
  { id:"C-5002", author:"박선생님", type:"텍스트", target:"세특 영역",        content:"실험 결과를 수치로 표현해 주세요. 구체적인 데이터가 있으면 더 설득력 있는 세특이 됩니다.", createdAt:Date.now()-7200000, replied:true,  reports:0, status:"active" },
  { id:"C-5003", author:"이선생님", type:"그래프", target:"전체 그래프",      content:"과학 분야 노드들이 잘 연결되어 있어요. 인문학 분야도 연결해 보면 융합 역량을 보여줄 수 있습니다.", createdAt:Date.now()-86400000, replied:true,  reports:0, status:"active" },
];

// ── 관리자 목업 ──────────────────────────────────────────
export const MOCK_ADMIN_USERS = [
  { id:"U-2048", name:"홍길동", email:"hong@school.ac.kr",   role:"학생", joined:"2026-03-01", status:"활성",     lastLogin:"2시간 전" },
  { id:"U-2049", name:"김영희", email:"kim@school.ac.kr",    role:"학생", joined:"2026-03-01", status:"활성",     lastLogin:"어제" },
  { id:"U-1024", name:"김민준", email:"minjun@hs.ac.kr",     role:"교사", joined:"2026-02-15", status:"활성",     lastLogin:"오늘" },
  { id:"U-1025", name:"이수진", email:"sujin@school.ac.kr",  role:"교사", joined:"2026-01-20", status:"정지됨",   lastLogin:"1주일 전" },
  { id:"U-2050", name:"박지수", email:"jisoo@school.ac.kr",  role:"학생", joined:"2026-04-10", status:"활성",     lastLogin:"3일 전" },
  { id:"U-2051", name:"정하은", email:"haeun@school.ac.kr",  role:"학생", joined:"2026-03-20", status:"삭제됨",   lastLogin:"어제" },
];
export const MOCK_REPORTS = [
  { id:"R-901", target:"C-4729", type:"코멘트", reason:"욕설/비방", reports:3, status:"검토 중" },
  { id:"R-902", target:"U-2048", type:"사용자", reason:"스팸",      reports:1, status:"검토 중" },
];
export const MOCK_ANNOUNCEMENTS = [
  { id:"N-012", title:"2026년 2월 정기 점검 안내", target:"전체", status:"발행됨", publishedAt:Date.parse("2026-01-20") },
  { id:"N-011", title:"임베딩 모델 업데이트 완료",   target:"전체", status:"발행됨", publishedAt:Date.parse("2026-01-15") },
  { id:"N-013", title:"새 기능: 가지치기 추천 v2",   target:"전체", status:"예약됨", publishedAt:Date.parse("2026-01-25") },
  { id:"N-010", title:"서버 이전 완료",              target:"전체", status:"만료됨", publishedAt:Date.parse("2025-12-01") },
];
export const MOCK_STUDENTS = [
  { id:"20301", name:"홍길동", grade:"3-2", nodes:2847, last:"오늘 14:23", cm:1, sync:"동기화됨", activity:"활발" },
  { id:"20302", name:"김영희", grade:"3-2", nodes:1203, last:"오늘 11:05", cm:3, sync:"동기화됨", activity:"보통" },
  { id:"20215", name:"이철수", grade:"3-1", nodes:3112, last:"어제",       cm:0, sync:"동기화됨", activity:"활발" },
  { id:"20216", name:"박지수", grade:"3-1", nodes:892,  last:"3일 전",     cm:0, sync:"미동기화", activity:"낮음" },
  { id:"20421", name:"최민준", grade:"3-3", nodes:1567, last:"오늘 09:30", cm:2, sync:"동기화됨", activity:"보통" },
];

const _sleep = (ms = 400) => new Promise((r) => setTimeout(r, ms));
const _uid   = (p = "id") => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ── 목업 API 객체 (백엔드 미구현 도메인) ────────────────
export const mockApi = {
  comments: {
    async list()          { await _sleep(); return [...MOCK_COMMENTS]; },
    async create(c)       { await _sleep(); return { ...c, id:_uid("c"), createdAt:Date.now(), reports:0, status:"active" }; },
    async report(id, r)   { await _sleep(); return { id, reason:r, status:"검토 중" }; },
    async remove(id)      { await _sleep(); return { id }; },
  },
  teacher: {
    async submitVerification(p) { await _sleep(800); return { id:_uid("tapp"), ...p, status:"검토 중", submittedAt:Date.now() }; },
    async fetchVerificationStatus() { await _sleep(); return null; },
    async listStudents()  { await _sleep(); return [...MOCK_STUDENTS]; },
  },
  admin: {
    async listUsers()        { await _sleep(); return [...MOCK_ADMIN_USERS]; },
    async suspendUser(id,r)  { await _sleep(); return { id, status:"정지됨", reason:r }; },
    async deleteUser(id)     { await _sleep(); return { id, status:"삭제됨" }; },
    async listReports()      { await _sleep(); return [...MOCK_REPORTS]; },
    async resolveReport(id,a){ await _sleep(); return { id, action:a, status:"처리됨" }; },
    async listAnnouncements(){ await _sleep(); return [...MOCK_ANNOUNCEMENTS]; },
    async publishAnnouncement(a){ await _sleep(); return { ...a, id:_uid("ann"), publishedAt:Date.now() }; },
    async verifyTeacher(id,ok){ await _sleep(); return { id, status:ok?"승인됨":"반려됨" }; },
  },
};
