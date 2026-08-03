/**
 * STEP 0 — 역할.
 *
 * 학생 카드를 넓게 둔다. 세 카드를 똑같이 그리면 "어느 쪽이 보통인지"가 안
 * 보이는데, 이 서비스를 쓰는 사람은 대부분 학생이다.
 *
 * 고르면 바로 다음으로 간다 — 확인 버튼을 한 번 더 누르게 할 이유가 없다.
 */

/* 이모지는 TossFace 에 있는 글자만 쓴다 — 없는 글자는 기기마다 다른 그림이 된다 */
const ROLES = [
  {
    id: "student",
    emoji: "🎓",
    label: "학생",
    desc: "탐구 주제를 찾고 관심 분야 소식을 받아볼래요",
    wide: true,
  },
  {
    id: "mentor",
    emoji: "🌱",
    label: "멘토",
    desc: "내 전공 경험을 후배들과 나누고 싶어요",
  },
  {
    id: "teacher",
    emoji: "👩‍🏫",
    label: "교사",
    desc: "학생들의 탐구활동을 지도하고 있어요",
  },
];

export function RoleStep({ value, onPick, busy }) {
  return (
    <div className="ob-role-grid">
      {ROLES.map((r) => (
        <button
          key={r.id}
          type="button"
          className={`ob-role${r.wide ? " is-wide" : ""}${value === r.id ? " is-on" : ""}`}
          onClick={() => onPick(r.id)}
          disabled={busy}
          aria-pressed={value === r.id}
        >
          <span className="ob-role-emoji" aria-hidden="true">
            {r.emoji}
          </span>
          <span className="ob-role-label">{r.label}</span>
          <span className="ob-role-desc">{r.desc}</span>
        </button>
      ))}
    </div>
  );
}
