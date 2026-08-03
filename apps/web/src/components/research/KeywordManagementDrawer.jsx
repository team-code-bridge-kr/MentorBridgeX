/**
 * 관심 키워드 관리 서랍.
 *
 * "＋ 키워드 수정" 버튼은 누르면 바로 뭔가 추가될 것처럼 보였다. 여기서는
 * **등록된 관심사를 관리하는 곳**이라는 게 드러나도록 목록·추가·추천을
 * 한 화면에 모았다.
 *
 * 추천 키워드는 내 키워드와 **섞지 않는다.** 아래 별도 구역에 두고, 누르면
 * "관심 키워드로 추가"인지 "이 키워드로 검색"인지 고르게 한다 — 눌렀더니
 * 내 관심사가 바뀌어 있는 일이 없어야 한다.
 *
 * 추천 근거는 서버가 준 값(읽은 글에서 나온 빈도)을 그대로 쓴다. 지식 그래프
 * 기반 추천은 아직 API 가 없어 만들지 않았다.
 */

import { useState } from "react";
import { Drawer } from "../ui/Popover.jsx";
import { aliasHint } from "../../lib/keywordAliases.js";

export function KeywordManagementDrawer({
  open, onClose, groups, suggestions, onAdd, onRemove, onSearch,
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [menuFor, setMenuFor] = useState(null);

  const add = async (word) => {
    setBusy(true);
    setErr("");
    try {
      await onAdd(word);
      setDraft("");
      setMenuFor(null);
    } catch (e) {
      setErr(e.message || "추가하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (word) => {
    setErr("");
    try {
      await onRemove(word);
    } catch (e) {
      setErr(e.message || "삭제하지 못했습니다.");
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title="관심 키워드 관리">
      <section className="kwm-sec">
        <h3 className="kwm-title">내 관심 키워드 <span className="kwm-count">{groups.length}</span></h3>
        {groups.length === 0 && <p className="kwm-empty">아직 등록한 키워드가 없습니다.</p>}
        <ul className="kwm-list">
          {groups.map((g) => (
            <li key={g.id} className="kwm-item">
              <div className="kwm-item-main">
                <span className="kwm-item-name">{g.displayName}</span>
                {/* 한글·영문을 화면에서 합쳤다는 사실을 숨기지 않는다 */}
                {g.searchTerms.length > 1 && (
                  <span className="kwm-item-alias">검색어 {g.searchTerms.length}개 · {aliasHint(g)}</span>
                )}
              </div>
              <div className="kwm-item-acts">
                {g.searchTerms.map((t) => (
                  <button key={t} type="button" className="kwm-del" onClick={() => remove(t)}
                    aria-label={`${t} 삭제`} title={`${t} 삭제`}>
                    {g.searchTerms.length > 1 ? `${t} ×` : "삭제"}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>

        <form
          className="kwm-add"
          onSubmit={(e) => { e.preventDefault(); add(draft); }}
        >
          <input
            className="kwm-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="키워드 추가 (예: 양자컴퓨팅)"
            maxLength={40}
            aria-label="키워드 추가"
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !draft.trim()}>
            추가
          </button>
        </form>
        {err && <p className="kwm-err" role="alert">{err}</p>}
      </section>

      {suggestions.length > 0 && (
        <section className="kwm-sec">
          <h3 className="kwm-title">MBX 추천 키워드</h3>
          <p className="kwm-hint">내가 읽은 글에 자주 나온 개념입니다.</p>
          <div className="kw-row">
            {suggestions.slice(0, 10).map((s) => (
              <span key={s.term} className="kwm-sug-wrap">
                <button
                  type="button"
                  className="kw-chip is-sug"
                  onClick={() => setMenuFor(menuFor === s.term ? null : s.term)}
                  aria-expanded={menuFor === s.term}
                  aria-haspopup="menu"
                >
                  ＋ {s.term}
                </button>
                {menuFor === s.term && (
                  <span className="kwm-menu" role="menu">
                    <span className="kwm-menu-why">
                      읽은 글 {s.article_count}건에서 나왔습니다
                    </span>
                    <button type="button" role="menuitem" onClick={() => add(s.term)} disabled={busy}>
                      관심 키워드에 추가
                    </button>
                    <button type="button" role="menuitem"
                      onClick={() => { onSearch(s.term); setMenuFor(null); onClose(); }}>
                      이 키워드로 검색
                    </button>
                    <button type="button" role="menuitem" onClick={() => setMenuFor(null)}>취소</button>
                  </span>
                )}
              </span>
            ))}
          </div>
        </section>
      )}
    </Drawer>
  );
}
