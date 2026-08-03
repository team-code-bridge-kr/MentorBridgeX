/**
 * 글 카드의 시각 패널.
 *
 * 1순위는 매체가 붙여 둔 대표 이미지(og:image)다. 우리 서버에 내려받아 두지
 * 않고 **주소만 갖고 있다가 원 매체 서버에서 직접 불러온다** — 카카오톡·슬랙의
 * 링크 미리보기와 같은 방식이고, 제목·출처·원문 링크를 항상 함께 보여준다.
 *
 * 이미지가 없거나 못 불러오면 색 판으로 대체한다. 매체마다 og:image 가 없기도
 * 하고(논문은 거의 없다), 일부 서버는 외부 참조를 막는다. 빈 회색 상자를 두면
 * "고장난 화면"처럼 보이므로 대체 판을 항상 준비해 둔다.
 *
 * 대체 판에는 **매체명**을 크게 넣는다. 출처는 메타 줄에도 늘 함께 나오지만
 * (저작권상 뺄 수 없다), 판이 비어 있는 것보다 매체를 크게 보여주는 편이 낫다.
 * 다만 논문은 출처가 거의 전부 arXiv 라 판이 다 똑같아진다 — 논문일 때는
 * 키워드를 쓴다. "무엇으로 구분되는가"가 매체가 아니라 주제이기 때문이다.
 *
 * 색도 같은 글자로 고른다. 같은 매체는 늘 같은 색이라 목록을 훑을 때 출처가
 * 눈에 익는다. 새로고침마다 색이 바뀌면 눈이 기억한 위치를 잃는다.
 */

import { useState } from "react";

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
  const [broken, setBroken] = useState(false);
  const word =
    (item.kind === "paper"
      ? item.matched_keywords?.[0] || item.outlet
      : item.outlet || item.matched_keywords?.[0]) || "탐구";
  const p = pick(word || item.id);
  const src = !broken && item.image_url ? item.image_url : null;

  return (
    <div
      className={`feed-visual feed-visual-${size}${src ? " has-image" : ""}`}
      style={src ? undefined : { background: p.bg }}
      aria-hidden="true"
    >
      {src ? (
        <img
          className="feed-visual-img"
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          // 어디서 불러가는지 매체에 흘리지 않는다. 리퍼러로 외부 참조를 막는
          // 서버에서도 대체로 이쪽이 잘 뜬다.
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="feed-visual-word" style={{ color: p.fg }}>{word}</span>
      )}
      <span className="feed-visual-kind">{item.kind === "paper" ? "논문" : "뉴스"}</span>
    </div>
  );
}
