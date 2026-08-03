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

const emptyState = { messages: [], conversationId: null };

export function useAIChat() {
  const [messages, setMessages] = useState(emptyState.messages);
  const [conversationId, setConversationId] = useState(emptyState.conversationId);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const streamRef = useRef(null);

  const reset = useCallback(() => {
    streamRef.current?.abort();
    streamRef.current = null;
    setMessages(emptyState.messages);
    setConversationId(emptyState.conversationId);
    setStreaming(false);
    setError("");
  }, []);

  /** 저장된 대화를 불러와 이어가기 */
  const resume = useCallback(async (id) => {
    setError("");
    try {
      const detail = await api.assistant.conversation(id);
      setConversationId(detail.id);
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

  return {
    messages,
    conversationId,
    streaming,
    error,
    started: messages.length > 0,
    send,
    stop,
    reset,
    resume,
  };
}
