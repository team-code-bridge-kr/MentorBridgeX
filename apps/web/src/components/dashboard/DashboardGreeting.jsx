/**
 * 인사말.
 *
 * 이름은 로그인한 계정에서 온다 — 화면에 박아 두지 않는다.
 * 보조 문구는 **지금 실제로 있는 것**만 말한다. 볼 게 없는데 "확인할 자료가
 * 있어요"라고 하면 아래 카드를 보고 속았다고 느낀다.
 */

export function DashboardGreeting({ name, articleCount, feedbackCount }) {
  const sub =
    articleCount > 0 && feedbackCount > 0
      ? "새로운 자료와 피드백을 확인하고 탐구를 이어가 보세요."
      : articleCount > 0
        ? "오늘 확인할 새로운 탐구 자료가 있어요."
        : feedbackCount > 0
          ? "확인하지 않은 멘토 피드백이 있어요."
          : "오늘의 탐구를 시작해 보세요.";

  return (
    <div className="dash-hello">
      <p className="dash-hello-line">
        안녕하세요, {name}님 <span className="dash-hello-wave" aria-hidden="true">👋</span>
      </p>
      <p className="dash-hello-sub">{sub}</p>
    </div>
  );
}
