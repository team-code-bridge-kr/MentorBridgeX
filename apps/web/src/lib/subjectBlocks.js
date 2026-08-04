/**
 * 세특 본문에 남아 있는 `[과목]` 표시를 읽는다.
 *
 * 예전에 올린 생기부는 세부능력 및 특기사항 46과목이 한 덩어리(21,000자)로
 * 저장돼 있다. 서버에 과목별로 나눠 달라고 하기 전에, **나눌 것이 있는지**를
 * 화면에서 먼저 알아야 한다 — 없는데 버튼을 띄우면 눌러도 아무 일이 안 난다.
 *
 * 규칙은 서버(`app/parsers/subject_blocks.py`)와 같아야 한다. 한쪽만 고치면
 * 화면은 "46과목"이라 하는데 서버는 나누지 못하는 일이 생긴다.
 */

// 줄 첫머리의 `[국어]`. 본문 가운데 대괄호(인용·기호)는 과목으로 보지 않는다.
const MARKER = /(?:^|\n)[ \t]*\[([^[\]\n]{1,30})\][ \t]*/g;
const NOT_SUBJECT = /^\d+$|[.!?]/;

/** 본문에 들어 있는 과목 이름들. 같은 과목이 여러 번 나오면 한 번만 센다. */
export function subjectMarkers(text) {
  const out = [];
  for (const m of String(text || "").matchAll(MARKER)) {
    const name = m[1].trim().replace(/\s+/g, " ");
    if (name && !NOT_SUBJECT.test(name) && !out.includes(name)) out.push(name);
  }
  return out;
}

/** 과목별로 나눌 수 있는 덩어리인지. */
export function hasSubjectBlocks(text) {
  return subjectMarkers(text).length >= 2;
}
