/**
 * S41 — 탐구 피드
 *
 * 상단이 세 가지를 **따로** 말한다. 예전에는 관심 키워드·기간 버튼·관리 버튼이
 * 전부 같은 알약으로 한 줄에 섞여 있어서, 무엇이 내 관심사이고 무엇이 지금 걸린
 * 조건인지 구분되지 않았다.
 *
 *   1. 한 줄 도구띠  — 제목·검색·기간·정렬·관리 (.feed-bar)
 *   2. 내 관심 키워드 — 내가 등록해 둔 칩들
 *   3. 현재 적용 중   — 지금 결과에 걸린 조건 (없으면 통째로 숨김)
 *
 * 검색·기간·정렬을 세 줄로 흩어 두면 기사가 화면 아래로 밀리고, 무엇이 조건인지도
 * 흩어져 보인다. 조건은 한 줄에 모으고 그 아래를 전부 기사에 준다.
 *
 * 블로그형 배치(히어로 1 + 카드 3 + 줄글)와 기사 데이터 연결은 그대로 둔다.
 * 히어로·카드는 첫 페이지의 앞 4개로 고정된다 — 스크롤로 더 불러올 때마다 맨
 * 위가 바뀌면 읽던 자리를 잃는다.
 *
 * 저작권상 제목 + 요약 2~3문장 + 원문 링크까지만 보여준다.
 *
 * **백엔드가 지원하지 않는 필터는 만들지 않았다.** 관련도순(글마다 점수를 매기는
 * 구조가 없다), 출처 국내/해외(구분 데이터가 없다), 그래프 기반 추천 이유
 * (기사↔노드 연관 API 가 없다). 있는 척하면 고른 대로 걸렸다고 착각하게 된다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../../api/index.js";
import { ArticleVisual } from "../../components/research/ArticleVisual.jsx";
import { DateRangeFilter } from "../../components/research/DateRangeFilter.jsx";
import { InterestKeywordSection } from "../../components/research/InterestKeywordSection.jsx";
import { SortFilter } from "../../components/research/SortFilter.jsx";
import { KeywordManagementDrawer } from "../../components/research/KeywordManagementDrawer.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";
import mbxLogo from "../../assets/brand/TeamCodeBridge_Logo_Black_Web.png";
import { useExplorationFeed } from "../../hooks/useExplorationFeed.js";
import { defaultFeedTab } from "../../lib/onboardingData.js";
import { useInterestKeywords } from "../../hooks/useInterestKeywords.js";
import { useStore } from "../../store/StoreProvider.jsx";
import { queueAsk } from "../../lib/handoff.js";

const FEATURED = 4; // 히어로 1 + 카드 3

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
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

/** 왜 이 글이 보이는지. 근거가 없으면 아무 말도 하지 않는다. */
function Reason({ item }) {
  const hits = item.matched_keywords || [];
  if (!hits.length) return null;
  return (
    <p className="reco-why" title={`내 관심 키워드와 겹치는 말: ${hits.join(", ")}`}>
      <span className="reco-why-label">추천 이유</span>
      내 키워드
      {/* 따옴표 대신 알약 — 어느 낱말이 걸렸는지가 문장 속에서 먼저 읽혀야 한다.
          문맥 카드의 키워드(.ctx-kw)와 같은 모양이라 뜻도 같게 읽힌다. */}
      {hits.slice(0, 3).map((k) => <span key={k} className="reco-kw">{k}</span>)}
      와 관련
    </p>
  );
}

function SaveButton({ item, onToggle }) {
  return (
    <button
      type="button"
      className={`save-btn${item.saved ? " is-saved" : ""}`}
      onClick={() => onToggle(item)}
      aria-pressed={!!item.saved}
      aria-label={item.saved ? `${item.title} 저장 해제` : `${item.title} 저장`}
    >
      <NavIcon name={item.saved ? "bookmarkOn" : "bookmark"} size={14}
        color={item.saved ? "var(--primary)" : "var(--ts)"} />
      {item.saved ? "저장됨" : "저장"}
    </button>
  );
}

