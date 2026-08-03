/**
 * S05 — 대시보드 (AI 탐구 워크스페이스)
 *
 * 화면이 말하려는 것은 순서 그대로다.
 *
 *   지금 확인할 것(상단 문맥 카드 3장)
 *     → 쓸 문맥을 고른다(AI에게 질문 / AI 확장 / AI에게 묻기)
 *     → MBX 에게 묻는다(가운데 입력창)
 *     → 기사·그래프·피드백이 실제 작업으로 이어진다
 *
 * 그래서 기사·그래프·피드백은 각각 큰 기능으로 경쟁하지 않는다. 셋 다 같은 크기의
 * 얇은 카드로 위에 서 있고, 화면의 나머지는 전부 AI 영역이다.
 *
 * 두 가지 모드:
 * - 시작 화면: 인사 → 문맥 카드 3장 → AI 영역(제목·입력창·추천 질문·분류·최근 대화)
 * - 대화 모드: 카드와 추천을 걷어내고 메시지 목록만 남긴다. 답변을 읽는 중에
 *   다른 기능이 옆에 있으면 시선이 흩어진다. 대신 어떤 문맥을 쓰는 중인지는
 *   한 줄로 남겨 둔다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import api from "../../api/index.js";
import {
  useDashboardSummary,
  useRecentConversations,
  useRecommendedArticles,
} from "../../hooks/useDashboardData.js";
import { useAIChat, useAIContext } from "../../hooks/useAIChat.js";
import { useRecommendedPrompts } from "../../hooks/useRecommendedPrompts.js";
import { AIWorkspaceHero } from "../../components/dashboard/AIWorkspaceHero.jsx";
import { AIComposer } from "../../components/dashboard/AIComposer.jsx";
import { AIConversation } from "../../components/dashboard/AIConversation.jsx";
import { DashboardContextGrid } from "../../components/dashboard/DashboardContextGrid.jsx";
import { takeAsk } from "../../lib/handoff.js";

const ARTICLE_ROTATION = 4;

/** 대화 중에 쓰는 문맥을 한 줄로 — "기사 1 · 그래프 1 · 피드백 1" */
function contextSummary(items) {
  const label = { article: "기사", graph: "그래프", node: "노드", comment: "피드백", file: "파일" };
  const count = new Map();
  for (const it of items) {
    const key = label[it.type] || "문맥";
    count.set(key, (count.get(key) || 0) + 1);
  }
  return [...count].map(([k, v]) => `${k} ${v}`).join(" · ");
}

