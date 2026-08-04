/**
 * AI 대화 상태 훅.
 *
 * 문맥(useAIContext)과 대화(useAIChat)를 나눈 이유: 하단 카드가 "AI에게 질문"을
 * 누르면 대화가 아직 시작되지 않은 상태에서도 문맥만 먼저 붙어야 한다.
 */

import { useCallback, useRef, useState } from "react";
import api from "../api/index.js";

/** 챗봇에 첨부된 문맥 칩. 카드 액션과 사용자가 직접 추가/제거한다. */
export function useAIContext() {
  const [items, setItems] = useState([]);

  const add = useCallback((item) => {
    setItems((prev) => {
      const key = `${item.type}:${item.id ?? ""}`;
      if (prev.some((p) => `${p.type}:${p.id ?? ""}` === key)) return prev;
      return [...prev, item].slice(-8); // 서버 상한과 맞춘다
    });
  }, []);

  const remove = useCallback((item) => {
    const key = `${item.type}:${item.id ?? ""}`;
    setItems((prev) => prev.filter((p) => `${p.type}:${p.id ?? ""}` !== key));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  return { items, add, remove, clear };
}

const emptyState = { messages: [], conversationId: null, title: "" };

export function useAIChat() {
  const [messages, setMessages] = useState(emptyState.messages);
  const [conversationId, setConversationId] = useState(emptyState.conversationId);
  const [title, setTitle] = useState(emptyState.title);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const streamRef = useRef(null);

  const reset = useCallback(() => {
    streamRef.current?.abort();
    streamRef.current = null;
    setMessages(emptyState.messages);
    setConversationId(emptyState.conversationId);
    setTitle(emptyState.title);
    setStreaming(false);
    setError("");
  }, []);

  /** 저장된 대화를 불러와 이어가기 */
  const resume = useCallback(async (id) => {
    setError("");
    try {
      const detail = await api.assistant.conversation(id);
      setConversationId(detail.id);
      setTitle(detail.title || "");
      setMessages(
        (detail.messages || []).map((m) => ({
          id: m.id,
          role: m.role,
          text: m.content,
          cards: m.cards || [],
          context: m.context || [],
        }))
      );
    } catch (e) {
      setError(e.message || "대화를 불러오지 못했습니다.");
    }
  }, []);

  const send = useCallback(
    (text, context = []) => {
      const body = text.trim();
      if (!body || streaming) return;

      setError("");
      setStreaming(true);

      const userMsg = {
        id: `u_${Date.now()}`,
        role: "user",
        text: body,
        context,
        cards: [],
      };
      const draftId = `a_${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: draftId, role: "assistant", text: "", cards: [], pending: true },
      ]);

      const patchDraft = (patch) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === draftId ? { ...m, ...patch(m) } : m))
        );

      streamRef.current = api.assistant.chatStream({
        message: body,
        conversationId,
        context,
        onEvent: (ev) => {
          switch (ev.type) {
            case "start":
              setConversationId(ev.conversation_id);
              // 이어가는 대화라면 이미 들고 있는 이름이 맞다 —
              // 사용자가 방금 바꾼 이름을 서버 값으로 덮어쓰지 않는다.
              setTitle((prev) => prev || ev.title || "");
              break;
            case "delta":
              patchDraft((m) => ({ text: m.text + ev.text, pending: false }));
              break;
            case "card":
              patchDraft((m) => ({ cards: [...m.cards, ev.card], pending: false }));
              break;
            case "error":
              setError(ev.message || "답변을 생성하지 못했습니다.");
              patchDraft(() => ({ pending: false, failed: true }));
              break;
            case "done":
              setStreaming(false);
              streamRef.current = null;
              // 텍스트도 카드도 없이 끝나면 빈 말풍선이 남는다
              setMessages((prev) =>
                prev.filter((m) => m.id !== draftId || m.text || m.cards.length)
              );
              break;
            default:
              break;
          }
        },
      });
    },
    [conversationId, streaming]
  );

  const stop = useCallback(() => {
    streamRef.current?.abort();
    streamRef.current = null;
    setStreaming(false);
  }, []);

  /**
   * 대화 이름 바꾸기.
   *
   * 화면에는 먼저 새 이름을 보여주고 서버에 보낸다 — 이름을 고치는 일에
   * 로딩을 기다리게 할 이유가 없다. 실패하면 원래 이름으로 되돌리고 null 을
   * 돌려준다. 이름 실패를 대화 오류로 띄우면 답변이 잘못된 것처럼 보인다.
   */
  const rename = useCallback(
    async (next) => {
      const clean = next.trim();
      if (!conversationId || !clean) return null;
      const before = title;
      setTitle(clean);
      try {
        const row = await api.assistant.renameConversation(conversationId, clean);
        setTitle(row.title);
        return row;
      } catch {
        setTitle(before);
        return null;
      }
    },
    [conversationId, title]
  );

  return {
    messages,
    conversationId,
    title,
    streaming,
    error,
    started: messages.length > 0,
    send,
    stop,
    reset,
    resume,
    rename,
  };
}
