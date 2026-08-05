/**
 * 온보딩 화면의 공통 껍데기 — 진행바, 제목, 뒤로가기, 하단 버튼.
 *
 * 단계마다 이 구조를 다시 쓰면 여백과 진행바 위치가 조금씩 어긋난다. 학생은
 * 5칸, 멘토·교사는 2칸이라 칸 수만 밖에서 받는다.
 *
 * **필수 표시는 별표가 아니라 비활성 버튼으로 한다.** 학생이 쓰는 화면이라
 * 서류 양식처럼 보이지 않는 편이 낫다(설계안 '화면 공통 규격').
 */

import { Back } from "../ui.jsx";

export function Progress({ total, current }) {
  return (
    <div
      className="ob-progress"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-label={`${total}단계 중 ${current}단계`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`ob-progress-cell${i < current ? " is-done" : ""}`} />
      ))}
    </div>
  );
}

export function Shell({
  total,
  current,
  title,
  accent,
  sub,
  emoji,
  onBack,
  children,
  footer,
  note,
}) {
  return (
    <div className="ob-wrap">
      <div className="ob-card">
        {total > 0 && <Progress total={total} current={current} />}
        <h1 className="ob-title">
          {/* 핵심 단어만 파랑으로 — 문장 전체를 강조하면 아무것도 강조되지 않는다 */}
          {accent ? (
            <>
              {title}
              <span className="ob-title-accent">{accent}</span>
            </>
          ) : (
            title
          )}
          {emoji && (
            <span className="ob-title-emoji" aria-hidden="true">
              {" "}
              {emoji}
            </span>
          )}
        </h1>
        {sub && <p className="ob-sub">{sub}</p>}

        <div className="ob-body">{children}</div>

        {(onBack || footer) && (
          <div className="ob-foot">
            {onBack ? (
              <Back label="이전으로" onClick={onBack} />
            ) : (
              <span />
            )}
            <div className="ob-foot-actions">{footer}</div>
          </div>
        )}
        {note && <p className="ob-note">{note}</p>}
      </div>
    </div>
  );
}
