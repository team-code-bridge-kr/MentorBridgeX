import { describe, it, expect } from "vitest";
import { SCREEN_PATH, PATH_SCREEN } from "./paths.js";
import { screenToPath, pathToScreen } from "./routes.js";
import { TITLES } from "./menus.js";

describe("주소 표", () => {
  it("모든 화면에 이름이 붙어 있다", () => {
    // 화면을 새로 만들고 이름 붙이는 것을 잊으면 주소창에 `/S33` 이 뜬다.
    const missing = Object.keys(TITLES).filter((id) => !SCREEN_PATH[id]);
    expect(missing, `이름 없는 화면: ${missing.join(", ")}`).toEqual([]);
  });

  it("두 화면이 같은 주소를 쓰지 않는다", () => {
    // 겹치면 뒤엣것이 이겨서, 앞엣 화면은 주소로 영영 못 연다.
    const paths = Object.values(SCREEN_PATH);
    expect(paths.length).toBe(new Set(paths).size);
  });

  it("주소는 빗금으로 시작하고 빗금으로 끝나지 않는다", () => {
    for (const [id, path] of Object.entries(SCREEN_PATH)) {
      expect(path.startsWith("/"), `${id} → ${path}`).toBe(true);
      expect(path.endsWith("/"), `${id} → ${path}`).toBe(false);
    }
  });

  it("주소에 화면 번호가 남아 있지 않다", () => {
    for (const [id, path] of Object.entries(SCREEN_PATH)) {
      expect(/\/[STA]\d\d(\/|$)/.test(path), `${id} → ${path}`).toBe(false);
    }
  });

  it("갔다 오면 제자리다", () => {
    for (const id of Object.keys(SCREEN_PATH)) {
      // 없앤 화면(RETIRED)은 이어받은 화면으로 가므로 제자리로 안 온다.
      const back = pathToScreen(screenToPath(id));
      expect(PATH_SCREEN[SCREEN_PATH[id]]).toBe(id);
      expect(back, `${id} → ${screenToPath(id)} → ${back}`).toBeTruthy();
    }
  });
});

describe("pathToScreen", () => {
  it("이름 주소를 읽는다", () => {
    expect(pathToScreen("/graph")).toBe("S06");
    expect(pathToScreen("/reports/view")).toBe("S22");
    expect(pathToScreen("/teacher/students")).toBe("T06");
    expect(pathToScreen("/admin/audit/export")).toBe("A23");
  });

  it("끝의 빗금은 무시한다", () => {
    // 손으로 쳐서 들어오는 사람이 자주 붙인다.
    expect(pathToScreen("/graph/")).toBe("S06");
    expect(pathToScreen("/record/upload/")).toBe("S13");
  });

  it("옛 번호 주소도 열어 준다", () => {
    // 이미 나간 링크를 죽이지 않는다. 열리는 순간 App 이 새 주소로 바꾼다.
    expect(pathToScreen("/S06")).toBe("S06");
    expect(pathToScreen("/S22")).toBe("S22");
  });

  it("없앤 화면은 이어받은 화면으로 보낸다", () => {
    expect(pathToScreen("/S07")).toBe("S06");   // 노드 상세 → 그래프
    expect(pathToScreen("/S29")).toBe("S30");   // 내보내기 → 설정
    // S04 는 화면 자체가 온보딩으로 되돌려 보낸다(RETIRED 가 아니다).
    expect(pathToScreen("/welcome/keywords")).toBe("S04");
  });

  it("모르는 주소는 아무것도 아니다", () => {
    expect(pathToScreen("/없는곳")).toBe(null);
    expect(pathToScreen("/")).toBe(null);
    expect(pathToScreen("")).toBe(null);
  });

  it("구글이 돌려보내는 주소를 읽는다", () => {
    expect(pathToScreen("/oauth/callback")).toBe("S02");
    expect(pathToScreen("/oauth/callback?code=abc")).toBe("S02");
  });
});
