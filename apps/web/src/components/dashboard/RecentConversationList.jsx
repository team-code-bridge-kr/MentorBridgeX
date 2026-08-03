/**
 * 최근 대화 — 최대 3개.
 *
 * 없으면 영역 자체를 숨긴다. 빈 상태를 크게 만들면 AI 영역이 허전해 보인다.
 */

function ago(iso) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  if (ms < 3_600_000) return `${Math.max(1, Math.floor(ms / 60_000))}분 전`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}시간 전`;
  return `${Math.floor(ms / 86_400_000)}일 전`;
}

export function RecentConversationList({ items, onResume }) {
  if (!items?.length) return null;

  return (
    <div className="recent-convos">
      <div className="recent-convos-hdr">최근 대화</div>
      <ul>
        {items.slice(0, 3).map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className="recent-convo"
              onClick={() => onResume(c.id)}
              title={c.title}
            >
              <span className="recent-convo-title">{c.title}</span>
              <span className="recent-convo-meta">
                {c.subject && <span className="recent-convo-subject">{c.subject}</span>}
                <span>{ago(c.updated_at)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
