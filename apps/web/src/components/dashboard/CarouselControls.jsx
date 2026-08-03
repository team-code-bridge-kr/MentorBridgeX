/**
 * 회전 조작부 — 이전·다음 버튼과 위치 표시.
 *
 * 위치를 **색만으로** 알리지 않는다. 점에 aria-selected 를 주고, 카드 머리에
 * "n / m" 을 함께 적는다(색을 구분하지 못해도 어디쯤인지 알 수 있어야 한다).
 *
 * 항목이 하나면 아무것도 그리지 않는다 — 넘길 곳이 없는 화살표는 눌러 보고
 * 나서야 소용없음을 알게 된다.
 */

export function CarouselControls({ index, total, onPrev, onNext, onGo, label }) {
  if (total <= 1) return null;
  return (
    <div className="carousel-ctl">
      <button type="button" className="carousel-arrow" onClick={onPrev} aria-label={`이전 ${label}`}>
        ‹
      </button>
      <span className="carousel-dots">
        {Array.from({ length: total }, (_, i) => (
          <button
            key={i}
            type="button"
            className={`carousel-dot${i === index ? " is-on" : ""}`}
            aria-label={`${label} ${i + 1} / ${total}`}
            aria-current={i === index ? "true" : undefined}
            onClick={() => onGo(i)}
          />
        ))}
      </span>
      <button type="button" className="carousel-arrow" onClick={onNext} aria-label={`다음 ${label}`}>
        ›
      </button>
    </div>
  );
}
