/**
 * 입력창 안쪽 추천 실행 — 알약 두 개가 함께 바뀐다.
 *
 * 안내문("질문하거나 … 입력하세요") 아래 한 줄을 띄우고 그 밑에 선다. 채팅
 * 상담창이 대화를 시작하기 전에 던지는 예시 질문과 같은 자리다.
 *
 * **한 번에 둘만** 보여준다. 다섯 개를 늘어놓으면 고르는 일이 되고, 하나만
 * 두면 마음에 안 들 때 다음 것을 기다려야 한다. 둘이면 "이런 걸 물어도 되는
 * 곳이구나"가 바로 읽히면서도 고민거리가 되지 않는다.
 *
 * 짝은 매번 한 칸씩 밀려서 만든다 — 다섯 개면 (1,2) (3,4) (5,1) (2,3) … 로
 * 돌아 모든 항목이 골고루 나온다. 둘이 같이 나타나되 뒤엣것이 살짝 늦게 떠서
 * 한 덩어리로 갈리는 느낌이 나지 않게 한다.
 *
 * 글자를 한 자라도 치면 사라진다 — 쓰기 시작한 뒤에도 남아 있으면, 쓰던 문장을
 * 날리는 버튼이 손 밑에 놓인다.
 */

import { useMemo } from "react";
import { useCarousel } from "../../hooks/useCarousel.js";

const ROTATE_MS = 5000;
const PER_PAGE = 2;

/** 항목을 한 칸씩 밀며 둘씩 묶는다. 홀수여도 짝이 비지 않는다. */
function toPages(items) {
  const n = items.length;
  if (n === 0) return [];
  if (n <= PER_PAGE) return [items];
  // 짝수면 절반, 홀수면 한 바퀴 더 돌아야 모든 짝이 한 번씩 나온다
  const count = n % PER_PAGE === 0 ? n / PER_PAGE : n;
  return Array.from({ length: count }, (_, k) => [
    items[(k * PER_PAGE) % n],
    items[(k * PER_PAGE + 1) % n],
  ]);
}

export function ComposerSuggestions({ actions, onPick }) {
  const pages = useMemo(() => toPages(actions), [actions]);
  const car = useCarousel(pages.length, { auto: true, intervalMs: ROTATE_MS });
  const page = pages[car.index];
  if (!page?.length) return null;

  return (
    <div className="composer-suggest" role="group" aria-label="추천 실행" {...car.pauseProps}>
      {page.map((a, i) => (
        <button
          // 같은 자리에 다른 문장이 오면 다시 그려져야 전환이 보인다
          key={`${car.index}-${a.id}`}
          type="button"
          className={`cs-pill${car.reduce ? " is-static" : ""}`}
          style={i > 0 && !car.reduce ? { animationDelay: "90ms" } : undefined}
          title={a.label}
          onClick={() => onPick(a)}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
