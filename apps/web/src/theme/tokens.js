/**
 * Arena — Technical Precision Light
 *
 * 화면 곳곳의 인라인 스타일이 이 값을 본다. theme/styles.css 의 :root 와
 * 같은 값을 유지해야 한다. 한쪽만 고치면 색이 어긋난다.
 *
 * Material Design 3 명명 규칙을 따른다. `on` 접두사는 "그 위에 올라가는
 * 글자색"이라는 뜻이다(onSurface = surface 위의 글자). 이 규칙만 지키면
 * 대비는 자동으로 맞는다.
 *
 * 기존 이름(blue500, textPrimary, borderDefault …)은 호출부가 많아 그대로
 * 두고 값만 갈았다. 새 코드는 아래 의미 이름(primary, onSurface …)을 쓴다.
 */
export const TDS = {
  /* ── 강조 ──
     평상시 primaryContainer(밝은 쪽), hover 에서 primary(어두운 쪽).
     이 시스템은 누르려 하면 어두워진다. 방향을 뒤집지 말 것. */
  primary:            "#0051ae",
  primaryContainer:   "#0969da",
  onPrimary:          "#ffffff",
  onPrimaryContainer: "#ecefff",
  secondaryContainer:   "#58a6ff",
  onSecondaryContainer: "#003a6b",
  tertiary:          "#913900",
  tertiaryContainer: "#b84b00",

  /* ── 표면 계단 (밝은 → 어두운) ──
     직접 조합하면 대비가 어그러진다. 이 6단계 안에서만 고른다. */
  surfaceContainerLowest:  "#ffffff", // 카드·패널 본체
  surfaceContainerLow:     "#f1f4fa", // 행 호버
  surfaceContainer:        "#ebeef5", // 칩 배경, 검색창
  surfaceContainerHigh:    "#e5e8ef",
  surfaceContainerHighest: "#e0e2e9",
  surface:      "#f7f9ff",
  surfaceDim:   "#d7dae1",
  surfaceZebra: "#f6f8fa",

  /* ── 글자 3단계 + 테두리 ──
     밝은 배경 위 글자는 이 3단계로 충분하다. 임의 회색을 만들지 말 것. */
  onSurface:        "#181c21",
  onSurfaceVariant: "#424753",
  outline:          "#727785",
  outlineVariant:   "#c2c6d6", // 모든 구분선 기본값

  /* ── 순서 척도 ──
     난이도·진행도·등급 어디에나 재사용. tier1 은 완료/성공 색으로 겸용. */
  tier1: "#16a34a", tier2: "#0ea5e9", tier3: "#0969da",
  tier4: "#7c3aed", tier5: "#db2777",

  /* ── 어두운 영역 ──
     그래프 캔버스처럼 배경이 어두운 곳에서는 위 토큰을 쓰지 않는다.
     onSurfaceVariant 를 어두운 배경에 올리면 안 보인다. 여기서는 회색
     스케일과 white/N 을 쓴다. GitHub 다크를 그대로 가져왔다. */
  darkBg:     "#0d1117",
  darkBgAlt:  "#161b22",
  darkBorder: "rgba(255,255,255,.10)",

  /* ── 기존 이름 별칭 (값만 교체) ── */
  blue50:  "#e7effb", blue100: "#c9dcf5", blue200: "#9ec4ff",
  blue300: "#75abff", blue400: "#58a6ff", blue500: "#0969da",
  blue600: "#0051ae", blue700: "#003a6b",

  textPrimary:   "#181c21",
  textSecondary: "#424753",
  textTertiary:  "#727785",
  textDisabled:  "#c2c6d6",
  textLink:      "#0051ae",
  textDanger:    "#ba1a1a",
  textCaution:   "#913900",

  bgPrimary:   "#ffffff",
  bgSecondary: "#f7f9ff",
  bgTertiary:  "#ebeef5",
  bgOverlay:   "rgba(24,28,33,.52)",
  bgDisabled:  "#e0e2e9",

  borderDefault: "#c2c6d6",
  borderStrong:  "#727785",
  borderFocus:   "#0051ae",

  success:  "#16a34a", successBg: "#e7f6ec",
  warning:  "#b84b00", warningBg: "#ffece5",
  danger:   "#ba1a1a", dangerBg:  "#ffdad6",
  info:     "#0969da",

  chartLine:    "#0969da",
  chartArea:    "rgba(9,105,218,0.12)",
  chartAndroid: "#16a34a",
  chartiOS:     "#0969da",
  chartMale:    "#0969da",
  chartFemale:  "#913900",

  dark:      "#181c21",
  darkCard:  "#1c2128",
  darkBrd:   "#30363d",
};

export default TDS;
