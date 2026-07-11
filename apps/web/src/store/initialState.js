export const initialState = {
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
