/**
 * 사이드바 "최근 활동".
 *
 * 예전에는 여기 "최근 작업"(AI 대화 목록)이 있었고, 대시보드에는 "최근 대화"가
 * 따로 있었다. 이름은 둘로 갈라져 있는데 내용은 같았다. 지금은 대화·기사·그래프·
 * 피드백·문서·양식·음성을 **하나의 활동 목록**으로 묶는다(`/v1/activity/recent`).
 *
 * 두 번째 사이드바를 만들지 않는다. 검색과 필터는 아이콘으로 접어 두고 누를 때만
 * 펼친다 — 사이드바 폭이 좁아 상시 노출하면 목록 자리를 뺏는다.
 */

import { useEffect, useRef, useState } from "react";
import { NavIcon } from "../NavIcon.jsx";
import { RecentActivityItem } from "./RecentActivityItem.jsx";
import { ACTIVITY_FILTERS } from "../../lib/activityMeta.js";

const SIDEBAR_LIMIT = 8;

export function RecentActivity({
  items,
  total,
  loading,
  error,
  activeId,
  kind,
  onKindChange,
  query,
  onQueryChange,
  onOpen,
  onRename,
  onTogglePin,
  onDelete,
  onDetail,
  onReload,
  onViewAll,
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const inputRef = useRef(null);
  const filterRef = useRef(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus({ preventScroll: true });
  }, [searchOpen]);

  useEffect(() => {
    if (!filterOpen) return undefined;
    const onDown = (e) => { if (!filterRef.current?.contains(e.target)) setFilterOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setFilterOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [filterOpen]);

  const closeSearch = () => {
    setSearchOpen(false);
    if (query) onQueryChange("");
  };

  const filterLabel = ACTIVITY_FILTERS.find((f) => f.id === kind)?.label || "전체";
  const pinned = items.filter((it) => it.pinned);
  const rest = items.filter((it) => !it.pinned);

  return (
    <div className="ra sb-fade">
      <div className="ra-hdr">
        <span className="ra-hdr-title">최근 활동</span>
        <span className="ra-hdr-tools">
          <button
            type="button"
            className={`ra-tool${searchOpen ? " is-on" : ""}`}
            aria-label="최근 활동 검색"
            aria-expanded={searchOpen}
            title="검색"
            onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
          >
            <NavIcon name="search" size={13} color="currentColor" />
          </button>
          <span className="ra-filter-wrap" ref={filterRef}>
            <button
              type="button"
              className={`ra-tool${kind !== "all" ? " is-on" : ""}`}
              aria-label={`최근 활동 필터 (현재 ${filterLabel})`}
              aria-haspopup="menu"
              aria-expanded={filterOpen}
              title={`필터: ${filterLabel}`}
              onClick={() => setFilterOpen((v) => !v)}
            >
              <NavIcon name="tag" size={13} color="currentColor" />
            </button>
            {filterOpen && (
              <div className="ra-menu ra-menu-filter" role="menu">
                {ACTIVITY_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={kind === f.id}
                    className={kind === f.id ? "is-on" : ""}
                    onClick={() => { onKindChange(f.id); setFilterOpen(false); }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </span>
        </span>
      </div>

      {searchOpen && (
        <div className="ra-search">
          <input
            ref={inputRef}
            className="ra-search-input"
            value={query}
            placeholder="대화 및 활동 검색"
            aria-label="대화 및 활동 검색"
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Escape") return;
              // 사이드바도 Esc 로 닫힌다. 검색 중에 Esc 를 누르면 검색만 접혀야지
              // 사이드바까지 닫히면 방금 찾던 목록이 통째로 사라진다.
              e.stopPropagation();
              closeSearch();
            }}
          />
        </div>
      )}

      {/* 필터가 걸려 있으면 지금 무엇만 보고 있는지 알려준다 */}
      {kind !== "all" && !loading && (
        <button type="button" className="ra-filter-chip" onClick={() => onKindChange("all")}>
          {filterLabel} 만 보는 중 · 해제
        </button>
      )}

      {loading && (
        <div className="ra-list" aria-busy="true">
          <span className="ra-skel" /><span className="ra-skel" /><span className="ra-skel" />
        </div>
      )}

      {!loading && error && (
        <div className="ra-state">
          <p className="ra-state-title">최근 활동을 불러오지 못했습니다.</p>
          <button type="button" className="ra-state-cta" onClick={onReload}>다시 시도</button>
        </div>
      )}

      {!loading && !error && !items.length && (
        <div className="ra-state">
          {query || kind !== "all" ? (
            <p className="ra-state-title">검색 조건에 맞는 활동이 없습니다.</p>
          ) : (
            <>
              <p className="ra-state-title">아직 이어갈 활동이 없습니다.</p>
              <p className="ra-state-hint">기사나 그래프를 MBX AI와 함께 탐구해보세요.</p>
            </>
          )}
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <ul className="ra-list">
          {pinned.map((it) => (
            <RecentActivityItem
              key={it.id}
              activity={it}
              active={it.id === activeId}
              onOpen={onOpen}
              onRename={onRename}
              onTogglePin={onTogglePin}
              onDelete={onDelete}
              onDetail={onDetail}
            />
          ))}
          {/* 고정과 일반 사이는 선 하나로만 나눈다 — 제목을 또 붙이면 목록이 둘로 보인다 */}
          {pinned.length > 0 && rest.length > 0 && <li className="ra-divider" aria-hidden="true" />}
          {rest.map((it) => (
            <RecentActivityItem
              key={it.id}
              activity={it}
              active={it.id === activeId}
              onOpen={onOpen}
              onRename={onRename}
              onTogglePin={onTogglePin}
              onDelete={onDelete}
              onDetail={onDetail}
            />
          ))}
        </ul>
      )}

      {/* 목록이 넘칠 때만 보이면, 활동이 적은 사용자는 활동 기록 화면(날짜 묶음·
          넓은 검색)으로 갈 길이 아예 없다. 하나라도 있으면 늘 둔다. */}
      {!loading && !error && items.length > 0 && (
        <button type="button" className="ra-all" onClick={onViewAll}>
          전체 보기{total > items.length ? ` ${total}개` : ""}
          <NavIcon name="arrowRight" size={12} color="currentColor" />
        </button>
      )}
    </div>
  );
}

export { SIDEBAR_LIMIT };
