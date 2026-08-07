/**
 * 받침에 맞는 조사.
 *
 * `'수학' 가 적혀`, `독서 감상문를 쓰는 중` 처럼 어긋나면 그 문장을 만든 쪽이
 * 어설퍼 보이고, 문구가 어설퍼 보이면 그 문구가 하는 말도 안 믿는다.
 * 화면에서 낱말을 끼워 넣어 문장을 만드는 곳이면 어디든 이걸 쓴다.
 */
export function josa(word, withFinal, without) {
  const text = (word || "").trim();
  const code = text.charCodeAt(text.length - 1);
  const hangul = code >= 0xac00 && code <= 0xd7a3;
  // 한글이 아니면(영문·숫자) 받침 있는 쪽이 대체로 자연스럽다: 'AI'이, 'C++'을
  return !hangul || (code - 0xac00) % 28 !== 0 ? withFinal : without;
}

/** `${word}${eul(word)} 씁니다` 처럼 바로 붙여 쓰는 짧은 꼴. */
export const eul = (w) => josa(w, "을", "를");
export const eun = (w) => josa(w, "은", "는");
export const i = (w) => josa(w, "이", "가");
