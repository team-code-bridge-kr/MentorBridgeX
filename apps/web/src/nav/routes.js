/** Screen id ↔ URL path mapping (SPA + nginx try_files). */

// 로그인 없이 볼 수 있는 화면. 온보딩(S03/S04)은 여기서 빠졌다 — 서버에 상태를
// 저장하려면 토큰이 있어야 하고, 없으면 불러오는 중에서 멈춘 화면이 된다.
export const PUBLIC_SCREENS = ["S01", "S02", "A00", "T01"];

/** 온보딩 화면. 역할이 정해지기 전이라 역할 검사에서 빼야 한다. */
export const ONBOARDING_SCREEN = "S03";

export function screenToPath(id) {
  if (id === "S01") return "/login";
  if (id === "S02") return "/oauth/callback";
  return `/${id}`;
}

/**
 * 없앤 화면 → 그 일을 이어받은 화면.
 * 예전 주소를 눌러도 빈 화면이 나오지 않게 한다.
 *   S16(녹음 중) — 녹음은 화면이 아니라 도크(VoiceDock)가 맡는다. 목록으로 보낸다.
 */
const RETIRED = { S16: "S15", S27: "S44" };

export function pathToScreen(pathname) {
  if (!pathname || pathname === "/") return null;
  if (pathname.startsWith("/oauth/callback")) return "S02";
  if (pathname === "/login") return "S01";
  const m = pathname.match(/^\/([STA]\d+)$/i);
  if (!m) return null;
  const id = m[1].toUpperCase();
  return RETIRED[id] || id;
}

export function homeScreenForRole(role, grade) {
  if (role === "admin") return "A01";
  if (role === "teacher") return "T03";
  // 멘토 전용 대시보드는 아직 없다. 가장 가까운 화면(멘토링)으로 보낸다.
  if (role === "mentor") return "S24";
  // 1학년은 좁혀 주는 화면(대시보드)보다 넓히는 화면(발견)이 먼저다.
  return grade === "1" ? "S43" : "S05";
}
