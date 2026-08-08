/**
 * AI 가 쓴 보고서를 **읽을 수 있는 모양**으로 바꾼다.
 *
 * 양식 생성 프롬프트는 마크다운을 돌려준다 — `## 컴퓨터 과학과 수학의 융합 학습`
 * 같은 식이다. 그런데 화면은 그걸 통글자로 뿌리고 있어서, 학생이 보는 건
 * 제목이 아니라 `##` 이라는 기호였다. 자기 보고서인데 남의 코드처럼 보인다.
 *
 * 라이브러리를 들이지 않는다. 여기서 나오는 마크다운은 우리가 쓴 프롬프트가
 * 만든 것이라 **모양이 정해져 있다** — 제목, 글머리표, 문단, 굵은 글씨. 그
 * 네 가지를 위해 번들에 수십 KB 를 더할 이유가 없다.
 *
 * HTML 을 만들지 않고 **조각 목록**을 돌려준다. 화면이 그걸 React 요소로
 * 그리므로, 보고서 안에 `<script>` 가 섞여 있어도 글자로만 남는다.
 */

/** `**굵게**` 만 가른다. 나머지 기호는 글자 그대로 둔다. */
export function inlineParts(text) {
  const out = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: text.slice(last, m.index) });
    out.push({ t: m[1], b: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last) });
  return out;
}

/**
 * 줄글을 블록 목록으로.
 *
 * @returns [{ kind: "h", level, text } | { kind: "ul"|"ol", items } | { kind: "p", text }]
 */
export function parseMarkdown(src) {
  const lines = String(src || "").split(/\r?\n/);
  const blocks = [];
  let para = [];
  let list = null;  // { kind, items }

  const flushPara = () => {
    if (!para.length) return;
    blocks.push({ kind: "p", text: para.join(" ") });
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    blocks.push(list);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushPara(); flushList(); continue; }

    const h = line.match(/^(#{1,4})\s+(.+)$/);
    if (h) {
      flushPara(); flushList();
      blocks.push({ kind: "h", level: h[1].length, text: h[2].trim() });
      continue;
    }

    const ul = line.match(/^\s*[-*·]\s+(.+)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ul || ol) {
      flushPara();
      const kind = ul ? "ul" : "ol";
      // 글머리표와 번호가 붙어 있으면 각각 제 목록이다. 섞으면 번호가 엉킨다.
      if (!list || list.kind !== kind) { flushList(); list = { kind, items: [] }; }
      list.items.push((ul ? ul[1] : ol[1]).trim());
      continue;
    }

    flushList();
    para.push(line.trim());
  }
  flushPara();
  flushList();
  return blocks;
}
