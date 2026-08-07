/**
 * 테스트 환경 준비.
 *
 * jsdom 에는 **레이아웃 엔진이 없다.** 모든 요소의 크기가 0이라, 그래프 화면처럼
 * 픽셀을 재서 자리를 정하는 코드는 아무것도 안 그리고 끝난다(이름표도 접기
 * 손잡이도 캔버스 크기가 0이면 계산 자체를 건너뛴다). 그래서 실제 화면만 한
 * 크기를 흉내 내 준다.
 *
 * 여기서 **재는 값만** 채우고 그리기는 흉내 내지 않는다. 색이 맞는지·줄이 어디서
 * 접히는지 같은 것은 jsdom 이 답할 수 없는 물음이라 눈으로 봐야 한다.
 */
import { afterEach, beforeEach, vi } from "vitest";

// React 에게 "여기는 시험판이다" 라고 알린다. 없으면 act() 로 감싸도
// "not configured to support act(...)" 경고가 쏟아져 진짜 오류가 묻힌다.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** 테스트가 가정하는 캔버스 크기. 실제 데스크톱 화면과 비슷하게 잡는다. */
export const VIEWPORT = { width: 1100, height: 700 };

beforeEach(() => {
  window.ResizeObserver = class {
    constructor(cb) { this.cb = cb; }
    observe(el) {
      this.cb([{ target: el, contentRect: { ...VIEWPORT, top: 0, left: 0, bottom: VIEWPORT.height, right: VIEWPORT.width } }], this);
    }
    unobserve() {}
    disconnect() {}
  };
  globalThis.ResizeObserver = window.ResizeObserver;

  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return { x: 0, y: 0, top: 0, left: 0, right: VIEWPORT.width, bottom: VIEWPORT.height, ...VIEWPORT, toJSON() {} };
  };

  window.scrollTo = () => {};
  if (!window.matchMedia) {
    window.matchMedia = (q) => ({
      matches: false, media: q,
      addListener() {}, removeListener() {},
      addEventListener() {}, removeEventListener() {},
    });
  }
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});
