// 내비게이션 메뉴 설정 & 레이아웃·권한 헬퍼

export const S_NAV = [
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

export const T_NAV = [
  { id:"T03",icon:"home",label:"대시보드" },
  { id:"T06",icon:"users",label:"담당 학생" },
  { id:"T11",icon:"comment",label:"코멘트" },
  { id:"S15",icon:"voice",label:"음성" },
  { id:"S20",icon:"form",label:"양식" },
  { id:"S25",icon:"bell",label:"알림" },
  { id:"S30",icon:"settings",label:"설정" },
];

export const A_NAV = [
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

export const SHARED_SCREENS = ["S15","S16","S17","S18","S19","S20","S21","S22","S25","S26","S27","S30","S31","S32"];
export function getLayout(s, sessionRole){
  if(["S01","S03","S04","A00"].includes(s))return "full";
  // 공용 화면(음성·양식·알림·설정)은 현재 로그인한 역할의 레이아웃으로 표시
  if(SHARED_SCREENS.includes(s) && sessionRole){
    return sessionRole==="teacher"?"teacher":sessionRole==="admin"?"admin":"student";
  }
  if(s.startsWith("T"))return "teacher";
  if(s.startsWith("A"))return "admin";
  return "student";
}
export const NO_HDR=["S06","S16","T07","T08"];

/* ──────────────────────────────────────────────────────────────
   SCREEN PICKER FAB
────────────────────────────────────────────────────────────── */

export const TITLES = {
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

