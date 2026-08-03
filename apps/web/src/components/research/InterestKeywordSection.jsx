/**
 * 내 관심 키워드 영역.
 *
 * 예전에는 키워드·기간·관리 버튼이 전부 같은 알약 모양으로 한 줄에 섞여 있어서,
 * 무엇이 내 관심사이고 무엇이 지금 걸린 조건인지 구분되지 않았다. 여기서는
 * **제목을 달고 영역을 따로 떼어** 성격이 다르다는 것을 먼저 보이게 한다.
 *
 * 12개가 넘는 키워드를 다 펼치면 정작 기사가 화면 밖으로 밀린다. 기본은 6개까지
 * 보여주고 나머지는 +N 으로 접는다.
 *
 * 선택 표시는 **옅은 파랑**이다. 진한 파랑으로 채우면 "원문 보기" 같은 주요
 * 버튼과 같은 무게가 되어, 필터가 화면에서 제일 강해진다.
 */

import { useState } from "react";
import { aliasHint } from "../../lib/keywordAliases.js";

const VISIBLE = 6;

export function InterestKeywordSection({ groups, selected, onToggle, onManage, loading, onRegister }) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <section className="kw-sec">
        <h2 className="kw-sec-title">내 관심 키워드</h2>
        <div className="kw-row" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => <span key={i} className="kw-skel" />)}
        </div>
      </section>
    );
  }

  if (!groups.length) {
    return (
      <section className="kw-sec">
        <h2 className="kw-sec-title">내 관심 키워드</h2>
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
      <div className="kw-sec-hdr">
        <h2 className="kw-sec-title">내 관심 키워드</h2>
        <button type="button" className="kw-manage" onClick={onManage}>
          <span aria-hidden="true">⚙</span> 키워드 관리
        </button>
      </div>

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
