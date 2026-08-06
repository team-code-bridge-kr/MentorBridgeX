/**
 * 어디서든 열리는 Bridge AI 도크.
 *
 * 물어볼 일은 **다른 일을 하는 도중에** 생긴다 — 생기부를 읽다가, 그래프를 보다가,
 * 기사를 넘기다가. 그때마다 대시보드로 옮겨 가면 보던 것을 잃는다. 녹음 도크와
 * 같은 자리, 같은 모양으로 연다.
 *
 * 대화는 **대시보드와 같은 것**이다. 같은 훅(useAIChat)·같은 엔드포인트를 쓰므로
 * 여기서 물은 것이 저장되고, 대시보드에서 이어 볼 수 있다. 도크용으로 따로
 * 저장하지 않는다 — 두 벌이 되면 어느 쪽이 진짜인지 알 수 없다.
 *
 * 좁은 자리라 대시보드가 하는 일을 다 하지는 않는다. 문맥 칩·카드 상세·파일
 * 첨부는 대시보드 몫이고, 여기서는 **묻고 답을 읽는 것**까지다. 더 필요하면
 * "전체 화면으로" 로 넘어간다 — 그때 대화가 그대로 이어진다.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { NavIcon } from "../NavIcon.jsx";
import { useAIChat } from "../../hooks/useAIChat.js";
import api from "../../api/index.js";
import { queueRestore } from "../../lib/handoff.js";

const RECENT_LIMIT = 3;

const when = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });
};

// 대시보드 화면. 여기 있는 동안에는 "전체 화면으로" 가 갈 데가 없다.
const FULL_SCREEN = "S05";

export function ChatDock({ open, onClose, onNav, screen }) {
  const chat = useAIChat();
  const [draft, setDraft] = useState("");
  const [recent, setRecent] = useState([]);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  // 최근 대화는 열 때마다 새로 읽는다. 대시보드에서 나눈 대화가 여기 안 보이면
  // "같은 대화" 라는 말이 거짓말이 된다.
  useEffect(() => {
    if (!open || chat.started) return;
    api.assistant.conversations(RECENT_LIMIT).then(setRecent).catch(() => setRecent([]));
  }, [open, chat.started]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [chat.messages]);

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text || chat.streaming) return;
    setDraft("");
    chat.send(text, []);
  }, [draft, chat]);

  if (!open) return null;

  return (
    <div className="cdock" role="dialog" aria-label="Bridge AI">
      <div className="cdock-head">
        <span className="cdock-title">
          <NavIcon name="sparkle" size={16} color="var(--primary)" /> Bridge AI
        </span>
        <div className="row g-8" style={{ gap: 6 }}>
          {chat.started && (
            <button type="button" className="cdock-ghost" onClick={() => { chat.reset(); setDraft(""); }}>
              새 대화
            </button>
          )}
          <button type="button" className="vdock-x" onClick={onClose} aria-label="닫기">
            <NavIcon name="close" size={15} color="var(--tt)" />
          </button>
        </div>
      </div>

      <div className="cdock-body">
        {!chat.started ? (
          <>
            <div className="vdock-sub">최근 대화</div>
            {recent.map((c) => (
              <button
                key={c.id}
                type="button"
                className="cdock-recent"
                onClick={() => chat.resume(c.id)}
              >
                <span className="cdock-recent-title">{c.title || "제목 없는 대화"}</span>
                <span className="cdock-recent-when">{when(c.updated_at || c.created_at)}</span>
              </button>
            ))}
            {!recent.length && <div className="vdock-hint">아직 나눈 대화가 없습니다. 무엇이든 물어보세요.</div>}
          </>
        ) : (
          <div className="cdock-thread" role="log" aria-live="polite">
            {chat.messages.map((m) => (
              <div key={m.id} className={`cdock-msg is-${m.role}`}>
                {m.pending ? <span className="cdock-dots"><i /><i /><i /></span> : m.text}
                {/* 카드는 이름만 보여주고 자세한 것은 전체 화면에서 본다.
                    좁은 자리에 카드를 펼치면 대화가 안 보인다. */}
                {!!m.cards?.length && (
                  <span className="cdock-cards">참고 {m.cards.length}건 — 전체 화면에서 볼 수 있습니다</span>
                )}
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}
        {chat.error && <div className="cdock-err">{chat.error}</div>}
      </div>

      <div className="cdock-foot">
        <textarea
          ref={inputRef}
          className="cdock-input"
          rows={1}
          value={draft}
          placeholder="무엇이든 물어보세요"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // 줄바꿈은 Shift+Enter. 좁은 상자라 Enter 가 보내기여야 손이 안 멈춘다.
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
          }}
        />
        {chat.streaming ? (
          <button type="button" className="cdock-send is-stop" onClick={chat.stop} aria-label="멈추기">
            <span className="cdock-square" />
          </button>
        ) : (
          <button type="button" className="cdock-send" onClick={send} disabled={!draft.trim()} aria-label="보내기">
            <NavIcon name="arrowRight" size={16} color="#fff" />
          </button>
        )}
      </div>

      {/* 이미 대시보드에 있으면 이 단추는 갈 곳이 없다. 이어갈 대화가 있을 때만
          "여기로 옮기기" 로 남기고, 그것도 없으면 아예 감춘다 — 눌러도 아무 일이
          없는 단추는 고장 난 것으로 읽힌다. */}
      {(screen !== FULL_SCREEN || chat.conversationId) && (
      <button
        type="button"
        className="cdock-full"
        onClick={() => {
          const here = screen === FULL_SCREEN;
          if (chat.conversationId) {
            if (here) {
              // 대시보드가 이미 떠서 듣고 있다. 놔두고 가면 아무도 가져가지
              // 않아서, 다음에 대시보드에 들어올 때 뒤늦게 되살아난다.
              window.dispatchEvent(
                new CustomEvent("mbx:resume-chat", { detail: { id: chat.conversationId } }),
              );
            } else {
              // 아직 그려지지 않은 화면에 소리쳐 봐야 놓친다. 값을 놔두고
              // 대시보드가 뜰 때 가져가게 한다(lib/handoff 와 같은 이유).
              queueRestore({ conversationId: chat.conversationId });
            }
          }
          onClose?.();
          if (!here) onNav?.(FULL_SCREEN);
        }}
      >
        {screen === FULL_SCREEN ? "이 대화를 큰 화면에서 이어가기 →" : "전체 화면으로 →"}
      </button>
      )}
    </div>
  );
}
