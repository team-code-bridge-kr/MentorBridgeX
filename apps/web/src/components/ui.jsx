import TDS from "../theme/tokens.js";

export const TFI = ({ children, s = 20, color, style }) => {
  const size = typeof s === 'number' ? s : parseInt(s) || 20;
  const colorStyle = color ? { color } : {};
  return (
    <span
      className="tfi"
      style={{
        fontSize: size,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        verticalAlign: "middle",
        ...colorStyle,
        ...style,
      }}
    >
      {children}
    </span>
  );
};
/* ──────────────────────────────────────────────────────────────
   PRIMITIVE COMPONENTS
────────────────────────────────────────────────────────────── */

export const Btn = ({ v = "primary", s = "md", fw, onClick, children, style, ...r }) => (
  <button className={`btn btn-${v} btn-${s}${fw?" btn-xl":""}`} onClick={onClick} style={style} {...r}>{children}</button>
);
export const Badge = ({ t = "grey", pill, children }) => (
  <span className={`badge badge-${t}${pill?" badge-pill":""}`}>{children}</span>
);
export const Av = ({ name = "?", size = "sm" }) => (
  <div className={`av av-${size}`}>{name[0]}</div>
);
export const Card = ({ children, style, className = "" }) => (
  <div className={`card card-p ${className}`} style={style}>{children}</div>
);
export const StatCard = ({ label, value, sub, color }) => (
  <div className="stat-card">
    <div className="stat-lbl">{label}</div>
    <div className="stat-val" style={{ color }}>{value}</div>
    <div className="stat-sub">{sub}</div>
  </div>
);
export const Notice = ({ type = "info", children }) => (
  <div className={`notice notice-${type}`}>{children}</div>
);
export const Divider = ({ my = 16 }) => (
  <div style={{ height: 1, background: TDS.borderDefault, margin: `${my}px 0` }} />
);

/* ──────────────────────────────────────────────────────────────
   NAV STROKE ICONS  (푸른끼 있는 gray stroke)
────────────────────────────────────────────────────────────── */

export function DonutChart({ data, size=148, label, pct }) {
  // Figma arcData 방식과 동일: SVG stroke-dasharray로 arc 구현
  const r = (size - 16) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;

  let startAngle = -Math.PI / 2; // 12시 방향 시작
  const arcs = data.map(d => {
    const sweep = 2 * Math.PI * d.pct;
    const endAngle = startAngle + sweep;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle - 0.02);
    const y2 = cy + r * Math.sin(endAngle - 0.02);
    const large = sweep > Math.PI ? 1 : 0;
    const path = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
    startAngle = endAngle;
    return { path, color: d.color };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{display:"block"}}>
      {/* 트랙 */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={TDS.bgTertiary} strokeWidth={16} />
      {/* 각 세그먼트 */}
      {arcs.map((a, i) => (
        <path key={i} d={a.path} fill="none" stroke={a.color} strokeWidth={16} strokeLinecap="round" />
      ))}
      {/* 구멍 (흰 원) */}
      <circle cx={cx} cy={cy} r={r - 12} fill={TDS.bgPrimary} />
      {/* 중앙 텍스트 */}
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize="12" fill={TDS.textTertiary} fontFamily="Pretendard, sans-serif">{label}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="20" fontWeight="700" fill={TDS.textPrimary} fontFamily="Pretendard, sans-serif">{pct}</text>
    </svg>
  );
}

/* S05 학생 대시보드 */

