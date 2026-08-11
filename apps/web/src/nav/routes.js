/** Screen id ↔ URL path mapping (SPA + nginx try_files). */

import { PATH_SCREEN, SCREEN_PATH } from "./paths.js";

// 로그인 없이 볼 수 있는 화면. 온보딩(S03/S04)은 여기서 빠졌다 — 서버에 상태를
// 저장하려면 토큰이 있어야 하고, 없으면 불러오는 중에서 멈춘 화면이 된다.
export const PUBLIC_SCREENS = ["S01", "S02", "A00", "T01"];

/** 온보딩 화면. 역할이 정해지기 전이라 역할 검사에서 빼야 한다. */
export const ONBOARDING_SCREEN = "S03";

export function screenToPath(id) {
  // 표에 없으면 옛 방식(/S06)으로 떨어진다. 화면을 새로 만들고 이름 붙이는
  // 것을 잊어도 주소가 깨지지는 않게 — 대신 주소창에 번호가 보여서 티가 난다.
  return SCREEN_PATH[id] || `/${id}`;
}

/**
 * 없앤 화면 → 그 일을 이어받은 화면.
 * 예전 주소를 눌러도 빈 화면이 나오지 않게 한다.
 *   S16(녹음 중) — 녹음은 화면이 아니라 도크(VoiceDock)가 맡는다. 목록으로 보낸다.
 */
const RETIRED = {
  S16: "S15",   // 녹음은 화면이 아니라 도크(VoiceDock)가 맡는다
  S27: "S44",
  /* 아래 일곱은 **지어낸 데이터로 만든 시안**이었다. "양자컴퓨팅"·"node-001"
     처럼 아무 학생의 것도 아닌 값을 서버 없이 화면에 박아 둔 것들이라,
     주소로 들어오면 남의 기록처럼 보이는 화면이 떴다. 지우고 진짜 일을
     하는 화면으로 보낸다. */
  S07: "S06",   // 노드 상세 → 그래프(누르면 그 자리에서 파고든다)
  S08: "S06",   // 엣지 상세 → 그래프
  S10: "S06",   // 변경 이력 → 그래프
  S18: "S15",   // 참여자 관리 → 음성 세션
  S19: "S06",   // 매칭 제안 → 그래프(진짜 제안은 그래프 안에 있다)
  S26: "S44",   // 활동 피드 → 활동 기록(같은 것을 진짜 데이터로 한다)
  S29: "S30",   // 내보내기 → 설정(내보내기 기능 자체가 없었다)
  /* 프로필 편집 → 설정. 설정 화면과 똑같은 넉 줄(이름·이메일·역할·제공자)을
     다시 보여주면서 이름 한 칸만 고칠 수 있었고, 나머지 절반은 통계 화면
     (S28)이 이미 하는 일이었다. 이름은 이제 설정에서 바로 고친다. */
  S31: "S30",
};

export function pathToScreen(pathname) {
  if (!pathname || pathname === "/") return null;
  // 구글이 돌려보낼 때 `?code=…` 가 붙는다
  if (pathname.startsWith("/oauth/callback")) return "S02";

  // 끝의 빗금은 있으나 없으나 같은 곳이다(`/graph/` 로 손으로 쳐서 들어오는 일)
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const named = PATH_SCREEN[clean];
  if (named) return RETIRED[named] || named;

  /* 옛 주소(`/S06`). 이미 나간 링크를 죽이지 않는다 — 열어 주고, App 이
     주소창을 새 이름으로 바꿔 놓는다. */
  const m = clean.match(/^\/([STA]\d+)$/i);
  if (!m) return null;
  const id = m[1].toUpperCase();
  return RETIRED[id] || id;
}

export function homeScreenForRole(role, grade) {
  if (role === "admin") return "A01";
  if (role === "teacher") return "T03";
  // 멘토 전용 대시보드는 아직 없다. 가장 가까운 화면(멘토링)으로 보낸다.
  if (role === "mentor") return "S24";
  // 1학년도 대시보드로 보낸다. 예전에는 넓혀 주는 화면(발견, S43)이 먼저였는데,
  // 그 화면이 사이드바에서 빠지면서 **한 번 나가면 돌아갈 길이 없어졌다.**
  // 메뉴에 없는 곳에 떨어뜨려 놓는 것이 넓혀 주는 것보다 나쁘다.
  return "S05";
}
