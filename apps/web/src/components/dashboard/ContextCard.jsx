/**
 * 상단 문맥 카드의 공통 껍데기.
 *
 * 세 카드(기사·그래프·피드백)는 **서로 경쟁하지 않아야 한다.** 하나가 더 크거나
 * 더 진한 색이면 학생은 그 하나만 본다. 그래서 높이·여백·제목 크기·버튼 크기를
 * 전부 여기서 정하고, 각 카드는 안에 무엇을 넣을지만 정한다.
 *
 * **높이는 고정이다.** 기사 제목이 길든 짧든, 피드백이 있든 없든 카드가 늘거나
 * 줄면 아래의 AI 영역이 위아래로 흔들린다. 넘치는 내용은 잘라 낸다.
 */

export function ContextCard({
  title, count, meta, onViewAll, viewAllLabel = "전체 보기", children, actions,
  // 회전 카드가 "마우스를 올리면 멈춤" 같은 핸들러를 직접 붙일 수 있게 열어 둔다.
  // 바깥에 <div> 를 한 겹 두르면 그 div 가 격자/가로 스크롤의 칸이 되어 버려서
  // 카드 폭이 제목 길이에 끌려간다.
  hostProps,
}) {
  return (
    <section className="ctx-card" {...hostProps}>
      <header className="ctx-card-hdr">
        <h2 className="ctx-card-title">
          {title}
          {count > 0 && <span className="ctx-card-count">{count}개</span>}
        </h2>
        {/* 오른쪽 끝은 "지금 몇 번째인가"(회전) 또는 "전체 보기" 중 하나만 쓴다 */}
        {meta ? (
          <span className="ctx-card-meta">{meta}</span>
        ) : (
          onViewAll && (
            <button type="button" className="ctx-card-link" onClick={onViewAll}>
              {viewAllLabel}
            </button>
          )
        )}
      </header>

      <div className="ctx-card-body">{children}</div>

      {actions && <div className="ctx-card-foot">{actions}</div>}
    </section>
  );
}

/** 빈 상태 — 카드 높이는 그대로 두고 안쪽 문구만 바꾼다. */
export function ContextEmpty({ title, hint, cta, onCta, done }) {
  return (
    <div className={`ctx-empty${done ? " is-done" : ""}`}>
      <p className="ctx-empty-title">
        {/* 완료는 초록 배경이 아니라 작은 체크 하나로 알린다 */}
        {done && <span className="ctx-empty-check" aria-hidden="true">✓</span>}
        {title}
      </p>
      {hint && <p className="ctx-empty-hint">{hint}</p>}
      {cta && (
        <button type="button" className="ctx-btn" onClick={onCta}>
          {cta}
        </button>
      )}
    </div>
  );
}

/**
 * 로딩 뼈대 — **실제 카드와 같은 높이**로 만든다.
 * 높이가 다르면 데이터가 도착하는 순간 아래 내용이 통째로 밀린다.
 */
export function ContextSkeleton({ title }) {
  return (
    <section className="ctx-card" aria-busy="true">
      <header className="ctx-card-hdr">
        <h2 className="ctx-card-title">{title}</h2>
      </header>
      <div className="ctx-card-body">
        <span className="ctx-skel ctx-skel-sm" />
        <span className="ctx-skel ctx-skel-lg" />
        <span className="ctx-skel ctx-skel-md" />
      </div>
    </section>
  );
}

/** 한 카드가 실패해도 나머지 화면은 그대로 둔다. */
export function ContextError({ title, message, onRetry }) {
  return (
    <section className="ctx-card">
      <header className="ctx-card-hdr">
        <h2 className="ctx-card-title">{title}</h2>
      </header>
      <div className="ctx-card-body">
        <div className="ctx-empty" role="alert">
          <p className="ctx-empty-title">불러오지 못했습니다.</p>
          <p className="ctx-empty-hint">{message}</p>
          {onRetry && (
            <button type="button" className="ctx-btn" onClick={onRetry}>
              다시 시도
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/** 카드 안의 작은 버튼. 세 카드가 같은 크기를 쓰도록 여기 하나만 둔다. */
export function ContextButton({ children, onClick, primary, label }) {
  return (
    <button
      type="button"
      className={`ctx-btn${primary ? " is-primary" : ""}`}
      onClick={onClick}
      aria-label={label}
    >
      {children}
    </button>
  );
}

export function timeAgo(iso) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  if (ms < 3_600_000) return `${Math.max(1, Math.floor(ms / 60_000))}분 전`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}시간 전`;
  const days = Math.floor(ms / 86_400_000);
  return days < 7 ? `${days}일 전` : new Date(iso).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}
