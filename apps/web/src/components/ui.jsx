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
/**
 * 뒤로 가기. **모든 화면이 이걸 쓴다.**
 *
 * 예전에는 화면마다 제각각이었다 — "← 목록", "← 그래프", "← 이전으로" 가
 * 텍스트 버튼이거나 고스트 버튼이었고, 위치도 크기도 달랐다. 뒤로 가기는
 * 화면을 옮겨 다니며 **같은 자리에 같은 모양으로** 있어야 눈이 찾지 않는다.
 *
 * 모양은 갈매기(`<`) 하나. 배경에는 히어로와 같은 파랑→인디고를 아주 옅게
 * 깐다(오로라 계열). 어디로 가는지는 옆의 짧은 말이 알려준다 — 없으면
 * 아이콘만으로 선다.
 */
export const Back = ({ onClick, label, title }) => (
  <button
    type="button"
    className={`back-btn${label ? "" : " is-bare"}`}
    onClick={onClick}
    title={title || (label ? `${label}(으)로 돌아가기` : "뒤로 가기")}
    aria-label={title || (label ? `${label}(으)로 돌아가기` : "뒤로 가기")}
  >
    <span className="back-btn-ic"><NavIcon name="chevronLeft" size={16} color={TDS.primary} /></span>
    {label && <span className="back-btn-t">{label}</span>}
  </button>
);
export const Badge = ({ t = "grey", pill, children }) => (
  <span className={`badge badge-${t}${pill?" badge-pill":""}`}>{children}</span>
);
export const Av = ({ name = "?", size = "sm", src }) => (
  src
    ? <img className={`av av-${size}`} src={src} alt={name} style={{ objectFit: "cover" }} referrerPolicy="no-referrer" />
    : <div className={`av av-${size}`}>{name[0]}</div>
);
/* onClick 을 받으면 카드 전체가 눌리는 자리가 된다. 예전에는 이 속성을 조용히
   버려서, 카드에 onClick 을 준 화면이 **아무 반응도 하지 않았다**(양식 화면의
   템플릿 카드가 그랬다). 다만 role="button" 은 붙이지 않는다 — 카드 안에 진짜
   단추가 들어 있는 경우가 많고, 단추 안의 단추는 키보드로 쓸 수 없다.
   손으로 누르는 편의는 여기서, 접근성은 카드 안의 단추가 맡는다. */
export const Card = ({ children, style, className = "", onClick }) => (
  <div className={`card card-p ${className}`} style={style} onClick={onClick}>{children}</div>
);
/* 숫자 색은 기본이 본문색이다. 카드마다 다른 색을 칠하면 색이 아무 뜻도
   갖지 못한다 — 조치가 필요할 때(tone="danger"/"warning")만 색을 쓴다. */
export const StatCard = ({ label, value, sub, tone }) => (
  <div className="stat-card">
    <div className="stat-lbl">{label}</div>
    <div className={`stat-val${tone ? ` stat-${tone}` : ""}`}>{value}</div>
    <div className="stat-sub">{sub}</div>
  </div>
);
/* 빈 상태 — 무엇이 없는지 한 줄, 왜 그런지 한 줄, 다음 행동 하나.
   화면마다 회색 문장 한 줄만 덩그러니 두면 "고장난 건가?"로 읽힌다.
   (docs/design-guide.md 10절) */
export const Empty = ({ icon, title, hint, cta, onCta }) => (
  <div className="empty">
    {icon && <div className="empty-icon" aria-hidden="true">{icon}</div>}
    <div className="empty-title">{title}</div>
    {hint && <div className="empty-sub">{hint}</div>}
    {cta && <Btn v="secondary" s="sm" onClick={onCta}>{cta}</Btn>}
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

