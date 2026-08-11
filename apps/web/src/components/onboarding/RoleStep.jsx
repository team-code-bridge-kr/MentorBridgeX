/**
 * STEP 0 — 역할.
 *
 * 학생 카드를 넓게 둔다. 세 카드를 똑같이 그리면 "어느 쪽이 보통인지"가 안
 * 보이는데, 이 서비스를 쓰는 사람은 대부분 학생이다.
 *
 * 고르면 바로 다음으로 간다 — 확인 버튼을 한 번 더 누르게 할 이유가 없다.
 *
 * 이모지(🎓🌱👩‍🏫) 대신 앱이 쓰는 선 아이콘을 쓴다. 이 화면은 사람이 MBX 에서
 * **처음 보는 화면**인데, 여기만 그림 이모지고 들어가면 온통 선 아이콘이라
 * 다른 앱으로 넘어온 것처럼 보였다.
 */

import { NavIcon } from "../NavIcon.jsx";

const ROLES = [
  {
    id: "student",
    icon: "bookOpen",   // 탐구 피드가 쓰는 아이콘 — 학생이 여기서 하는 일이다
    label: "학생",
    desc: "탐구 주제를 찾고 관심 분야 소식을 받아볼래요",
    wide: true,
  },
  {
    id: "mentor",
    icon: "leaf",
    label: "멘토",
    desc: "내 전공 경험을 후배들과 나누고 싶어요",
  },
  {
    id: "teacher",
    icon: "users",      // 교사 메뉴의 「담당 학생」과 같은 아이콘
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
          <span className="ob-role-ic" aria-hidden="true">
            <NavIcon name={r.icon} size={24} color="currentColor" />
          </span>
          <span className="ob-role-label">{r.label}</span>
          <span className="ob-role-desc">{r.desc}</span>
        </button>
      ))}
    </div>
  );
}
