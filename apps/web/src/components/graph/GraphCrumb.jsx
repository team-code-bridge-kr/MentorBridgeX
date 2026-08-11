/**
 * 경로표시 — 뿌리에서 지금 층까지의 길.
 *
 * **자리는 하나다.** 판이 열려 있으면 판 머리에 서고, 아니면 캔버스 위 제 줄에
 * 선다. 예전에는 왼쪽 제 줄에만 서고 판 머리에는 「〈 부모」 단추가 따로
 * 있었다 — 같은 것(어디 있고 어떻게 나가는지)을 화면 양끝에서 두 번 말한
 * 셈이라, 판을 읽다 보면 어느 쪽이 진짜인지 헷갈렸다. 판을 읽는 동안 눈은
 * 오른쪽에 있으니, 판이 서 있을 때는 길도 오른쪽에 둔다.
 *
 * 뿌리 층에서는 아예 세우지 않는다 — "내 생기부" 한 칸만 있는 경로는 길이
 * 아니라 이름이다.
 */
export function GraphCrumb({ trail, onGo, className = "" }) {
  if (trail.length < 2) return null;
  return (
    <nav className={`gcrumb ${className}`.trim()} aria-label="현재 위치">
      {/* 갈매기는 칸 **뒤에** 붙인다. 앞에 붙이면 좁은 판에서 줄이 접힐 때
          다음 줄이 "› 행동특성…" 으로 시작해, 뭔가 잘려 나간 것처럼 읽힌다.
          뒤에 두면 앞 줄이 갈매기로 끝나 "이어진다" 는 뜻이 된다. */}
      {trail.map((n, i) => (
        <span key={n.id}>
          <button
            type="button"
            className={`gcrumb-item${i === trail.length - 1 ? " is-here" : ""}`}
            aria-current={i === trail.length - 1 ? "true" : undefined}
            onClick={() => onGo(n)}
          >
            {n.label}
          </button>
          {i < trail.length - 1 && <span className="gcrumb-sep" aria-hidden>›</span>}
        </span>
      ))}
    </nav>
  );
}
