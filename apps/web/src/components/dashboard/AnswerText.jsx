/**
 * AI 답변 텍스트 렌더러.
 *
 * 모델은 마크다운을 섞어서 답한다. 그대로 출력하면 화면에 별표가 그대로 보인다
 * ("**컴퓨터공학** → …"). 라이브러리를 하나 더 들이는 대신, 답변에 실제로
 * 나오는 문법만 직접 처리한다: 굵게, 인라인 코드, 글머리표, 번호 목록, 제목.
 *
 * dangerouslySetInnerHTML 을 쓰지 않는다 — 모델 출력은 신뢰할 수 없는 문자열이고,
 * 여기서 만드는 건 전부 React 엘리먼트라 HTML 이 섞여 들어와도 그냥 글자로 남는다.
 */

// **굵게** 와 `코드` 만 인라인으로 본다. 별표 하나(*기울임*)는 쓰지 않는다 —
// 곱셈 기호나 목록 기호와 헷갈려서 오히려 잘못 잘린다.
const INLINE = /(\*\*[^*]+\*\*|`[^`]+`)/g;

function inline(text, keyPrefix) {
  return text.split(INLINE).filter(Boolean).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }
    return <span key={key}>{part}</span>;
  });
}

const BULLET = /^\s*[-*·]\s+/;
const NUMBER = /^\s*(\d+)[.)]\s+/;
const HEADING = /^\s*#{1,4}\s+/;

/** 줄들을 문단·목록 덩어리로 묶는다. 스트리밍 중에도 매 글자마다 다시 돈다. */
function toBlocks(text) {
  const blocks = [];
  let buffer = null; // { type, items }

  const flush = () => {
    if (buffer) blocks.push(buffer);
    buffer = null;
  };

  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); continue; }

    if (HEADING.test(line)) {
      flush();
      blocks.push({ type: "h", text: line.replace(HEADING, "") });
      continue;
    }
    if (BULLET.test(line)) {
      if (buffer?.type !== "ul") { flush(); buffer = { type: "ul", items: [] }; }
      buffer.items.push(line.replace(BULLET, ""));
      continue;
    }
    if (NUMBER.test(line)) {
      if (buffer?.type !== "ol") { flush(); buffer = { type: "ol", items: [] }; }
      buffer.items.push(line.replace(NUMBER, ""));
      continue;
    }
    if (buffer?.type !== "p") { flush(); buffer = { type: "p", items: [] }; }
    buffer.items.push(line);
  }
  flush();
  return blocks;
}

export function AnswerText({ text }) {
  if (!text) return null;
  const blocks = toBlocks(text);

  return (
    <div className="ai-answer-text">
      {blocks.map((b, i) => {
        if (b.type === "h") {
          return <p key={i} className="ai-answer-h">{inline(b.text, i)}</p>;
        }
        if (b.type === "ul" || b.type === "ol") {
          const List = b.type === "ul" ? "ul" : "ol";
          return (
            <List key={i} className={`ai-answer-list ai-answer-${b.type}`}>
              {b.items.map((item, j) => <li key={j}>{inline(item, `${i}-${j}`)}</li>)}
            </List>
          );
        }
        // 문단 안의 줄바꿈은 그대로 살린다 (모델이 줄을 나눠 쓰는 경우가 많다)
        return (
          <p key={i}>
            {b.items.map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(line, `${i}-${j}`)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
