/**
 * 기능 분류 pill — "무엇을 할 것인가".
 *
 * 예전에는 여기 구체적인 질문 다섯 개가 한 줄로 늘어서 있었다. 그러면 바로 위
 * 추천 질문과 같은 말을 두 번 하게 된다. 역할을 나눴다.
 *
 *   pill    = 어떤 작업을 시작할지 고른다 (분류)
 *   추천 질문 = 그 작업에서 구체적으로 무엇을 물을지 (문장)
 *
 * 그래서 pill 을 누르면 질문이 전송되는 게 아니라, 추천 질문 목록이 그 분류로
 * 좁혀진다. 고를 것이 없는 분류는 아예 보여주지 않는다 — 눌렀는데 아무 일도
 * 없는 버튼을 두지 않기 위해서다.
 */

import { CATEGORIES } from "../../hooks/useRecommendedPrompts.js";

export function ExplorationCategoryPills({ prompts, active, onSelect }) {
  const available = CATEGORIES.filter((c) => prompts.some((p) => p.category === c.id));
  if (available.length === 0) return null;

  return (
    <div className="cat-pills" role="group" aria-label="탐구 분류">
      {available.map((c) => {
        const on = active === c.id;
        return (
          <button
            key={c.id}
            type="button"
            className={`cat-pill${on ? " is-on" : ""}`}
            aria-pressed={on}
            onClick={() => onSelect(on ? null : c.id)}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
