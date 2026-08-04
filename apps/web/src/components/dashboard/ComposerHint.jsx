/**
 * 입력창 안내문 자리에서 돌아가는 빠른 실행.
 *
 * "질문하거나 기사·논문·영상 링크를 입력하세요 · **기사를 그래프와 연결**"
 * 뒤쪽 문장만 한 번에 하나씩 바뀐다. 앞의 안내는 그대로 있어야 한다 —
 * 링크를 붙여도 된다는 사실은 처음 오는 학생에게 여전히 알려줘야 한다.
 *
 * 입력창 위에 겹쳐 놓되 **클릭은 통과시킨다**(pointer-events:none). 안내문을
 * 누르면 그냥 입력창에 커서가 들어가야지, 안내문이 버튼처럼 굴면 안 된다.
 * 눌리는 것은 돌아가는 문장 하나뿐이다.
 *
 * 글자를 한 자라도 치면 사라진다 — 쓰고 있는 문장 위에 다른 글자가 겹치면 안 된다.
 */

import { useCarousel } from "../../hooks/useCarousel.js";

// 추천 탐구(6초)와 어긋나게 둔다 — 둘이 같은 박자로 뛰면 화면이 깜빡이는 것처럼 보인다
const ROTATE_MS = 7500;

export function ComposerHint({ placeholder, actions, onPick, baseId }) {
  const car = useCarousel(actions.length, { auto: true, intervalMs: ROTATE_MS });
  const action = actions[car.index];

  return (
    <div className="composer-hint">
      {/* 진짜 placeholder 를 대신하므로, 화면에 안 보이는 사용자에게는
          textarea 의 aria-describedby 로 같은 문장을 읽힌다 */}
      <span className="composer-hint-base" id={baseId}>{placeholder}</span>
      {action && (
        <>
          <span className="composer-hint-dot" aria-hidden="true">·</span>
          <span className="composer-hint-slot">
            <button
              type="button"
              key={action.id + car.index}
              className="composer-hint-action"
              title={action.label}
              onClick={() => onPick(action)}
              {...car.pauseProps}
            >
              {action.label}
            </button>
          </span>
        </>
      )}
    </div>
  );
}
