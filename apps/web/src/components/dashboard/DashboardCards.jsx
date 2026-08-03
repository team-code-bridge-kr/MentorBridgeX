/**
 * 하단 핵심 기능 카드 3종 — 오늘의 관심 기사 / 최근 지식 그래프 / 확인할 피드백.
 *
 * 세 카드의 공통 규칙:
 * - 높이를 맞춘다 (내용이 많아도 카드가 들쭉날쭉하지 않게 목록을 자른다)
 * - 주요 액션은 1~2개만 노출하고, 그중 하나는 반드시 **챗봇 문맥으로 보내는** 액션
 * - 빈 상태는 크게 비우지 않고 다음 행동을 알려준다
 */

import { NavIcon } from "../NavIcon.jsx";

function CardShell({ title, badge, onViewAll, children, footer }) {
  return (
    <section className="dash-card">
      <header className="dash-card-hdr">
        <div className="dash-card-title">
          <span>{title}</span>
          {badge != null && badge > 0 && <span className="dash-badge">{badge}</span>}
        </div>
        {onViewAll && (
          <button type="button" className="dash-link" onClick={onViewAll}>
            전체 보기
          </button>
        )}
      </header>
      <div className="dash-card-body">{children}</div>
      {footer && <div className="dash-card-foot">{footer}</div>}
    </section>
  );
}

function EmptyState({ title, hint, cta, onCta, tone = "info" }) {
  return (
    <div className={`dash-empty dash-empty-${tone}`}>
      <p className="dash-empty-title">{title}</p>
      {hint && <p className="dash-empty-hint">{hint}</p>}
      {cta && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCta}>
          {cta}
        </button>
      )}
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

/* ── 1. 오늘의 관심 기사 ─────────────────────────────────── */

export function DailyArticleCard({ articles, loading, error, onReload, onNav, onAskAI, onAddToGraph }) {
  const items = (articles || []).slice(0, 3);

  return (
    <CardShell title="오늘의 관심 기사" onViewAll={() => onNav("S41")}>
      {loading && <ListSkeleton rows={3} />}
      {error && <ErrorState message={error} onRetry={onReload} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState
          title="아직 추천할 기사가 없습니다."
          hint="관심 분야를 등록하거나 그래프를 만들면 관련 기사를 매일 추천해드려요."
          cta="관심 분야 등록하기"
          onCta={() => onNav("S40")}
        />
      )}
      {!loading && !error && items.map((a) => (
        <article key={a.id} className="dash-item">
          <div className="dash-item-meta">
            <span className={`badge badge-${a.kind === "paper" ? "blue" : "grey"}`}>
              {a.kind === "paper" ? "논문" : "새 기사"}
            </span>
            <span className="dash-item-outlet">{a.outlet}</span>
            {a.published_at && <span>· {fmtDate(a.published_at)}</span>}
          </div>
          <a
            className="dash-item-title"
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            title={a.title}
          >
            {a.title}
          </a>
          {a.summary && <p className="dash-item-sum">{a.summary}</p>}
          <p className="dash-item-why">{a.reason}</p>
          <div className="dash-item-actions">
            <button
              type="button"
              className="rs-save"
              onClick={() => onAskAI(a)}
              aria-label={`${a.title} 기사에 대해 AI에게 질문`}
            >
              AI에게 질문
            </button>
            <button
              type="button"
              className="rs-save"
              onClick={() => onAddToGraph(a)}
              aria-label={`${a.title} 기사를 그래프에 추가`}
            >
              그래프에 추가
            </button>
          </div>
        </article>
      ))}
    </CardShell>
  );
}

/* ── 2. 최근 지식 그래프 ─────────────────────────────────── */

function GraphPreview({ nodes, edges }) {
  // 전체 그래프를 그리지 않는다 — 핵심 노드만 원형으로 배치하고
  // 최근 수정 노드를 강조한다. 라벨은 노드 아래 두어 겹치지 않게.
  if (!nodes?.length) return null;

  // 노드가 적으면 방사형이 일직선으로 보인다 — 4개 이하는 가로로 편다.
  const pos =
    nodes.length <= 4
      ? nodes.map((n, i) => ({
          ...n,
          x: nodes.length === 1 ? 50 : 16 + (68 / (nodes.length - 1)) * i,
          y: 42 + (i % 2 === 1 ? 16 : 0),
        }))
      : nodes.map((n, i) => {
          if (i === 0) return { ...n, x: 50, y: 46 };
          const ring = nodes.length - 1;
          const angle = ((i - 1) / ring) * Math.PI * 2 - Math.PI / 2;
          return { ...n, x: 50 + Math.cos(angle) * 32, y: 46 + Math.sin(angle) * 30 };
        });
  const byId = Object.fromEntries(pos.map((p) => [p.id, p]));

  return (
    <div className="graph-preview" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        {(edges || []).map((e, i) => {
          const a = byId[e.source];
          const b = byId[e.target];
          if (!a || !b) return null;
          return (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke="var(--brd)" strokeWidth="0.4" />
          );
        })}
      </svg>
      {pos.map((n) => (
        <div
          key={n.id}
          className={`graph-dot${n.recent ? " is-recent" : ""}`}
          style={{ left: `${n.x}%`, top: `${n.y}%` }}
          title={n.label}
        >
          <span className="graph-dot-label">{n.label}</span>
        </div>
      ))}
    </div>
  );
}