export function S05({ onNav }) {
  const { state, actions } = useStore();
  const user = state.session?.user;

  const summaryRes = useDashboardSummary();
  const articlesRes = useRecommendedArticles(ARTICLE_ROTATION);
  const convosRes = useRecentConversations(3);

  const chat = useAIChat();
  const ctx = useAIContext();
  const [draft, setDraft] = useState("");
  const [busyNode, setBusyNode] = useState("");
  const [currentArticle, setCurrentArticle] = useState(null);
  const lastSent = useRef(null);
  const threadTopRef = useRef(null);

  const summary = summaryRes.data;
  const userName = summary?.user_name || user?.name || "탐구자";
  const isNewUser =
    !summaryRes.loading &&
    !!summary &&
    !summary.onboarded &&
    (summary.graph?.node_count ?? 0) === 0;

  // 미리보기는 S06 과 같은 데이터를 그린다 — 요약본을 따로 그리면 실제 그래프와
  // 다른 그림이 된다. 이미 불러온 그래프가 있으면 다시 받지 않는다.
  const graph = state.graph;
  useEffect(() => {
    if (!graph.nodes.length && !graph.loading) {
      actions.loadGraph(user?.id).catch(() => {});
    }
    // 화면 진입 시 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 그래프 제목 = 뿌리 노드 이름. MBX 에는 별도 제목 필드가 없다.
  const graphTitle = useMemo(
    () => graph.nodes.find((n) => n.kind === "root")?.label || null,
    [graph.nodes]
  );

  const prompts = useRecommendedPrompts({
    article: currentArticle,
    summary,
    rootLabel: graphTitle,
    conversation: convosRes.data?.[0] || null,
  });
  // 대화가 시작되면 대화 영역으로 자연스럽게 이동시킨다
  useEffect(() => {
    if (chat.started) {
      threadTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [chat.started]);

  /** 문맥을 붙이고 입력창까지 내려간다. **보내지는 않는다.** */
  const attachContext = useCallback(
    (item, suggestion) => {
      ctx.add(item);
      if (suggestion) setDraft((d) => (d.trim() ? d : suggestion));
      // 레이아웃이 잡힌 뒤에 움직여야 엉뚱한 위치로 간다
      requestAnimationFrame(() => {
        const area = document.querySelector(".hero .composer-input");
        area?.scrollIntoView({ behavior: "smooth", block: "center" });
        area?.focus({ preventScroll: true });
      });
    },
    [ctx]
  );

  /** 다른 화면에서 넘긴 질문 — 화면이 뜨기 전에 온 것을 여기서 받는다 */
  const askFromElsewhere = useCallback(
    ({ prompt, context }) => {
      if (!prompt) return;
      const items = context ? [context] : [];
      lastSent.current = { text: prompt, context: items };
      chat.send(prompt, items);
      setDraft("");
      ctx.clear();
    },
    [chat, ctx]
  );

  useEffect(() => {
    const queued = takeAsk();
    if (queued) askFromElsewhere(queued);
    // 진입 시 한 번만 — 두 번 가져가면 같은 질문이 두 번 나간다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 사이드바의 "새로 시작하기" / "최근 작업"과 연결 (화면 밖에서 오는 신호)
  useEffect(() => {
    const onNew = () => { chat.reset(); ctx.clear(); setDraft(""); };
    const onResume = (e) => { if (e.detail?.id) chat.resume(e.detail.id); };
    // 대시보드가 이미 떠 있을 때 온 경우. 놔둔 값도 함께 비운다 —
    // 안 그러면 다음에 이 화면에 들어올 때 같은 질문이 한 번 더 나간다.
    const onArticle = (e) => {
      takeAsk();
      askFromElsewhere(e.detail || {});
    };
    window.addEventListener("mbx:new-chat", onNew);
    window.addEventListener("mbx:resume-chat", onResume);
    window.addEventListener("mbx:ask-article", onArticle);
    return () => {
      window.removeEventListener("mbx:new-chat", onNew);
      window.removeEventListener("mbx:resume-chat", onResume);
      window.removeEventListener("mbx:ask-article", onArticle);
    };
  }, [chat, ctx, askFromElsewhere]);

  const send = useCallback(
    (text) => {
      if (!text?.trim()) return;
      lastSent.current = { text, context: ctx.items };
      chat.send(text, ctx.items);
      setDraft("");
      ctx.clear();
    },
    [chat, ctx]
  );

  /** AI 답변 카드 안의 버튼이 부르는 경로 — 여기서는 바로 묻는다 */
  const askNow = useCallback(
    (prompt, contextItem) => {
      const items = contextItem ? [...ctx.items, contextItem] : ctx.items;
      lastSent.current = { text: prompt, context: items };
      chat.send(prompt, items);
      setDraft("");
      ctx.clear();
    },
    [chat, ctx]
  );

  const retry = useCallback(() => {
    const last = lastSent.current;
    if (last) chat.send(last.text, last.context);
  }, [chat]);

  const addNodeFromCard = useCallback(
    async (node) => {
      setBusyNode(node.label);
      try {
        await actions.addNode({ label: node.label, kind: node.kind || "topic" });
        summaryRes.reload();
      } catch (e) {
        actions.toast("error", e.message || "노드를 추가하지 못했습니다.");
      } finally {
        setBusyNode("");
      }
    },
    [actions, summaryRes]
  );

  const handlers = useMemo(
    () => ({ addNode: addNodeFromCard, busyNode, ask: (prompt) => askNow(prompt), retry }),
    [addNodeFromCard, busyNode, askNow, retry]
  );

  /**
   * 대화 중에 보여줄 문맥.
   *
   * 보내는 순간 첨부는 비워진다(그 메시지가 가져갔다). 그래도 "무엇을 물고
   * 있는지"는 계속 보여야 하므로, 새로 붙인 것이 없으면 **직전 질문이 들고 간
   * 문맥**을 보여준다.
   */
  const activeContext = useMemo(() => {
    if (ctx.items.length) return ctx.items;
    for (let i = chat.messages.length - 1; i >= 0; i -= 1) {
      const m = chat.messages[i];
      if (m.role === "user" && m.context?.length) return m.context;
    }
    return [];
  }, [ctx.items, chat.messages]);

  const openArticle = useCallback((item) => {
    api.research.markRead(item.id).catch(() => {});
  }, []);

  const pickPrompt = useCallback(
    (item) => {
      if (item.resumeId) {
        chat.resume(item.resumeId);
        return;
      }
      if (item.context) ctx.add(item.context);
      setDraft(item.prompt || item.text);
      requestAnimationFrame(() => {
        document.querySelector(".hero .composer-input")?.focus({ preventScroll: true });
      });
    },
    [chat, ctx]
  );

  const cards = (
    <DashboardContextGrid
      articles={articlesRes}
      summary={summaryRes}
      graphNodes={graph.nodes}
      graphEdges={graph.edges}
      graphTitle={graphTitle}
      onNav={onNav}
      onOpenArticle={openArticle}
      onCurrentArticle={setCurrentArticle}
      onAskArticle={(a) =>
        attachContext(
          { type: "article", id: a.id, label: a.title },
          "이 기사를 요약하고 내 그래프와 어떻게 연결할지 알려줘."
        )
      }
      onAskGraph={() =>
        attachContext(
          { type: "graph", id: null, label: graphTitle || "내 지식 그래프" },
          "이 그래프에서 부족한 탐구 영역을 찾아줘."
        )
      }
      onAskFeedback={(c) =>
        attachContext(
          { type: "comment", id: c.id, label: `${c.author}님의 피드백` },
          "이 피드백을 반영하려면 무엇을 수정해야 해?"
        )
      }
    />
  );

  return (
    <div className="dash-wrap">
      {!chat.started ? (
        <AIWorkspaceHero
          userName={userName}
          isNewUser={isNewUser}
          summary={summary}
          articles={articlesRes.data}
          conversations={convosRes.data}
          conversationsLoading={convosRes.loading}
          contextCards={cards}
          prompts={prompts}
          onPickPrompt={pickPrompt}
          draft={draft}
          onDraftChange={setDraft}
          onSubmit={send}
          onRunQuick={(prompt, contextItem) => askNow(prompt, contextItem)}
          context={ctx.items}
          onRemoveContext={ctx.remove}
          onResume={chat.resume}
          onNav={onNav}
        />
      ) : (
        <>
          <div ref={threadTopRef} />
          <div className="chat-mode">
            <div className="chat-head">
              <button
                type="button"
                className="btn-inline"
                onClick={() => { chat.reset(); ctx.clear(); }}
              >
                ← 새로 시작하기
              </button>
              {/* 카드를 걷어냈으므로, 무엇을 물고 있는지는 여기서만 알 수 있다 */}
              {activeContext.length > 0 && (
                <span className="chat-head-ctx">
                  <span className="chat-head-ctx-label">사용 중인 문맥</span>
                  {contextSummary(activeContext)}
                </span>
              )}
            </div>

            <AIConversation
              messages={chat.messages}
              streaming={chat.streaming}
              error={chat.error}
              handlers={handlers}
            />

            <div className="chat-composer">
              <AIComposer
                compact
                value={draft}
                onChange={setDraft}
                onSubmit={send}
                context={ctx.items}
                onRemoveContext={ctx.remove}
                streaming={chat.streaming}
                onStop={chat.stop}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
