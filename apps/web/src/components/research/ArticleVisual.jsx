/**
 * 글 카드의 시각 패널.
 *
 * 우리는 기사 이미지를 저장하지 않는다 — 저작권상 제목·요약·링크까지만 갖는다.
 * 남의 사이트 이미지를 그대로 끌어다 쓰는 것도 같은 이유로 하지 않는다.
 * 대신 글마다 고정된 색 조합과 키워드로 판을 만든다. 빈 회색 상자보다
 * 목록이 훨씬 잘 구분되고, "이미지를 못 불러왔다"처럼 보이지도 않는다.
 *
 * 판에는 **매체명**을 크게 넣는다. 키워드는 바로 아래 줄(kicker)에 이미 있어서
 * 판에도 키워드를 넣으면 같은 글자가 두 번 보이고, 키워드는 피드 특성상 대부분
 * 같은 값이라("인공지능") 카드가 전부 똑같아 보인다. 매체는 글마다 달라 구분된다.
 *
 * 색은 **매체 이름**으로 고른다. 같은 매체는 늘 같은 색이라 목록을 훑을 때
 * 출처가 눈에 익는다. 새로고침마다 색이 바뀌면 눈이 기억한 위치를 잃는다.
 */

const PALETTES = [
  { bg: "linear-gradient(135deg,#0b1020 0%,#1b2a63 55%,#3b6fd4 100%)", fg: "#cfe0ff" },
  { bg: "linear-gradient(135deg,#0a1a17 0%,#12463c 55%,#22a06b 100%)", fg: "#c9f3e2" },
  { bg: "linear-gradient(135deg,#1a0f24 0%,#3d1f63 55%,#7c5cf0 100%)", fg: "#e2d8ff" },
  { bg: "linear-gradient(135deg,#1d1206 0%,#5a3413 55%,#c8792a 100%)", fg: "#ffe3c2" },
  { bg: "linear-gradient(135deg,#0a1620 0%,#12405c 55%,#2aa3c8 100%)", fg: "#cdeefb" },
  { bg: "linear-gradient(135deg,#20101a 0%,#5c1b3d 55%,#d0407e 100%)", fg: "#ffd7e7" },
];

function pick(id = "") {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

export function ArticleVisual({ item, size = "md" }) {
  const word = item.outlet || item.matched_keywords?.[0] || "탐구";
  const p = pick(word || item.id);

  return (
    <div className={`feed-visual feed-visual-${size}`} style={{ background: p.bg }} aria-hidden="true">
      <span className="feed-visual-word" style={{ color: p.fg }}>{word}</span>
      <span className="feed-visual-kind">{item.kind === "paper" ? "논문" : "뉴스"}</span>
    </div>
  );
}
