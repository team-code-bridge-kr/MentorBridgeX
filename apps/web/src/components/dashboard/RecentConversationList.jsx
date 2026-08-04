/**
 * 최근 대화 — 최신 2개만 세우고 나머지는 "더 보기".
 *
 * 목록이 길면 그 아래 있어야 할 것들이 밀려 내려간다. 대화를 이어가려고 이
 * 화면에 오는 경우는 대개 **방금 하던 것**이므로 둘이면 충분하고, 그보다 옛날
 * 것을 찾을 때만 펼치면 된다.
 *
 * 이름은 서버가 첫 질문에서 잘라 만든다. 그래서 길고 서로 구분이 안 된다 —
 * 각 줄에서 바로 고칠 수 있게 연필 버튼을 둔다(RenameField).
 *
 * 없으면 영역 자체를 감춘다 — 빈 상태를 크게 만들면 AI 영역이 허전해 보인다.
 */

import { useState } from "react";
import { NavIcon } from "../NavIcon.jsx";
import { RenameField } from "./RenameField.jsx";

/** 접었을 때 보이는 줄 수 */
const VISIBLE = 2;

function ago(iso) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  if (ms < 3_600_000) return `${Math.max(1, Math.floor(ms / 60_000))}분 전`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}시간 전`;
  return `${Math.floor(ms / 86_400_000)}일 전`;
}

export function RecentConversationList({ items, loading, onResume, onRename }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(null);

  if (loading) {
    return (
      <div className="recent-convos" aria-busy="true">
        <div className="recent-convos-hdr">최근 대화</div>
        <span className="recent-convo-skel" />
        <span className="recent-convo-skel" />
      </div>
    );
  }
  if (!items?.length) return null;

  // 서버가 updated_at 내림차순으로 준다 — 최신이 위
  const shown = expanded ? items : items.slice(0, VISIBLE);
  const hidden = items.length - VISIBLE;

  return (
    <div className="recent-convos">
      <div className="recent-convos-hdr">최근 대화</div>
      <ul>
        {shown.map((c) => (
          <li key={c.id} className="recent-convo-row">
            {editing === c.id ? (
              <RenameField
                value={c.title}
                onSave={(title) => {
                  setEditing(null);
                  onRename?.(c.id, title);
                }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <>
                <button
                  type="button"
                  className="recent-convo"
                  onClick={() => onResume(c.id)}
                  title={c.title}
                >
                  <span className="recent-convo-title">{c.title}</span>
                  <span className="recent-convo-meta">
                    {c.subject && <span className="recent-convo-subject">{c.subject}</span>}
                    {c.subject && <span aria-hidden="true">·</span>}
                    <span>{ago(c.updated_at)}</span>
                  </span>
                </button>
                {onRename && (
                  <button
                    type="button"
                    className="recent-convo-rename"
                    aria-label={`‘${c.title}’ 이름 바꾸기`}
                    title="이름 바꾸기"
                    onClick={() => setEditing(c.id)}
                  >
                    <NavIcon name="pen" size={14} color="currentColor" />
                  </button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      {hidden > 0 && (
        <button
          type="button"
          className="recent-convo-more"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "접기" : `더 보기 ${hidden}개`}
          <span className={`recent-convo-more-ic${expanded ? " is-open" : ""}`} aria-hidden="true">
            <NavIcon name="arrowRight" size={13} color="currentColor" />
          </span>
        </button>
      )}
    </div>
  );
}
