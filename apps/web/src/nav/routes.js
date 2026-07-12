/** Screen id ↔ URL path mapping (SPA + nginx try_files). */

export const PUBLIC_SCREENS = ["S01", "S02", "S03", "S04", "A00", "T01"];

export function screenToPath(id) {
  if (id === "S01") return "/login";
  if (id === "S02") return "/oauth/callback";
  return `/${id}`;
}

export function pathToScreen(pathname) {
  if (!pathname || pathname === "/") return null;
  if (pathname.startsWith("/oauth/callback")) return "S02";
  if (pathname === "/login") return "S01";
  const m = pathname.match(/^\/([STA]\d+)$/i);
  return m ? m[1].toUpperCase() : null;
}

export function homeScreenForRole(role) {
  if (role === "admin") return "A01";
  if (role === "teacher") return "T03";
  return "S05";
}
