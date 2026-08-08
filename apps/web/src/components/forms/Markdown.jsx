/**
 * 보고서 본문. 조각 목록을 그대로 요소로 옮긴다.
 *
 * `dangerouslySetInnerHTML` 을 쓰지 않는다 — 본문은 AI 가 생성한 글이고
 * 학생이 편집도 하는 자리라, 무엇이 들어오든 **글자로만** 남아야 한다.
 */

import { inlineParts, parseMarkdown } from "../../lib/miniMarkdown.js";

const Inline = ({ text }) => (
  <>
    {inlineParts(text).map((p, i) => (p.b ? <strong key={i}>{p.t}</strong> : <span key={i}>{p.t}</span>))}
  </>
);

/**
 * @param dropLeadingTitle 첫 줄이 `# 제목` 이면 지운다. AI 는 본문 맨 위에
 *   문서 제목을 한 번 더 적는데, 화면 머리에 이미 같은 제목이 서 있어서
 *   그대로 두면 같은 말이 두 번 크게 나온다.
 */
export function Markdown({ text, dropLeadingTitle = false }) {
  let blocks = parseMarkdown(text);
  if (dropLeadingTitle && blocks[0]?.kind === "h" && blocks[0].level === 1) blocks = blocks.slice(1);
  if (!blocks.length) return null;

  return (
    <div className="md">
      {blocks.map((b, i) => {
        if (b.kind === "h") {
          // 문서 제목은 화면 머리에 이미 있다. 본문의 `#` 은 한 단계 낮춰 받아
          // 같은 제목이 두 번 크게 서지 않게 한다.
          const Tag = `h${Math.min(4, b.level + 1)}`;
          return <Tag key={i} className={`md-h md-h${b.level}`}><Inline text={b.text} /></Tag>;
        }
        if (b.kind === "ul" || b.kind === "ol") {
          const Tag = b.kind;
          return (
            <Tag key={i} className="md-list">
              {b.items.map((it, j) => <li key={j}><Inline text={it} /></li>)}
            </Tag>
          );
        }
        return <p key={i} className="md-p"><Inline text={b.text} /></p>;
      })}
    </div>
  );
}
