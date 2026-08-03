/**
 * 챗봇에 첨부된 문맥 칩.
 *
 * 이 대시보드의 핵심 장치다. 기사·그래프·코멘트가 각각 별개 기능처럼 보이지
 * 않도록, 하단 카드의 액션이 전부 이 칩으로 수렴한다.
 */

const META = {
  article: { label: "기사", icon: "📄" },
  graph:   { label: "그래프", icon: "🕸" },
  node:    { label: "노드", icon: "◈" },
  comment: { label: "코멘트", icon: "💬" },
  file:    { label: "파일", icon: "📎" },
};

export function AIContextChip({ item, onRemove }) {
  const meta = META[item.type] || META.file;
  const label = item.label || meta.label;

  return (
    <span className={`ctx-chip ctx-${item.type}`} title={`${meta.label}: ${label}`}>
      <span aria-hidden="true" className="ctx-chip-ic">{meta.icon}</span>
      <span className="ctx-chip-kind">{meta.label}</span>
      <span className="ctx-chip-label">{label}</span>
      {onRemove && (
        <button
          type="button"
          className="ctx-chip-x"
          aria-label={`${label} 문맥 제거`}
          onClick={() => onRemove(item)}
        >
          ×
        </button>
      )}
    </span>
  );
}

export function AIContextChipList({ items, onRemove }) {
  if (!items?.length) return null;
  return (
    <div className="ctx-chips" role="list" aria-label="첨부된 문맥">
      {items.map((item) => (
        <span role="listitem" key={`${item.type}:${item.id ?? item.label}`}>
          <AIContextChip item={item} onRemove={onRemove} />
        </span>
      ))}
    </div>
  );
}
