/**
 * 오늘의 관심 기사 — 카드 하나 안에서 기사 한 건씩 돌아간다.
 *
 * 예전에는 기사 3건을 세로로 쌓아 카드가 제일 길었다. 기사가 그래프·피드백보다
 * 중요해서가 아니라 개수가 많아서 커진 것인데, 화면에서는 "여기가 제일 중요하다"로
 * 읽힌다. 지금은 셋 다 같은 높이이고, 기사는 안에서 순환한다.
 *
 * **카드 높이는 바뀌지 않는다.** 제목은 2줄에서 자르고, 바뀌는 것은 안쪽 내용뿐이다.
 * 8초마다 넘어가지만 마우스를 올리거나 안에 포커스가 있으면 멈춘다(useCarousel).
 */

import { useEffect } from "react";
import { useCarousel } from "../../hooks/useCarousel.js";
import { CarouselControls } from "./CarouselControls.jsx";
import { ContextButton, ContextCard, ContextEmpty, timeAgo } from "./ContextCard.jsx";

const ROTATE_MS = 8000;

export function RotatingArticleCard({ articles, onOpen, onAsk, onNav, onCurrentChange }) {
  const items = articles || [];
  const car = useCarousel(items.length, { auto: true, intervalMs: ROTATE_MS });
  const item = items[car.index];

  // 지금 보고 있는 기사를 바깥(추천 질문)에도 알린다 — "이 기사를 그래프에
  // 연결해줘" 같은 문장이 화면에 보이는 기사와 어긋나면 안 된다.
  useEffect(() => {
    onCurrentChange?.(item || null);
  }, [item, onCurrentChange]);

  if (!items.length) {
    return (
      <ContextCard title="오늘의 관심 기사">
        <ContextEmpty
          title="아직 추천할 새로운 자료가 없습니다."
          hint="관심 키워드와 그래프를 기반으로 자료를 준비하고 있어요."
          cta="탐구 피드 보기"
          onCta={() => onNav("S41")}
        />
      </ContextCard>
    );
  }

  // 걸린 내 키워드 (useDashboardData 에서 표기를 다듬어 넣어 준다)
  const keywords = item.keywords || [];

  return (
    <ContextCard
      hostProps={car.pauseProps}
      title="오늘의 관심 기사"
      meta={items.length > 1 ? `${car.index + 1} / ${items.length}` : undefined}
      onViewAll={items.length > 1 ? undefined : () => onNav("S41")}
      actions={
        <>
          <ContextButton
            primary
            onClick={() => onAsk(item)}
            label={`${item.title} 기사를 AI 문맥으로 첨부`}
          >
            AI에게 질문
          </ContextButton>
          <CarouselControls
            index={car.index}
            total={items.length}
            onPrev={car.prev}
            onNext={car.next}
            onGo={car.go}
            label="관심 기사"
          />
        </>
      }
    >
      {/* key 를 바꿔 내용만 페이드로 교체한다 — 카드 자체는 움직이지 않는다 */}
      <div className="ctx-slide" key={item.id}>
        {/* 종류는 회색 꼬리표, **걸린 내 키워드는 파란 알약**. 색을 나눠야
            "이건 논문이다"와 "이건 내 관심사다"가 섞이지 않는다. 여러 개가
            걸렸으면 여러 개를 보여준다 — 하나만 보이면 우연히 걸린 것처럼 읽힌다. */}
        <p className="ctx-kicker">
          <span className={`ctx-kind ${item.kind === "paper" ? "is-paper" : ""}`}>
            {item.kind === "paper" ? "논문" : "뉴스"}
          </span>
          {keywords.map((k) => (
            <span key={k} className="ctx-kw">{k}</span>
          ))}
        </p>
        <a
          className="ctx-title-link"
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          title={item.title}
          onClick={() => onOpen(item)}
        >
          {item.title}
        </a>
        {/* 키워드 알약이 "왜 이 글인지"를 이미 말하므로, 여기서는 출처와 시각만.
            "내 키워드 ‘X’와 관련된 글입니다"를 또 쓰면 같은 말을 두 번 한다. */}
        <p className="ctx-sub">
          {item.outlet && <span className="ctx-sub-dim">{item.outlet}</span>}
          {item.published_at && <span className="ctx-sub-dim"> · {timeAgo(item.published_at)}</span>}
        </p>
      </div>
    </ContextCard>
  );
}
