import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // 로컬 백엔드 프록시 — VITE_API_BASE_URL 없이도 /v1/** 요청이 백엔드로 연결됨
    proxy: {
      "/v1": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  // ── 테스트 ────────────────────────────────────────────────
  // 화면을 실제로 그려 봐야만 드러나는 것이 있다. 빌드는 문법과 import 만 보고,
  // "정의보다 먼저 쓴 값", "훅 순서", "고른 노드가 도로 풀리는" 따위는 그려 봐야 안다.
  // 그래서 jsdom 에서 진짜로 마운트한다.
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
    include: ["src/**/*.test.{js,jsx}"],
    // 화면 테스트는 파일마다 DOM 을 새로 쓰므로 서로 섞이지 않게 갈라 둔다.
    restoreMocks: true,
  },
});
