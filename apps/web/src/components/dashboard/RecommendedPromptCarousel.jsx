/**
 * 추천 탐구 질문 — 한 번에 하나, **자동으로 넘어가지 않는다.**
 *
 * 위쪽 기사 카드가 이미 8초마다 돌아간다. 입력창 바로 아래까지 저절로 움직이면
 * 무엇을 쓰려던 중이었는지 놓친다. 여기서는 사용자가 누를 때만 넘어간다.
 *
 * 문장을 누르면 입력창에 채워 넣고 문맥도 함께 붙인다. **바로 보내지 않는다** —
 * 고치고 싶을 수도 있고, 무엇이 전송될지 눈으로 확인할 기회가 있어야 한다.
 */

import { useCarousel } from "../../hooks/useCarousel.js";
import { CarouselControls } from "./CarouselControls.jsx";

export function RecommendedPromptCarousel({ prompts, onPick }) {
  const car = useCarousel(prompts.length, { auto: false });
  const item = prompts[car.index];
  if (!item) return null;

  return (
    <div className="rp" {...car.pauseProps}>
      <div className="rp-hdr">
        <span className="rp-label">추천 탐구</span>
        {prompts.length > 1 && (
          <span className="rp-count">
            {car.index + 1} / {prompts.length}
          </span>
        )}
      </div>
      <div className="rp-row">
        <button
          type="button"
          className="rp-text"
          onClick={() => onPick(item)}
          title={item.text}
          key={item.id}
        >
          {item.text}
        </button>
        <CarouselControls
          index={car.index}
          total={prompts.length}
          onPrev={car.prev}
          onNext={car.next}
          onGo={car.go}
          label="추천 질문"
        />
      </div>
    </div>
  );
}
