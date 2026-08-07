/**
 * 구획끼리의 연결 — 규칙만 쓴다.
 *
 * 생기부는 나이스 출력물이라 양식이 고정이다. 그래서 "왜 이게 떴는지"를
 * 한 줄로 적을 수 있는 규칙이 먼저다. 근거를 못 쓰는 연결은 만들지 않는다 —
 * 근거 없는 카드는 추천이 아니라 잡음이고, 한 번 잡음으로 읽히면 그 다음부터는
 * 맞는 카드도 안 본다.
 *
 * 전부 브라우저에서 돈다. 클릭할 때마다 서버를 부르지 않는다.
 */

import { josa } from "./josa.js";

const packed = (s) => (s || "").replace(/\s+/g, "");

/** 과목명이 본문에 실제로 적혀 있는가. 두 글자 이름은 우연이 너무 흔하다. */
const MIN_SUBJECT_LEN = 2;
/** 함께 나온 낱말로 잇는 최소 길이. 짧으면 "학생"·"활동" 같은 말이 다 걸린다. */
const MIN_KEYWORD_LEN = 3;
/** 한 구획이 달고 나올 수 있는 카드 수. 세특 42과목이 전부 뜨면 목록이지 연결이 아니다. */
const MAX_LINKS = 8;

/**
 * 한 항목에서 뻗어 나가는 연결.
 *
 * @param source 기준 항목 {id, kind, subject, grade, text}
 * @param items  후보 전부(같은 모양)
 * @param keywords 이 학생의 그래프 노드 이름들 — 자기 생기부에서 뽑힌 말이다
 * @returns [{ itemId, why }]
 */
export function linksFrom(source, items, keywords = []) {
  if (!source) return [];
  const out = new Map(); // itemId → why (먼저 붙은 근거가 이긴다: 규칙이 셀수록 앞에 둔다)
  const add = (item, why) => {
    if (!item || item.id === source.id || out.has(item.id)) return;
    out.set(item.id, why);
  };
  const src = packed(source.text);

  // ① 같은 과목, 다른 학년. 가장 확실한 연결이고 학생이 가장 자주 찾는 것이다
  //    — "이 과목을 작년엔 뭐라고 썼지?"
  if (source.subject) {
    for (const it of items) {
      if (it.subject === source.subject && it.grade !== source.grade) {
        add(it, `같은 과목 ${it.grade || "다른 학년"} 기록`);
      }
    }
  }

  // ② 수상·창체 기록에 교과 이름이 그대로 적혀 있는 경우.
  //    `교과성적우수상(통합사회)` → 통합사회 세특. 사전 매칭이라 설명이 쉽다.
  if (source.kind !== "세특") {
    for (const it of items) {
      if (it.kind !== "세특" || !it.subject) continue;
      if (it.subject.length < MIN_SUBJECT_LEN) continue;
      if (!src.includes(packed(it.subject))) continue;
      add(it, `이 기록에 '${it.subject}'${josa(it.subject, "이", "가")} 적혀 있습니다`);
    }
  }
  // 반대 방향 — 세특에서 보면 그 과목을 언급한 수상·창체가 붙는다
  if (source.kind === "세특" && source.subject) {
    const name = packed(source.subject);
    for (const it of items) {
      if (it.kind === "세특") continue;
      if (source.subject.length < MIN_SUBJECT_LEN) continue;
      if (!packed(it.text).includes(name)) continue;
      add(it, `${it.kind} 기록에 '${source.subject}'${josa(source.subject, "이", "가")} 적혀 있습니다`);
    }
  }

  // ③ 두 기록에 같은 말이 나온 경우. 학생 자신의 그래프에서 온 낱말만 쓴다 —
  //    아무 명사나 겹치면 다 이어져서 그래프가 그물이 된다.
  const terms = [...new Set(keywords.filter((k) => k && k.length >= MIN_KEYWORD_LEN))]
    .sort((a, b) => b.length - a.length);
  const mine = terms.filter((t) => src.includes(packed(t)));
  for (const it of items) {
    if (out.has(it.id) || it.id === source.id) continue;
    const body = packed(it.text);
    const hit = mine.find((t) => body.includes(packed(t)));
    if (hit) add(it, `'${hit}'${josa(hit, "이", "가")} 두 기록에 함께 나옵니다`);
  }

  return [...out.entries()].slice(0, MAX_LINKS).map(([itemId, why]) => ({ itemId, why }));
}

/**
 * 쪽 단위 연결 — 영역을 아직 안 골랐을 때 보여줄 것.
 *
 * 그 쪽에 있는 구획들의 연결을 합치되, 같은 항목이 여러 번 나오면 첫 근거만
 * 남긴다. 근거가 다른 같은 카드를 두 번 보여줄 이유가 없다.
 */
export function linksForPage(sources, items, keywords) {
  const seen = new Map();
  for (const s of sources) {
    for (const l of linksFrom(s, items, keywords)) {
      if (!seen.has(l.itemId)) seen.set(l.itemId, l.why);
    }
  }
  return [...seen.entries()].slice(0, MAX_LINKS).map(([itemId, why]) => ({ itemId, why }));
}

/**
 * 1층 — 이 쪽에서 읽어낸 것.
 *
 * 전부 세어서 나오는 값이다. 추측이 섞이면 아래층(연결)의 신뢰도까지 깎는다.
 */
export function factsForPage(sources) {
  const facts = [];
  const subjects = sources.filter((s) => s.kind === "세특");
  const others = sources.filter((s) => s.kind !== "세특");

  if (subjects.length) {
    const avg = Math.round(subjects.reduce((n, s) => n + s.text.length, 0) / subjects.length);
    facts.push(["세특 과목", `${subjects.length}과목`]);
    facts.push(["평균 분량", `${avg.toLocaleString()}자`]);
    const longest = subjects.reduce((a, b) => (a.text.length >= b.text.length ? a : b));
    facts.push(["가장 긴 과목", `${longest.subject} ${longest.text.length.toLocaleString()}자`]);
  }
  for (const s of others) {
    facts.push([s.kind, `${s.text.length.toLocaleString()}자`]);
  }
  return facts.slice(0, 5);
}
