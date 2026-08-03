/**
 * 최근 대화 — 최대 3개.
 *
 * 예전에는 제목이 왼쪽 끝, 시간이 오른쪽 끝에 붙어 있어서 넓은 화면일수록 둘이
 * 멀어졌다. 어느 시간이 어느 대화의 것인지 눈으로 이어 붙여야 했다. 지금은
 * 제목 바로 아래에 문맥과 시간을 붙여 한 덩어리로 읽히게 한다.
 *
 * 없으면 영역 자체를 감춘다 — 빈 상태를 크게 만들면 AI 영역이 허전해 보인다.
 */

function ago(iso) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  if (ms < 3_600_000) return `${Math.max(1, Math.floor(ms / 60_000))}분 전`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}시간 전`;
  return `${Math.floor(ms / 86_400_000)}일 전`;
}

export function RecentConversationList({ items, loading, onResume }) {
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
                {c.subject && <span aria-hidden="true">·</span>}
                <span>{ago(c.updated_at)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
