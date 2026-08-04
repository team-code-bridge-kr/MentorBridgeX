/**
 * S44 — 활동 기록 (전체 보기)
 *
 * 사이드바는 "빠른 전환"이라 8개까지만 세운다. 그보다 옛날 것을 찾을 때 오는
 * 화면이다. **대화와 작업을 탭으로 가르지 않는다** — 사이드바와 같은 하나의
 * 목록이고, 같은 엔드포인트를 쓴다. 여기서 더 주는 것은 날짜 묶음뿐이다.
 *
 * 상단 바를 쓰지 않는다(NO_HDR). 대시보드처럼 화면이 제 제목을 갖는다 — 얇은
 * 바에 "활동 기록"만 있고 바로 아래 같은 글자가 또 나오면 두 줄을 낭비한다.
 *
 * 폭은 본문 규격(`--page-w`)을 그대로 쓴다. 목록 한 줄이 화면 끝까지 늘어나면
 * 제목과 시간이 멀어져서 어느 시간이 어느 활동의 것인지 눈으로 이어야 한다.
 */

import { useMemo, useState } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import { useRecentActivity } from "../../hooks/useRecentActivity.js";
import { RecentActivityItem } from "../../components/sidebar/RecentActivityItem.jsx";
import { ACTIVITY_FILTERS, DATE_GROUP_ORDER, dateGroup } from "../../lib/activityMeta.js";
import { NavIcon } from "../../components/NavIcon.jsx";
import { activityDetailRoute, restoreActivity } from "../../lib/activityRestore.js";
import { Empty } from "../../components/ui.jsx";

const PAGE = 100;

export function S44({ onNav }) {
  const { actions } = useStore();
  const [kind, setKind] = useState("all");
  const [query, setQuery] = useState("");
  const activity = useRecentActivity({ limit: PAGE, kind, q: query });

  /** 고정은 늘 맨 위 한 덩어리로. 나머지는 날짜로 묶는다. */
  const groups = useMemo(() => {
    const pinned = activity.items.filter((it) => it.pinned);
    const rest = activity.items.filter((it) => !it.pinned);
    const byDate = new Map();
    for (const it of rest) {
      const key = dateGroup(it.updated_at);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key).push(it);
    }
    const ordered = DATE_GROUP_ORDER.filter((k) => byDate.has(k)).map((k) => [k, byDate.get(k)]);
    return pinned.length ? [["고정", pinned], ...ordered] : ordered;
  }, [activity.items]);

  const fail = (e, fallback) => actions.toast("error", e.message || fallback);

  return (
    <div className="content act-wrap">
      {/* .content > * 는 자식마다 가운데 정렬을 걸어서, 폭이 다른 요소들이
          서로 어긋난다. 하나의 상자로 감싸 왼쪽 줄을 맞춘다. */}
      <div className="act-page">
        {/* 제목과 검색을 한 줄에 둔다. 설명문은 없앴다 — 이 화면이 무엇인지는
            제목과 목록이 이미 말한다. 한 번 읽고 나면 매번 자리만 차지한다. */}
        <header className="act-head">
          <h1 className="act-title">활동 기록</h1>
          <div className="act-search act-glass" role="search">
            <NavIcon name="search" size={16} color="var(--tt)" />
            <input
              className="act-search-input"
              value={query}
              placeholder="대화 및 활동 검색"
              aria-label="대화 및 활동 검색"
              maxLength={60}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button type="button" className="act-search-x" aria-label="검색어 지우기"
                onClick={() => setQuery("")}>×</button>
            )}
          </div>
        </header>

        <div className="act-filters" role="group" aria-label="활동 유형 필터">
          {ACTIVITY_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`act-filter act-glass${kind === f.id ? " is-on" : ""}`}
              aria-pressed={kind === f.id}
              onClick={() => setKind(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {activity.loading && (
          <div className="ra-list act-list act-glass" aria-busy="true">
            <span className="ra-skel" /><span className="ra-skel" /><span className="ra-skel" />
            <span className="ra-skel" /><span className="ra-skel" />
          </div>
        )}

        {!activity.loading && activity.error && (
          <Empty
            title="최근 활동을 불러오지 못했습니다."
            hint="잠시 뒤 다시 시도해 주세요."
            cta="다시 시도"
            onCta={activity.reload}
          />
        )}

        {!activity.loading && !activity.error && !activity.items.length && (
          <Empty
            title={query || kind !== "all" ? "검색 조건에 맞는 활동이 없습니다." : "아직 이어갈 활동이 없습니다."}
            hint="기사나 그래프를 MBX AI와 함께 탐구해보세요."
            cta="새로 시작하기"
            onCta={() => {
              window.dispatchEvent(new CustomEvent("mbx:new-chat"));
              onNav("S05");
            }}
          />
        )}

        {!activity.loading && !activity.error && groups.map(([label, items]) => (
          <section key={label} className="act-group">
            <h2 className="act-group-title">{label}</h2>
            <ul className="ra-list act-list act-glass">
            {items.map((it) => (
              <RecentActivityItem
                key={it.id}
                activity={it}
                onOpen={(item) => restoreActivity(item, onNav)}
                onRename={(item, title) =>
                  activity.update(item.id, { title }).catch((e) => fail(e, "이름을 바꾸지 못했습니다."))
                }
                onTogglePin={(item) =>
                  activity
                    .update(item.id, { pinned: !item.pinned })
                    .catch((e) => fail(e, "고정하지 못했습니다."))
                }
                onDelete={(item, deleteSource) =>
                  activity
                    .remove(item.id, { deleteSource })
                    .catch((e) => fail(e, "삭제하지 못했습니다."))
                }
                onDetail={(item) => {
                  const route = activityDetailRoute(item);
                  if (route) onNav(route);
                }}
              />
            ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
