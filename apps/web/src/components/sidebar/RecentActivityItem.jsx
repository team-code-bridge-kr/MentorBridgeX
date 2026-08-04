/**
 * 최근 활동 한 줄.
 *
 *   [아이콘] 제목                                시간
 *            대표 문맥 또는 결과 요약
 *
 * 제목 한 줄, 보조 한 줄. 사이드바가 좁으므로 긴 기사 제목이나 마지막 메시지를
 * 그대로 늘어놓지 않는다 — 잘라서 보여주고 전체는 툴팁에서 본다.
 *
 * 유형은 아이콘과 **연한 배지**로만 구분한다. 유형마다 다른 색을 칠하면 목록이
 * 알록달록해져 주요 메뉴보다 강해지고, 색을 못 보는 사람에게는 정보가 되지 않는다.
 */

import { useEffect, useRef, useState } from "react";
import { NavIcon } from "../NavIcon.jsx";
import { RenameField } from "../dashboard/RenameField.jsx";
import { activityTooltip, badgeTypes, timeAgo, typeMeta } from "../../lib/activityMeta.js";

export function RecentActivityItem({
  activity,
  active,
  onOpen,
  onRename,
  onTogglePin,
  onDelete,
  onDetail,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const menuRef = useRef(null);
  // 대화가 딸린 활동만 "대화도 삭제"를 물을 수 있다. 그래프·기사·문서 원본은
  // 여기서 지우지 않는다 — 최근 활동에서 지웠다고 자료가 사라지면 안 된다.
  const canDeleteConversation = Boolean(activity.conversation_id);

  // 메뉴가 열려 있는 동안만 바깥 클릭·Esc 를 듣는다
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (renaming) {
    return (
      <li className="ra-row is-editing">
        <RenameField
          value={activity.title}
          label="활동 이름"
          onSave={(title) => { setRenaming(false); onRename(activity, title); }}
          onCancel={() => setRenaming(false)}
        />
      </li>
    );
  }

  if (confirming) {
    return (
      <li className="ra-row is-confirm">
        <p className="ra-confirm-text">목록에서 지울까요?</p>
        <div className="ra-confirm-btns">
          <button type="button" onClick={() => { setConfirming(false); onDelete(activity, false); }}>
            목록에서만
          </button>
          {canDeleteConversation && (
            <button
              type="button"
              className="ra-menu-danger"
              onClick={() => { setConfirming(false); onDelete(activity, true); }}
            >
              대화도 삭제
            </button>
          )}
          <button type="button" onClick={() => setConfirming(false)}>취소</button>
        </div>
      </li>
    );
  }

  const badges = badgeTypes(activity);
  const icon = typeMeta(activity.primary_type).icon;

  return (
    <li className={`ra-row${active ? " is-active" : ""}`}>
      <button
        type="button"
        className="ra-item"
        onClick={() => onOpen(activity)}
        title={activityTooltip(activity)}
        aria-current={active ? "true" : undefined}
      >
        <span className="ra-icon" aria-hidden="true">
          <NavIcon name={icon} size={15} color="currentColor" />
        </span>
        <span className="ra-body">
          <span className="ra-line">
            <span className="ra-title">{activity.title}</span>
            <span className="ra-time">{timeAgo(activity.updated_at)}</span>
          </span>
          <span className="ra-sub">
            {badges.map((t) => (
              <span key={t} className="ra-badge">{typeMeta(t).label}</span>
            ))}
            {activity.context_summary && (
              <span className="ra-sub-text">{activity.context_summary}</span>
            )}
          </span>
        </span>
        {activity.pinned && (
          <span className="ra-pin" aria-label="고정됨" title="고정됨">
            <NavIcon name="flag" size={12} color="currentColor" />
          </span>
        )}
      </button>

      <div className="ra-more-wrap" ref={menuRef}>
        <button
          type="button"
          className="ra-more"
          aria-label={`‘${activity.title}’ 더보기`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          ⋯
        </button>
        {menuOpen && (
          <div className="ra-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onTogglePin(activity); }}>
              {activity.pinned ? "고정 해제" : "상단에 고정"}
            </button>
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setRenaming(true); }}>
              제목 변경
            </button>
            {onDetail && (
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onDetail(activity); }}>
                활동 상세 보기
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              className="ra-menu-danger"
              onClick={() => { setMenuOpen(false); setConfirming(true); }}
            >
              삭제
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
