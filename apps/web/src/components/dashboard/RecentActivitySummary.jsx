/**
 * 대시보드의 최근 활동 — **요약 진입점**.
 *
 * 사이드바에 이미 전체 목록이 있다. 여기 같은 목록을 한 벌 더 두면 두 곳을
 * 따로 관리하게 되고, 한쪽에서 이름을 바꾸면 다른 쪽이 어긋난다. 그래서 여기는
 * **가장 최근 둘만** 세우고 나머지는 사이드바와 전체 보기로 넘긴다.
 * 데이터는 같은 엔드포인트(`/v1/activity/recent`)에서 온다.
 */

import { NavIcon } from "../NavIcon.jsx";
import { activityTooltip, badgeTypes, timeAgo, typeMeta } from "../../lib/activityMeta.js";

const VISIBLE = 2;

export function RecentActivitySummary({ items, loading, error, onOpen, onViewAll, onReload }) {
  if (loading) {
    return (
      <div className="recent-convos" aria-busy="true">
        <div className="recent-convos-hdr"><span>최근 활동</span></div>
        <span className="recent-convo-skel" />
        <span className="recent-convo-skel" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="recent-convos">
        <div className="recent-convos-hdr"><span>최근 활동</span></div>
        <p className="ra-state-title">최근 활동을 불러오지 못했습니다.</p>
        <button type="button" className="ra-state-cta" onClick={onReload}>다시 시도</button>
      </div>
    );
  }

  // 빈 상태는 감춘다 — AI 영역 아래에 빈 상자를 두면 화면이 허전해 보인다
  if (!items?.length) return null;

  const shown = items.slice(0, VISIBLE);

  return (
    <div className="recent-convos">
      <div className="recent-convos-hdr">
        <span>최근 활동</span>
        <button type="button" className="recent-convo-more" onClick={onViewAll}>
          전체 보기
          <span className="recent-convo-more-ic" aria-hidden="true">
            <NavIcon name="arrowRight" size={13} color="currentColor" />
          </span>
        </button>
      </div>
      <ul>
        {shown.map((it) => (
          <li key={it.id} className="recent-convo-row">
            <button
              type="button"
              className="recent-convo"
              onClick={() => onOpen(it)}
              title={activityTooltip(it)}
            >
              <span className="recent-convo-title">{it.title}</span>
              <span className="recent-convo-meta">
                {badgeTypes(it).map((t) => (
                  <span key={t} className="ra-badge">{typeMeta(t).label}</span>
                ))}
                {it.context_summary && (
                  <span className="recent-convo-subject">{it.context_summary}</span>
                )}
                <span aria-hidden="true">·</span>
                <span>{timeAgo(it.updated_at)} 전</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
