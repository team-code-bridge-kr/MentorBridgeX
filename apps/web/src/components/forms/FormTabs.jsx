/**
 * 양식·보고서 화면의 머리띠 — 탐구 피드와 같은 밑줄 탭.
 *
 * 예전에는 "양식 템플릿"·"양식 결과물"·"결과물 상세" 가 각각 회색 제목 띠를
 * 이고 있는 **다른 화면 셋** 이었다. 하는 일은 하나(보고서를 쓰고 다시 본다)인데
 * 옮겨 다닐 길이 화면 안쪽 작은 단추뿐이라, 목록으로 가려면 어디를 눌러야
 * 하는지 매번 찾아야 했다.
 *
 * 탭 둘로 합친다. 상세(S22)에서도 같은 띠가 그대로 서 있고 "내 보고서"가
 * 켜져 있다 — 지금 보는 것이 그 목록 안의 하나라는 게 위치로 보인다.
 */

const TABS = [
  { id: "S20", label: "새로 쓰기" },
  { id: "S21", label: "내 보고서" },
];

export function FormTabs({ active, onNav }) {
  return (
    <div className="rs-tabs" role="tablist" aria-label="보고서">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          className={`rs-tab${active === t.id ? " on" : ""}`}
          onClick={() => active !== t.id && onNav(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
