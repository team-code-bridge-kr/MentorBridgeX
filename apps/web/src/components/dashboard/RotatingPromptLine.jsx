/**
 * 추천 탐구 — 한 줄이 제자리에서 바뀐다.
 *
 * 앞선 판에서는 "추천 탐구 1/8 … ‹ ● ○ ○ ›" 처럼 조작부를 달았는데, 입력창 바로
 * 아래에 화살표와 점이 늘어서면 그게 또 하나의 위젯처럼 보인다. 여기서는 **틀은
 * 그대로 두고 문장만** 바뀐다 — 자리가 움직이지 않으니 아래 내용도 밀리지 않는다.
 *
 * 문장을 누르면 입력창에 채워 넣고 문맥도 함께 붙인다. **바로 보내지 않는다** —
 * 고치고 싶을 수도 있고, 무엇이 전송될지 눈으로 확인할 기회가 있어야 한다.
 *
 * 자동으로 도는 것은 읽는 사람이 없을 때뿐이다. 마우스를 올리거나 안에 포커스가
 * 있거나 탭이 뒤로 가면 멈추고, 모션을 줄이도록 설정한 사용자에게는 돌지 않는다.
 */

import { useCarousel } from "../../hooks/useCarousel.js";

const ROTATE_MS = 6000;

export function RotatingPromptLine({ prompts, onPick }) {
  const car = useCarousel(prompts.length, { auto: true, intervalMs: ROTATE_MS });
  const item = prompts[car.index];
  if (!item) return null;

  return (
    <div className="rp-line" {...car.pauseProps}>
      <span className="rp-line-label">추천 탐구</span>
      {/* 슬롯 높이를 고정해 문장이 바뀔 때 아래가 밀리지 않게 한다 */}
      <span className="rp-line-slot">
        <button
          type="button"
          key={item.id}
          className="rp-line-text"
          onClick={() => onPick(item)}
          title={item.text}
        >
          {item.text}
        </button>
      </span>
    </div>
  );
}