export function RecentGraphCard({ graph, loading, error, onReload, onNav, onAskAI }) {
  const has = (graph?.node_count ?? 0) > 0;

  return (
    <CardShell title="최근 지식 그래프" onViewAll={() => onNav("S06")}>
      {loading && <ListSkeleton rows={2} tall />}
      {error && <ErrorState message={error} onRetry={onReload} />}
      {!loading && !error && !has && (
        <EmptyState
          title="아직 생성된 지식 그래프가 없습니다."
          hint="관심 분야를 하나 선택하고 첫 번째 지식 그래프를 만들어보세요."
          cta="첫 그래프 만들기"
          onCta={() => onNav("S09")}
        />
      )}
      {!loading && !error && has && (
        <>
          <GraphPreview nodes={graph.preview_nodes} edges={graph.preview_edges} />
          <dl className="graph-stats">
            <div><dt>노드</dt><dd>{graph.node_count}</dd></div>
            <div><dt>연결</dt><dd>{graph.edge_count}</dd></div>
            <div><dt>최근 수정</dt><dd>{fmtDate(graph.last_updated) || "—"}</dd></div>
          </dl>
          {graph.recent_nodes?.length > 0 && (
            <p className="dash-item-why">
              최근 추가 · {graph.recent_nodes.slice(0, 3).join(", ")}
            </p>
          )}
          <div className="dash-item-actions">
            <button type="button" className="rs-save" onClick={() => onNav("S06")}>
              이어서 작업하기
            </button>
            <button
              type="button"
              className="rs-save on"
              onClick={onAskAI}
              aria-label="AI에게 그래프 확장 추천받기"
            >
              AI 확장 추천
            </button>
          </div>
        </>
      )}
    </CardShell>
  );
}

/* ── 3. 확인할 피드백 ────────────────────────────────────── */

export function PendingFeedbackCard({ items, count, loading, error, onReload, onNav, onAskAI }) {
  const list = (items || []).slice(0, 3);

  return (
    <CardShell title="확인할 피드백" badge={count} onViewAll={() => onNav("S24")}>
      {loading && <ListSkeleton rows={3} />}
      {error && <ErrorState message={error} onRetry={onReload} />}
      {!loading && !error && list.length === 0 && (
        <EmptyState
          tone="done"
          title="모든 피드백을 확인했어요."
          hint="새로운 코멘트가 등록되면 이곳에서 알려드릴게요."
        />
      )}
      {!loading && !error && list.map((c) => (
        <article key={c.id} className="dash-item">
          <div className="dash-item-meta">
            <span className="dash-avatar" aria-hidden="true">{c.author?.[0] ?? "?"}</span>
            <span className="dash-item-outlet">{c.author}</span>
            <span className="badge badge-blue">{c.role}</span>
            <span>· {fmtDate(c.created_at)}</span>
            {!c.resolved && <span className="badge badge-orange">미확인</span>}
          </div>
          {c.target && <p className="dash-item-why">{c.target}</p>}
          <p className="dash-item-sum">{c.excerpt}</p>
          <div className="dash-item-actions">
            <button type="button" className="rs-save" onClick={() => onNav("S24")}>
              확인하기
            </button>
            <button
              type="button"
              className="rs-save on"
              onClick={() => onAskAI(c)}
              aria-label={`${c.author}님 피드백 해결 방법을 MBX에게 묻기`}
            >
              MBX에게 묻기
            </button>
          </div>
        </article>
      ))}
    </CardShell>
  );
}

/* ── 상태 표시 ───────────────────────────────────────────── */

export function ListSkeleton({ rows = 3, tall }) {
  return (
    <div className="skel-list" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`skel-row${tall ? " skel-tall" : ""}`}>
          <div className="skel-line skel-w40" />
          <div className="skel-line skel-w90" />
          <div className="skel-line skel-w70" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="dash-empty" role="alert">
      <p className="dash-empty-title">불러오지 못했습니다.</p>
      <p className="dash-empty-hint">{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}

/* ── 주간 활동 요약 ──────────────────────────────────────── */

export function WeeklyActivitySummary({ weekly }) {
  if (!weekly?.has_activity) return null; // 데이터가 없으면 숨긴다
  const parts = [];
  if (weekly.nodes_added) parts.push(`노드 ${weekly.nodes_added}개 추가`);
  if (weekly.articles_read) parts.push(`기사 ${weekly.articles_read}개 탐색`);
  if (weekly.feedback_resolved) parts.push(`피드백 ${weekly.feedback_resolved}개 해결`);
  if (weekly.voice_sessions) parts.push(`음성 세션 ${weekly.voice_sessions}회`);

  return (
    <p className="weekly-line">
      <NavIcon name="stats" size={14} color="var(--tt)" />
      이번 주 {parts.join(" · ")}
    </p>
  );
}
