/**
 * 화면 ↔ 주소.
 *
 * 여태 주소가 `/S06`, `/S22` 였다. 화면을 만들 때 붙인 **내부 번호**를 그대로
 * 주소창에 내보낸 것이라, 학생이 보는 주소에는 아무 뜻이 없었다. 즐겨찾기를
 * 해도 무엇이었는지 알 수 없고, 남에게 보내면 더 그렇다. 무엇보다 화면을
 * 지우거나 번호를 바꾸면 주소가 통째로 흔들린다.
 *
 * 이름으로 바꾼다. 규칙 셋:
 *
 * 1. **하는 일**로 짓는다(화면 이름이 아니라). `/reports` 는 "양식 결과물"이
 *    아니라 보고서다 — 화면 제목이 바뀌어도 주소는 그대로여야 한다.
 * 2. **딸린 화면은 아래로 넣는다**(`/record/upload`). 어디에 속한 일인지
 *    주소만 봐도 보이고, 위로 잘라도 뜻이 통한다.
 * 3. **역할은 앞에 붙인다**(`/teacher/...`, `/admin/...`). 학생 화면과 같은
 *    이름을 써도 안 부딪히고, 주소만 봐도 누구의 화면인지 안다.
 *
 * 옛 주소(`/S06`)는 그대로 열린다 — 이미 나간 링크를 죽이지 않는다. 열리는
 * 순간 새 주소로 바꿔 놓으므로(App.jsx), 죽은 주소가 더 퍼지지는 않는다.
 */

/** 화면 → 주소. 여기 없는 화면은 `/S06` 꼴로 떨어진다(있으면 안 된다). */
export const SCREEN_PATH = {
  // ── 들어오는 길 ──
  S01: "/login",
  S02: "/oauth/callback",
  S03: "/welcome",              // 온보딩
  S04: "/welcome/keywords",     // 옛 시드 화면 — S03 으로 되돌려 보낸다

  // ── 학생 ──
  S05: "/dashboard",
  S06: "/graph",
  S09: "/graph/seed",
  S23: "/graph/prune",
  S11: "/record",               // 생기부 뷰어
  S12: "/record/edit",
  S13: "/record/upload",
  S14: "/record/review",
  S15: "/voice",
  S17: "/voice/review",
  S20: "/reports/new",
  S21: "/reports",
  S22: "/reports/view",
  S24: "/mentoring",
  S25: "/notifications",
  S28: "/stats",              // 없앤 화면 — 주소는 살려 두고 대시보드로 보낸다
  S30: "/settings",
  /* 없앤 화면. 주소는 살려 둔다 — 이미 나간 링크가 죽지 않도록 열어 주고,
     RETIRED(routes.js)가 설정으로 보낸 뒤 주소창을 /settings 로 바꾼다. */
  S31: "/settings/account",
  S32: "/settings/delete",
  S40: "/feed/tracks",
  S41: "/feed",
  S42: "/feed/keywords",
  S43: "/discover",
  S44: "/activity",

  // ── 교사 ──
  T01: "/teacher/verify",
  T02: "/teacher/verify/status",
  T03: "/teacher/dashboard",
  T04: "/teacher/students/add",
  T05: "/teacher/students/status",
  T06: "/teacher/students",
  T07: "/teacher/students/view",
  T08: "/teacher/students/graph",
  T09: "/teacher/students/node",
  T10: "/teacher/comments/new",
  T11: "/teacher/comments",
  T12: "/teacher/meeting",

  // ── 관리자 ──
  A00: "/admin/login",
  A01: "/admin",
  A02: "/admin/users",
  A03: "/admin/users/view",
  A04: "/admin/users/suspend",
  A05: "/admin/users/delete",
  A06: "/admin/verify",
  A07: "/admin/verify/view",
  A08: "/admin/reports",
  A09: "/admin/reports/view",
  A10: "/admin/reports/comments",
  A11: "/admin/reports/comments/delete",
  A12: "/admin/snapshots",
  A13: "/admin/health",
  A14: "/admin/metrics",
  A15: "/admin/embedding",
  A16: "/admin/embedding/swap",
  A17: "/admin/notices",
  A18: "/admin/notices/new",
  A19: "/admin/keys",
  A20: "/admin/redis",
  A21: "/admin/audit",
  A22: "/admin/audit/view",
  A23: "/admin/audit/export",
  A24: "/admin/investigation",
  A25: "/admin/master/subjects",
  A26: "/admin/master/templates",
  A27: "/admin/master/enums",
  A28: "/admin/settings",
  A29: "/admin/admins",
  A30: "/admin/admins/tier",
  A31: "/admin/me/activity",
  A32: "/admin/debug",
};

/** 주소 → 화면. 위 표를 뒤집어 만든다 — 두 곳을 손으로 맞추면 반드시 어긋난다. */
export const PATH_SCREEN = Object.fromEntries(
  Object.entries(SCREEN_PATH).map(([id, path]) => [path, id]),
);
