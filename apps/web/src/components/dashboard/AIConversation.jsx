/**
 * 대화 시작 후 화면 — 메시지 목록 + 결과 카드.
 *
 * AI 가 긴 텍스트만 뱉지 않도록, 실행 가능한 제안은 서버에서 툴 호출로 받아
 * 여기서 **행동 버튼이 달린 카드**로 그린다. 버튼은 기존 graph/research API 를
 * 그대로 호출한다 — AI 응답이 실제 행동으로 이어지는 지점이다.
 */

import { useEffect, useRef } from "react";
import { AIContextChipList } from "./AIContextChip.jsx";
import { AnswerText } from "./AnswerText.jsx";
import mbxLogo from "../../assets/brand/TeamCodeBridge_Logo_Black_Web.png";

// 답변이 누구 말인지 한 눈에 보이게 한다 — 사용자 말풍선과 달리 답변은
// 배경이 없어서, 이름표가 없으면 그냥 페이지 본문처럼 읽힌다.
const ASSISTANT_NAME = "Bridge AI";

const KIND_LABEL = { root: "핵심", topic: "연결", leaf: "말단" };

function GraphNodesCard({ data, onAddNode, busy }) {
  const nodes = data?.nodes || [];
  if (!nodes.length) return null;
  return (
    <div className="ai-card">
      <div className="ai-card-hdr">
        <span className="ai-card-title">그래프 노드 추천</span>
        <span className="badge badge-blue">{nodes.length}개</span>
      </div>
      <ul className="ai-card-list">
        {nodes.map((n) => (
          <li key={n.label} className="ai-card-row">
            <div className="ai-card-main">
              <span className="ai-card-label">{n.label}</span>
              <span className="badge badge-grey">{KIND_LABEL[n.kind] || "연결"}</span>
              {n.connect_to && <span className="ai-card-sub">→ {n.connect_to}</span>}
              <div className="ai-card-reason">{n.reason}</div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy === n.label}
              onClick={() => onAddNode(n)}
              aria-label={`${n.label} 노드를 그래프에 추가`}
            >
              {busy === n.label ? "추가 중…" : "＋ 그래프에 추가"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InquiryTopicsCard({ data, onAsk }) {
  const topics = data?.topics || [];
  if (!topics.length) return null;
  return (
    <div className="ai-card">
      <div className="ai-card-hdr">
        <span className="ai-card-title">탐구 주제 제안</span>
        <span className="badge badge-blue">{topics.length}개</span>
      </div>
      <ul className="ai-card-list">
        {topics.map((t) => (
          <li key={t.title} className="ai-card-row">
            <div className="ai-card-main">
              <span className="ai-card-label">{t.title}</span>
              {t.subject && <span className="badge badge-grey">{t.subject}</span>}
              <div className="ai-card-reason">{t.rationale}</div>
              {t.first_step && (
                <div className="ai-card-step">첫 단계 · {t.first_step}</div>
              )}
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onAsk(`‘${t.title}’ 주제를 더 구체적으로 발전시켜줘.`)}
              aria-label={`${t.title} 더 깊이 물어보기`}
            >
              더 깊이 묻기
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FeedbackPlanCard({ data, onAsk }) {
  const steps = data?.steps || [];
  if (!steps.length) return null;
  return (
    <div className="ai-card">
      <div className="ai-card-hdr">
        <span className="ai-card-title">피드백 반영 체크리스트</span>
      </div>
      {data.summary && <p className="ai-card-summary">{data.summary}</p>}
      <ul className="ai-card-checklist">
        {steps.map((s, i) => (
          <li key={s.action}>
            <span className="ai-check-no">{i + 1}</span>
            <div>
              <div className="ai-card-label">{s.action}</div>
              {s.detail && <div className="ai-card-reason">{s.detail}</div>}
            </div>
          </li>
        ))}
      </ul>
      {data.reply_draft && (
        <div className="ai-card-draft">
          <div className="ai-card-draft-hdr">답글 초안</div>
          <p>{data.reply_draft}</p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => navigator.clipboard?.writeText(data.reply_draft)}
            aria-label="답글 초안 복사"
          >
            복사하기
          </button>
        </div>
      )}
      <button
        type="button"
        className="btn-inline"
        style={{ marginTop: 10 }}
        onClick={() => onAsk("이 체크리스트대로 하면 무엇이 달라지는지 설명해줘.")}
      >
        이어서 묻기
      </button>
    </div>
  );
}

function ResultCard({ card, handlers }) {
  if (card.type === "graph_nodes") {
    return <GraphNodesCard data={card.data} onAddNode={handlers.addNode} busy={handlers.busyNode} />;
  }
  if (card.type === "inquiry_topics") {
    return <InquiryTopicsCard data={card.data} onAsk={handlers.ask} />;
  }
  if (card.type === "feedback_plan") {
    return <FeedbackPlanCard data={card.data} onAsk={handlers.ask} />;
  }
  return null;
}

export function AIConversation({ messages, streaming, error, handlers }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="ai-thread" role="log" aria-live="polite" aria-label="MBX AI 대화">
      {messages.map((m) => (
        <div key={m.id} className={`ai-msg ai-${m.role}`}>
          {m.role === "user" ? (
            <div className="ai-bubble">
              {m.context?.length > 0 && <AIContextChipList items={m.context} />}
              <p>{m.text}</p>
            </div>
          ) : (
            <div className="ai-answer">
              <div className="ai-who">
                <img className="ai-who-avatar" src={mbxLogo} alt="" aria-hidden="true" />
                <span className="ai-who-name">{ASSISTANT_NAME}</span>
              </div>
              {m.pending && !m.text && (
                <div className="ai-typing" aria-label="답변 생성 중">
                  <span className="ai-typing-emoji" aria-hidden="true">🔎</span>
                  <span className="ai-typing-label">MBX가 살펴보고 있어요</span>
                  <span className="ai-typing-dots" aria-hidden="true">
                    <span /><span /><span />
                  </span>
                </div>
              )}
              <AnswerText text={m.text} />
              {m.cards?.map((card, i) => (
                <ResultCard key={`${m.id}-${i}`} card={card} handlers={handlers} />
              ))}
              {m.failed && (
                <div className="ai-answer-error">
                  답변이 중단되었습니다.
                  <button type="button" className="btn-inline" onClick={handlers.retry}>
                    다시 시도
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      {error && !streaming && (
        <div className="ai-answer-error" role="alert">
          {error}
          <button type="button" className="btn-inline" onClick={handlers.retry}>다시 시도</button>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
