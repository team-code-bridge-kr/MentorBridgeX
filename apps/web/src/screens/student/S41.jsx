/**
 * S41 — 탐구 피드
 *
 * 블로그처럼 읽힌다: 맨 위 한 편(히어로) + 카드 세 편 + 나머지는 줄글 목록.
 * 목록만 길게 늘어놓으면 "오늘 무엇부터 볼지"를 스스로 정해야 해서 딱딱하다.
 *
 * 저작권상 제목 + 요약 2~3문장 + 원문 링크까지만 보여준다. 전문은 저장하지도
 * 표시하지도 않는다. 이미지도 갖고 있지 않아서(남의 이미지를 끌어다 쓰지도
 * 않는다) 썸네일 자리는 키워드로 만든 판(ArticleVisual)으로 채운다.
 *
 * 페이지네이션은 백엔드의 keyset 커서를 그대로 이어받는다. 히어로·카드는
 * **첫 페이지의 앞 4개**로 고정된다 — 스크롤로 더 불러올 때마다 맨 위가
 * 바뀌면 읽던 자리를 잃는다.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import api from "../../api/index.js";
import { ArticleVisual } from "../../components/research/ArticleVisual.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

const FEATURED = 4; // 히어로 1 + 카드 3

// 기간 필터. 값은 일 단위이고 0 은 제한 없음 (백엔드 feed.PERIODS 와 같아야 한다)
const PERIODS = [
  { days: 0, label: "전체 기간" },
  { days: 7, label: "최근 1주" },
  { days: 30, label: "최근 1개월" },
  { days: 90, label: "최근 3개월" },
];

const TABS = [
  { id: "all", label: "전체" },
  { id: "news", label: "뉴스" },
  { id: "paper", label: "논문" },
  { id: "saved", label: "저장함" },
];

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function S41({ onNav }) {
  const [tab, setTab] = useState("all");
  // 입력 중인 글자(draft)와 실제로 조회에 쓰는 검색어(query)를 나눈다.
  // 타이핑마다 서버를 부르면 한 글자씩 칠 때마다 피드가 깜빡인다.
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [days, setDays] = useState(0);
  const [keywords, setKeywords] = useState([]);
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [checkedProfile, setCheckedProfile] = useState(false);
  const sentinel = useRef(null);

  // 온보딩 게이트 — 트랙을 아직 고르지 않았으면 S40 으로 보낸다
  useEffect(() => {
    api.research
      .profile()
      .then((p) => {
        if (!p.onboarded) onNav("S40");
        else setCheckedProfile(true);
      })
      .catch((e) => {
        setErr(e.message || "프로필을 불러오지 못했습니다.");
        setCheckedProfile(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(
    async (nextTab, nextCursor, nextQuery = "", nextDays = 0) => {
      setLoading(true);
      setErr("");
      try {
        const data = await api.research.feed({
          tab: nextTab,
          cursor: nextCursor,
          query: nextQuery,
          days: nextDays,
        });
        setItems((prev) => (nextCursor ? [...prev, ...data.items] : data.items));
        setCursor(data.next_cursor);
        setDone(!data.next_cursor);
      } catch (e) {
        setErr(e.message || "피드를 불러오지 못했습니다.");
        setDone(true);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!checkedProfile) return;
    setItems([]);
    setCursor(null);
    setDone(false);
    load(tab, null, query, days);
  }, [tab, query, days, checkedProfile, load]);

  // 내 키워드 — 칩으로 눌러 바로 모아볼 수 있게 한다
  useEffect(() => {
    if (!checkedProfile) return;
    api.research.keywords().then(setKeywords).catch(() => {});
  }, [checkedProfile]);

  // 무한 스크롤 — 바닥 센티넬이 보이면 다음 페이지
  useEffect(() => {
    const node = sentinel.current;
    if (!node || done || loading) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && cursor) load(tab, cursor, query, days);
      },
      { rootMargin: "300px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [cursor, done, loading, tab, query, days, load]);

  const openArticle = (item) => {
    // 낙관적 표시 — 읽음 기록 실패가 링크 이동을 막을 이유는 없다
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
    api.research.markRead(item.id).catch(() => {});
  };

  const toggleSave = async (item) => {
    const next = !item.saved;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, saved: next } : i)));
    try {
      await api.research.setSaved(item.id, next);
      if (tab === "saved" && !next) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      }
    } catch {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, saved: !next } : i)));
    }
  };

  // 히어로·카드는 앞 4개 고정. 4개가 안 되면 굳이 큰 판을 만들지 않고
  // 전부 줄글로 보여준다 — 한두 개짜리 히어로는 허전하기만 하다.
  const featured = items.length >= FEATURED ? items.slice(0, FEATURED) : [];
  const hero = featured[0] || null;
  const cards = featured.slice(1);
  const rest = items.slice(featured.length);

  const search = (term) => {
    const next = term.trim();
    setDraft(next);
    setQuery(next);
  };
  const clearSearch = () => { setDraft(""); setQuery(""); };

  const registered = keywords.some((k) => k.keyword === query);
  const addCurrentKeyword = async () => {
    try {
      setKeywords(await api.research.addKeyword(query));
    } catch (e) {
      setErr(e.message || "키워드를 추가하지 못했습니다.");
    }
  };

  // 왜 비었는지까지 말해준다. 특히 영문 키워드는 국내 기사에 거의 안 나와서
  // "검색이 고장났나" 로 읽히기 쉽다.
  const asciiQuery = /^[\x00-\x7F]+$/.test(query);
  const emptyMessage =
    tab === "saved"
      ? "저장한 글이 없습니다.\n피드에서 마음에 드는 글의 ‘저장’을 눌러보세요."
      : query
        ? `‘${query}’로 찾은 글이 없습니다.\n` +
          (days ? "기간을 넓혀보거나, " : "") +
          (asciiQuery
            ? "한글 표현으로도 찾아보세요 (예: cloud computing → 클라우드).\n국내 기사에는 영문 용어가 거의 그대로 쓰이지 않습니다."
            : "영문 표현으로도 찾아보세요 — 논문은 대부분 영어입니다.")
        : "아직 보여드릴 글이 없습니다.\n키워드를 늘리거나 잠시 후 다시 확인해 주세요.";

  return (
    <div className="rs-wrap">
      <div className="rs-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`rs-tab${tab === t.id ? " on" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form
        className="feed-search"
        onSubmit={(e) => { e.preventDefault(); search(draft); }}
        role="search"
      >
        <NavIcon name="search" size={19} color="var(--tt)" />
        <input
          className="feed-search-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="핵심 키워드로 기사 모아보기 (예: 반도체, 기후변화)"
          aria-label="키워드로 기사 검색"
          maxLength={60}
        />
        {draft && (
          <button type="button" className="feed-search-x" onClick={clearSearch} aria-label="검색어 지우기">
            ×
          </button>
        )}
        <button type="submit" className="feed-search-go" aria-label="검색">
          <NavIcon name="arrowRight" size={18} color="#fff" />
        </button>
      </form>

      <div className="feed-kw-row">
        {keywords.slice(0, 12).map((k) => (
          <button
            key={k.keyword}
            type="button"
            className={`quick-chip${query === k.keyword ? " on" : ""}`}
            onClick={() => (query === k.keyword ? clearSearch() : search(k.keyword))}
          >
            {k.keyword}
          </button>
        ))}
        <button type="button" className="quick-chip is-manage" onClick={() => onNav("S42")}>
          ＋ 키워드 수정
        </button>
      </div>

      <div className="feed-period" role="group" aria-label="검색 기간">
        {PERIODS.map((p) => (
          <button
            key={p.days}
            type="button"
            className={`quick-chip${days === p.days ? " on" : ""}`}
            aria-pressed={days === p.days}
            onClick={() => setDays(p.days)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {query && (
        <div className="feed-search-state" role="status">
          <span>
            <strong>‘{query}’</strong> 검색 결과
            {/* 등록하지 않은 말로 찾을 때만 알려준다. 내 키워드를 눌렀는데
                "키워드 밖까지 찾는다"고 하면 무슨 말인지 알 수 없다. */}
            {!registered && (
              <span className="feed-search-hint"> · 내 키워드 밖의 글까지 찾습니다</span>
            )}
          </span>
          <span className="feed-search-acts">
            {!registered && (
              <button type="button" className="rs-save on" onClick={addCurrentKeyword}>
                내 키워드로 추가
              </button>
            )}
            <button type="button" className="rs-save" onClick={clearSearch}>검색 지우기</button>
          </span>
        </div>
      )}

      {err && <div className="rs-empty" style={{ color: "var(--danger)" }}>{err}</div>}

      {hero && (
        <article className={`feed-hero${hero.read ? " read" : ""}`}>
          <a
            className="feed-hero-visual"
            href={hero.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => openArticle(hero)}
            aria-label={hero.title}
          >
            <ArticleVisual item={hero} size="lg" />
          </a>
          <div className="feed-hero-body">
            {/* 검색 중이면 검색어가 곧 이 글을 고른 이유다 */}
            <div className="feed-kicker">{hero.matched_keywords?.[0] || query || hero.outlet}</div>
            <a
              className="feed-hero-title"
              href={hero.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => openArticle(hero)}
            >
              {hero.title}
            </a>
            {hero.summary && <p className="feed-hero-sum">{hero.summary}</p>}
            {/* 출처와 발행일은 어떤 경우에도 함께 보인다 — 대표 이미지가 원
                매체 것이라 더더욱 뺄 수 없다 */}
            <div className="feed-meta">
              {hero.outlet}
              {` / ${fmtDate(hero.published_at) || "발행일 미상"}`}
              {hero.read && " / 읽음"}
            </div>
            <div className="feed-hero-actions">
              <a
                className="btn btn-primary btn-sm"
                href={hero.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => openArticle(hero)}
              >
                원문 보기
              </a>
              <button
                type="button"
                className={`rs-save${hero.saved ? " on" : ""}`}
                onClick={() => toggleSave(hero)}
              >
                {hero.saved ? "저장됨" : "저장"}
              </button>
            </div>
          </div>
        </article>
      )}

      {cards.length > 0 && (
        <div className="feed-cards">
          {cards.map((item) => (
            <article key={item.id} className={`feed-card${item.read ? " read" : ""}`}>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => openArticle(item)}
                aria-label={item.title}
              >
                <ArticleVisual item={item} />
              </a>
              <div className="feed-kicker">{item.matched_keywords?.[0] || query || item.outlet}</div>
              <a
                className="feed-card-title"
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => openArticle(item)}
              >
                {item.title}
              </a>
              <div className="feed-card-foot">
                <span className="feed-meta">
                  {item.outlet}
                  {` / ${fmtDate(item.published_at) || "발행일 미상"}`}
                  {item.read && " / 읽음"}
                </span>
                <button
                  type="button"
                  className={`rs-save${item.saved ? " on" : ""}`}
                  onClick={() => toggleSave(item)}
                >
                  {item.saved ? "저장됨" : "저장"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <>
          <h2 className="feed-rest-hdr">더 읽을거리</h2>
          <div className="feed-rows">
            {rest.map((item) => (
              <article key={item.id} className={`feed-row${item.read ? " read" : ""}`}>
                <div className="feed-row-main">
                  <div className="feed-meta">
                    <span className={`badge badge-${item.kind === "paper" ? "blue" : "grey"}`}>
                      {item.kind === "paper" ? "논문" : "뉴스"}
                    </span>
                    {item.outlet}
                    {item.published_at && ` / ${fmtDate(item.published_at)}`}
                    {item.read && " / 읽음"}
                  </div>
                  <a
                    className="feed-row-title"
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => openArticle(item)}
                  >
                    {item.title}
                  </a>
                  {item.summary && <p className="feed-row-sum">{item.summary}</p>}
                </div>
                <button
                  type="button"
                  className={`rs-save${item.saved ? " on" : ""}`}
                  onClick={() => toggleSave(item)}
                >
                  {item.saved ? "저장됨" : "저장"}
                </button>
              </article>
            ))}
          </div>
        </>
      )}

      {!loading && items.length === 0 && !err && (
        <div className="rs-empty" style={{ whiteSpace: "pre-line" }}>
          {emptyMessage}
          {tab !== "saved" && (
            <div style={{ marginTop: 14 }}>
              <button type="button" className="btn-inline" onClick={() => onNav("S42")}>
                키워드 관리로 이동
              </button>
            </div>
          )}
        </div>
      )}

      {loading && <div className="rs-empty">불러오는 중…</div>}
      {!done && <div ref={sentinel} style={{ height: 1 }} />}
      {done && items.length > 0 && (
        <div className="rs-empty" style={{ fontSize: 13 }}>마지막 글까지 봤습니다.</div>
      )}
    </div>
  );
}