export function S41({ onNav }) {
  const { state } = useStore();
  const interests = useInterestKeywords();
  const feed = useExplorationFeed({
    groups: interests.groups,
    defaultTab: defaultFeedTab(state.session?.user?.grade),
  });
  const { filters, patch } = feed;

  const [draft, setDraft] = useState(filters.query);
  const [drawer, setDrawer] = useState(false);
  const [checkedProfile, setCheckedProfile] = useState(false);
  const sentinel = useRef(null);

  // 온보딩 게이트 — 관심 분야를 아직 고르지 않았으면 온보딩으로 보낸다
  useEffect(() => {
    api.research
      .profile()
      .then((p) => { if (!p.onboarded) onNav("S03"); else setCheckedProfile(true); })
      .catch(() => setCheckedProfile(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 무한 스크롤
  useEffect(() => {
    const node = sentinel.current;
    if (!node || feed.done || feed.loading) return undefined;
    const io = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) feed.loadMore(); },
      { rootMargin: "300px" }
    );
    io.observe(node);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed.done, feed.loading, feed.cursor]);

  const openArticle = (item) => {
    feed.setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
    api.research.markRead(item.id).catch(() => {});
  };

  const toggleSave = async (item) => {
    const next = !item.saved;
    feed.setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, saved: next } : i)));
    try {
      await api.research.setSaved(item.id, next);
      if (filters.tab === "saved" && !next) {
        feed.setItems((prev) => prev.filter((i) => i.id !== item.id));
      }
    } catch {
      // 실패하면 되돌린다 — 저장된 줄 알고 넘어가면 안 된다
      feed.setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, saved: !next } : i)));
    }
  };

  /** 이 글을 문맥으로 달아 대시보드 AI 로 넘긴다 (S05 가 듣는 신호). */
  const askMbx = (item) => {
    // 이벤트만 쏘면 대시보드가 아직 안 그려져 있어서 아무도 못 듣는다.
    // queueAsk 가 값을 놔두고, 대시보드가 뜨면서 가져간다.
    queueAsk({
      prompt: "이 자료를 요약하고 내 탐구 주제와 어떻게 연결할지 알려줘.",
      context: { type: "article", id: item.id, label: item.title },
    });
    onNav("S05");
  };

  const toggleKeyword = useCallback((id) => {
    patch({
      keywords: filters.keywords.includes(id)
        ? filters.keywords.filter((k) => k !== id)
        : [...filters.keywords, id],
    });
  }, [filters.keywords, patch]);

  const submitSearch = (e) => {
    e.preventDefault();
    patch({ query: draft.trim() });
  };

  const searchedRegistered =
    !!filters.query &&
    interests.keywords.some((k) => k.keyword.toLowerCase() === filters.query.toLowerCase());

  // 위쪽 큰 자리(히어로 1 + 카드 3)는 **그림이 있는 글부터** 채운다. 큰 판에
  // 그림이 없으면 색 판만 남아 목록이 밋밋해진다. 모자라면 나머지로 채운다.
  // 첫 페이지가 들어온 시점에 한 번만 정한다 — 스크롤로 더 불러올 때마다 맨
  // 위가 바뀌면 읽던 자리를 잃는다.
  const firstId = feed.items[0]?.id || null;
  const featured = useMemo(() => {
    if (feed.items.length < FEATURED) return [];
    const picked = feed.items.filter((i) => i.image_url).slice(0, FEATURED);
    for (const it of feed.items) {
      if (picked.length >= FEATURED) break;
      if (!picked.includes(it)) picked.push(it);
    }
    return picked;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstId]);
  const featuredIds = new Set(featured.map((i) => i.id));
  const hero = featured[0] || null;
  const cards = featured.slice(1);
  const rest = feed.items.filter((i) => !featuredIds.has(i.id));

  if (!checkedProfile) {
    return <div className="rs-wrap"><div className="rs-empty">불러오는 중…</div></div>;
  }

  return (
    <div className="rs-wrap">
      <div className="rs-tabs" role="tablist" aria-label="콘텐츠 유형">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={filters.tab === t.id}
            className={`rs-tab${filters.tab === t.id ? " on" : ""}`}
            onClick={() => patch({ tab: t.id })}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 상단 한 줄 — 내 관심사(왼쪽)와 지금 걸 조건(오른쪽)이 한눈에 들어온다.
          예전에는 검색·키워드·기간·정렬이 세 줄로 흩어져 있어서, 기사가 화면
          아래로 밀리고 무엇이 조건인지도 흩어져 보였다. */}
      <div className="feed-bar">
        <form className="feed-search is-inline" onSubmit={submitSearch} role="search">
          <NavIcon name="search" size={17} color="var(--tt)" />
          <input
            className="feed-search-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="탐구할 주제나 키워드 검색"
            aria-label="탐구 주제 검색"
            maxLength={60}
          />
          {draft && (
            <button type="button" className="feed-search-x" aria-label="검색어 지우기"
              onClick={() => { setDraft(""); patch({ query: "" }); }}>×</button>
          )}
          <button type="submit" className="feed-search-go" aria-label="검색" disabled={feed.loading}>
            <NavIcon name="arrowRight" size={16} color="#fff" />
          </button>
        </form>
        <DateRangeFilter
          days={filters.days}
          from={filters.from}
          to={filters.to}
          onApply={(v) => patch(v)}
        />
        <SortFilter value={filters.sort} onChange={(sort) => patch({ sort })} />
        <button type="button" className="kw-manage" onClick={() => setDrawer(true)}>
          키워드 관리
        </button>
      </div>

      <div className="kw-line">
        <h2 className="kw-sec-title">내 관심 키워드</h2>
        <InterestKeywordSection
          groups={interests.groups}
          selected={filters.keywords}
          onToggle={toggleKeyword}
          onRegister={() => setDrawer(true)}
          loading={interests.loading}
        />
      </div>

      {feed.active.length > 0 && (
        <section className="applied">
          <h2 className="applied-title">현재 적용 중</h2>
          <div className="applied-row">
            {feed.active.map((chip) => (
              <button
                key={`${chip.type}:${chip.value}`}
                type="button"
                className="applied-chip"
                onClick={() => { if (chip.type === "query") setDraft(""); feed.removeFilter(chip); }}
                aria-label={`${chip.label} 조건 제거`}
              >
                {chip.label} <span aria-hidden="true">×</span>
              </button>
            ))}
            <button type="button" className="applied-reset"
              onClick={() => { feed.reset(); setDraft(""); }}>전체 초기화</button>
          </div>
        </section>
      )}

      {filters.query && (
        <div className="feed-search-state" role="status">
          <span><strong>“{filters.query}”</strong> 검색 결과</span>
          {!searchedRegistered && (
            <button type="button" className="rs-save on"
              onClick={() => interests.add(filters.query).catch(() => {})}>
              관심 키워드에 추가
            </button>
          )}
        </div>
      )}

      {feed.error && (
        <div className="feed-error" role="alert">
          <span>{feed.error}</span>
          <button type="button" className="rs-save" onClick={feed.retry}>다시 시도</button>
        </div>
      )}

      {feed.loading && <FeedSkeleton />}

      {!feed.loading && hero && (
        <article className={`feed-hero${hero.read ? " read" : ""}`}>
          <a className="feed-hero-visual" href={hero.url} target="_blank" rel="noopener noreferrer"
            onClick={() => openArticle(hero)} aria-label={hero.title}>
            <ArticleVisual item={hero} size="lg" />
          </a>
          <div className="feed-hero-body">
            <div className="feed-kicker">{hero.matched_keywords?.[0] || filters.query || hero.outlet}</div>
            <a className="feed-hero-title" href={hero.url} target="_blank" rel="noopener noreferrer"
              onClick={() => openArticle(hero)}>{hero.title}</a>
            {hero.summary && <p className="feed-hero-sum">{hero.summary}</p>}
            <div className="feed-meta">
              {hero.outlet}{` / ${fmtDate(hero.published_at) || "발행일 미상"}`}{hero.read && " / 읽음"}
            </div>
            <Reason item={hero} />
            <div className="feed-hero-actions">
              <a className="btn btn-primary btn-sm" href={hero.url} target="_blank" rel="noopener noreferrer"
                onClick={() => openArticle(hero)}>원문 보기</a>
              <button type="button" className="btn btn-secondary btn-sm ask-ai" onClick={() => askMbx(hero)}>
                <img className="ask-ai-logo" src={mbxLogo} alt="" aria-hidden="true" />
                Bridge AI에게 질문
              </button>
              <SaveButton item={hero} onToggle={toggleSave} />
            </div>
          </div>
        </article>
      )}

      {!feed.loading && cards.length > 0 && (
        <div className="feed-cards">
          {cards.map((item) => (
            <article key={item.id} className={`feed-card${item.read ? " read" : ""}`}>
              <a href={item.url} target="_blank" rel="noopener noreferrer"
                onClick={() => openArticle(item)} aria-label={item.title}>
                <ArticleVisual item={item} />
              </a>
              <div className="feed-kicker">{item.matched_keywords?.[0] || filters.query || item.outlet}</div>
              <a className="feed-card-title" href={item.url} target="_blank" rel="noopener noreferrer"
                onClick={() => openArticle(item)}>{item.title}</a>
              <Reason item={item} />
              <div className="feed-card-foot">
                <span className="feed-meta">
                  {item.outlet}{` / ${fmtDate(item.published_at) || "발행일 미상"}`}
                </span>
                <SaveButton item={item} onToggle={toggleSave} />
              </div>
            </article>
          ))}
        </div>
      )}

      {!feed.loading && rest.length > 0 && (
        <>
          <h2 className="feed-rest-hdr">더 읽을거리</h2>
          <div className="feed-rows">
            {rest.map((item) => (
              <article key={item.id} className={`feed-row${item.read ? " read" : ""}`}>
                {/* 그림이 있으면 줄에도 작게 붙인다. 훑어볼 때 글자만 늘어선 목록보다
                    무엇에 관한 글인지 훨씬 빨리 읽힌다. 없으면 자리도 만들지 않는다 —
                    빈 회색 상자가 줄마다 늘어서면 그게 더 시끄럽다. */}
                {item.image_url && (
                  <a className="feed-row-thumb" href={item.url} target="_blank" rel="noopener noreferrer"
                    onClick={() => openArticle(item)} aria-label={item.title}>
                    <ArticleVisual item={item} size="sm" />
                  </a>
                )}
                <div className="feed-row-main">
                  <div className="feed-meta">
                    <span className={`badge badge-${item.kind === "paper" ? "blue" : "grey"}`}>
                      {item.kind === "paper" ? "논문" : "뉴스"}
                    </span>
                    {item.outlet}{` / ${fmtDate(item.published_at) || "발행일 미상"}`}{item.read && " / 읽음"}
                  </div>
                  <a className="feed-row-title" href={item.url} target="_blank" rel="noopener noreferrer"
                    onClick={() => openArticle(item)}>{item.title}</a>
                  {item.summary && <p className="feed-row-sum">{item.summary}</p>}
                  <Reason item={item} />
                </div>
                <div className="feed-row-acts">
                  <button type="button" className="rs-save ask-ai" onClick={() => askMbx(item)}>
                    <img className="ask-ai-logo" src={mbxLogo} alt="" aria-hidden="true" />
                    Bridge AI에게 질문
                  </button>
                  <SaveButton item={item} onToggle={toggleSave} />
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {!feed.loading && feed.items.length === 0 && !feed.error && (
        <EmptyFeed
          tab={filters.tab}
          hasFilter={feed.active.length > 0}
          hasKeywords={interests.groups.length > 0}
          onReset={() => { feed.reset(); setDraft(""); }}
          onManage={() => setDrawer(true)}
        />
      )}

      {feed.paging && <div className="rs-empty">더 불러오는 중…</div>}
      {!feed.done && <div ref={sentinel} style={{ height: 1 }} />}
      {feed.done && feed.items.length > 0 && (
        <div className="rs-empty" style={{ fontSize: 13 }}>마지막 자료까지 봤습니다.</div>
      )}

      <KeywordManagementDrawer
        open={drawer}
        onClose={() => setDrawer(false)}
        groups={interests.groups}
        suggestions={interests.suggestions}
        onAdd={interests.add}
        onRemove={interests.remove}
        onSearch={(term) => { setDraft(term); patch({ query: term }); }}
      />
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="feed-hero">
        <div className="skel-block skel-hero" />
        <div>
          <div className="skel-line skel-w40" />
          <div className="skel-line skel-w90" style={{ height: 22, marginTop: 12 }} />
          <div className="skel-line skel-w70" style={{ height: 22, marginTop: 8 }} />
          <div className="skel-line skel-w90" style={{ marginTop: 16 }} />
          <div className="skel-line skel-w70" style={{ marginTop: 6 }} />
        </div>
      </div>
      <div className="feed-cards">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <div className="skel-block skel-card" />
            <div className="skel-line skel-w40" style={{ marginTop: 14 }} />
            <div className="skel-line skel-w90" style={{ marginTop: 8 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyFeed({ tab, hasFilter, hasKeywords, onReset, onManage }) {
  if (tab === "saved") {
    return (
      <div className="empty">
        <div className="empty-title">저장한 자료가 없습니다.</div>
        <div className="empty-sub">기사나 논문의 ‘저장’을 누르면 이곳에 모입니다.</div>
      </div>
    );
  }
  if (!hasKeywords) {
    return (
      <div className="empty">
        <div className="empty-title">아직 등록된 관심 키워드가 없습니다.</div>
        <div className="empty-sub">관심 분야를 등록하면 관련 뉴스와 논문을 추천해드려요.</div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onManage}>
          관심 키워드 등록하기
        </button>
      </div>
    );
  }
  if (hasFilter) {
    return (
      <div className="empty">
        <div className="empty-title">조건에 맞는 자료를 찾지 못했습니다.</div>
        <div className="empty-sub">검색어를 줄이거나, 기간을 넓히거나, 다른 키워드를 골라보세요.</div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onReset}>필터 초기화</button>
      </div>
    );
  }
  return (
    <div className="empty">
      <div className="empty-title">새로운 추천 자료를 준비하고 있습니다.</div>
      <div className="empty-sub">관심 키워드와 지식 그래프가 많아질수록 추천이 정교해집니다.</div>
      <button type="button" className="btn btn-secondary btn-sm" onClick={onManage}>키워드 관리</button>
    </div>
  );
}
