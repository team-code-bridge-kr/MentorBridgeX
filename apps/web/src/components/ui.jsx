import TDS from "../theme/tokens.js";
import { NAV_ICON_PATHS, NavIcon } from "./NavIcon.jsx";

/**
 * 예전에는 이모지를 컬러 이모지 폰트로 그렸다. 이 디자인 시스템은 선 아이콘으로
 * 통일하므로, 화면 곳곳에 데이터로 박혀 있는 이모지를 여기서 한 번에 갈아끼운다.
 * 호출부(`<TFI>{item.icon}</TFI>`)는 그대로 두고 렌더링만 바꾼다.
 *
 * 매핑에 없으면 NavIcon 이름으로 한 번 더 보고, 그것도 아니면 원문을 그대로 둔다.
 * (이모지가 아닌 문자를 넣어 쓰던 자리를 깨뜨리지 않기 위함)
 */
const GLYPH_ICON = {
  "✅": "check", "✓": "check", "☑": "check",
  "❌": "close", "✕": "close", "🚫": "close",
  "⚠": "alert", "🚧": "alert",
  "📄": "text", "📑": "text", "📰": "text", "📖": "bookOpen", "📜": "text", "📚": "bookOpen",
  "🎙": "voice", "🎤": "voice",
  "🔍": "search", "🔎": "search",
  "🗑": "trash",
  "🔵": "dot", "🟢": "dot", "🔴": "dot", "🔶": "dot", "🟡": "dot", "⚪": "dot",
  "📝": "pen", "✏": "pen", "✍": "pen",
  "📎": "link", "🔗": "link",
  "📋": "form",
  "💬": "comment",
  "📤": "exportIco", "📥": "exportIco",
  "🧠": "cpu", "🤖": "cpu",
  "🔐": "lock", "🔒": "lock",
  "🔓": "key", "🔑": "key",
  "👤": "users", "👥": "users", "👩": "users", "🤝": "users",
  // ZWJ 로 이어붙인 조합 문자. glyphKey 가 ZWJ 를 떼면 이 형태가 된다.
  "👩🏫": "users", "👨🏫": "users", "👩💻": "code", "👨💻": "code",
  "🛡": "shield",
  "🗺": "compass", "🎯": "compass",
  "🔔": "bell", "📢": "bell",
  "📊": "stats", "📈": "metric",
  "💡": "idea",
  "🐛": "bug",
  "🏫": "master", "🎓": "master",
  "🎉": "sparkle", "✨": "sparkle",
  "➕": "plusSeed",
  "⚙": "settings",
  "🖼": "image", "📸": "image",
  "🔄": "refresh",
  "📦": "system",
  "📌": "tag", "🏷": "tag",
  "🌱": "leaf",
  "✂": "scissors",
  "⚡": "bolt",
  "⏳": "history", "⏱": "history", "🕐": "history",
};

/** 이모지에 붙는 변이 선택자(U+FE0F)와 공백을 떼고 본 글자만 남긴다. */
function glyphKey(children) {
  if (typeof children !== "string") return "";
  return children.replace(/[\uFE0F\u200D\s]/g, "");
}

export const TFI = ({ children, s = 20, color, style }) => {
  const size = typeof s === "number" ? s : parseInt(s) || 20;
  const key = glyphKey(children);
  const name = GLYPH_ICON[key] || (NAV_ICON_PATHS[children] ? children : null);

  const box = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    verticalAlign: "middle",
    lineHeight: 1,
    ...(color ? { color } : {}),
    ...style,
  };

  if (name) {
    return (
      <span style={{ ...box, width: size, height: size }}>
        <NavIcon name={name} size={size} color={color || "currentColor"} />
      </span>
    );
  }
  return <span style={{ ...box, fontSize: size }}>{children}</span>;
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
export const Av = ({ name = "?", size = "sm", src }) => (
  src
    ? <img className={`av av-${size}`} src={src} alt={name} style={{ objectFit: "cover" }} referrerPolicy="no-referrer" />
    : <div className={`av av-${size}`}>{name[0]}</div>
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

