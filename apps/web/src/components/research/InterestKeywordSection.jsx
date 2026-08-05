/**
 * 내 관심 키워드 영역.
 *
 * 제목("내 관심 키워드")과 관리 버튼은 위쪽 한 줄(.feed-bar)이 갖는다. 여기는
 * **칩만** 그린다 — 제목을 두 군데서 그리면 화면에 같은 말이 두 번 나온다.
 *
 * 12개가 넘는 키워드를 다 펼치면 정작 기사가 화면 밖으로 밀린다. 기본은 6개까지
 * 보여주고 나머지는 +N 으로 접는다.
 *
 * 고른 키워드는 **채운 파랑**이다. 옅은 파랑으로 두었더니 흰 칩과 구분이 안 돼서
 * "지금 뭐가 걸려 있는지" 알 수 없었다. 지금 결과를 좁히고 있는 조건이므로
 * 눈에 띄어야 맞다.
 */

import { useState } from "react";
import { aliasHint } from "../../lib/keywordAliases.js";

const VISIBLE = 6;

export function InterestKeywordSection({ groups, selected, onToggle, loading, onRegister }) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <section className="kw-sec">
        <div className="kw-row" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => <span key={i} className="kw-skel" />)}
        </div>
      </section>
    );
  }

  if (!groups.length) {
    return (
      <section className="kw-sec">
        <div className="kw-empty">
          <p className="kw-empty-title">아직 등록된 관심 키워드가 없습니다.</p>
          <p className="kw-empty-sub">관심 분야를 등록하면 관련 뉴스와 논문을 추천해드려요.</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onRegister}>
            관심 키워드 등록하기
          </button>
        </div>
      </section>
    );
  }

  const shown = expanded ? groups : groups.slice(0, VISIBLE);
  const hidden = groups.length - shown.length;

  return (
    <section className="kw-sec">
      <div className="kw-row" role="group" aria-label="내 관심 키워드">
        {shown.map((g) => {
          const on = selected.includes(g.id);
          const hint = aliasHint(g);
          return (
            <button
              key={g.id}
              type="button"
              className={`kw-chip${on ? " is-on" : ""}`}
              aria-pressed={on}
              title={hint ? `검색어: ${hint}` : g.displayName}
              onClick={() => onToggle(g.id)}
            >
              {/* 색만으로 상태를 알리지 않는다 — 표시 문자를 함께 둔다 */}
              {on && <span className="kw-check" aria-hidden="true">✓</span>}
              {g.displayName}
            </button>
          );
        })}
        {hidden > 0 && (
          <button type="button" className="kw-chip is-more" onClick={() => setExpanded(true)}
            aria-label={`키워드 ${hidden}개 더 보기`}>
            +{hidden}
          </button>
        )}
        {expanded && groups.length > VISIBLE && (
          <button type="button" className="kw-chip is-more" onClick={() => setExpanded(false)}>
            접기
          </button>
        )}
      </div>
    </section>
  );
}
