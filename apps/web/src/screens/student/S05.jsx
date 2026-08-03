/**
 * S05 — 대시보드 (AI 중심 탐구 워크스페이스)
 *
 * 통계 나열 화면이 아니라, 접속하자마자 다음 행동을 시작하는 화면이다.
 * 중심은 MBX AI 이고 기사·그래프·코멘트는 챗봇에 문맥을 넘기는 보조 기능이다.
 *
 * 두 가지 모드:
 * - 시작 화면: 큰 AI 입력 영역 + 하단 카드 3개 (스크롤 없이 카드 상단이 보인다)
 * - 대화 모드: 메시지 목록 + 하단 고정 입력창. 카드는 대화 아래로 밀려난다.
 *
 * 기존 통계 카드(총 노드 수/텍스트 영역/음성 세션/양식 생성)는 삭제하지 않고
 * 통계 화면(S28)으로 옮겼다.
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
import { AIWorkspaceHero } from "../../components/dashboard/AIWorkspaceHero.jsx";
import { AIComposer } from "../../components/dashboard/AIComposer.jsx";
import { AIConversation } from "../../components/dashboard/AIConversation.jsx";
import {
  DailyArticleCard,
  ErrorState,
  PendingFeedbackCard,
  RecentGraphCard,
  WeeklyActivitySummary,
} from "../../components/dashboard/DashboardCards.jsx";

export function S05({ onNav }) {
  const { state, actions } = useStore();
  const user = state.session?.user;

  const summaryRes = useDashboardSummary();
  const articlesRes = useRecommendedArticles(3);
  const convosRes = useRecentConversations(3);

  const chat = useAIChat();
  const ctx = useAIContext();
  const [draft, setDraft] = useState("");
  const [busyNode, setBusyNode] = useState("");
  const lastSent = useRef(null);
  const threadTopRef = useRef(null);

  const summary = summaryRes.data;
  const userName = summary?.user_name || user?.name || "탐구자";
  const isNewUser =
    !summaryRes.loading &&
    !!summary &&
    !summary.onboarded &&
    (summary.graph?.node_count ?? 0) === 0;

  // 대화가 시작되면 대화 영역으로 자연스럽게 이동시킨다
  useEffect(() => {
    if (chat.started) {
      threadTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [chat.started]);

  // 사이드바의 "새로 시작하기" / "최근 작업"과 연결 (화면 밖에서 오는 신호)
  useEffect(() => {
    const onNew = () => { chat.reset(); ctx.clear(); setDraft(""); };
    const onResume = (e) => { if (e.detail?.id) chat.resume(e.detail.id); };
    window.addEventListener("mbx:new-chat", onNew);
    window.addEventListener("mbx:resume-chat", onResume);
    return () => {
      window.removeEventListener("mbx:new-chat", onNew);
      window.removeEventListener("mbx:resume-chat", onResume);
    };
  }, [chat, ctx]);

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

  /** 카드 액션 → 문맥을 붙이고 곧바로 질문한다 (§12 챗봇과 하단 기능 연결) */
  const askWithContext = useCallback(
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
    () => ({
      addNode: addNodeFromCard,
      busyNode,
      ask: (prompt) => askWithContext(prompt),
      retry,
    }),
    [addNodeFromCard, busyNode, askWithContext, retry]
  );

  const attachGraph = () =>
    ctx.add({ type: "graph", id: null, label: "내 지식 그래프" });

  const attachLink = (url, mode) => {
    if (mode === "voice") { onNav("S15"); return; }
    if (url) setDraft((d) => (d ? `${d}\n${url}` : url));
  };

  const saveArticle = async (article) => {
    try {
      await api.research.setSaved(article.id, true);
      actions.toast("success", "기사 보관함에 저장했습니다.");
    } catch (e) {
      actions.toast("error", e.message || "저장하지 못했습니다.");
    }
  };

  const cards = (
    <>
      <div className="dash-grid">
        <DailyArticleCard
          articles={articlesRes.data}
          loading={articlesRes.loading}
          error={articlesRes.error}
          onReload={articlesRes.reload}
          onNav={onNav}
          onAskAI={(a) =>
            askWithContext("이 기사를 요약하고 내 그래프와 어떻게 연결할지 알려줘.", {
              type: "article",
              id: a.id,
              label: a.title,
            })
          }
          onAddToGraph={saveArticle}
        />
        <RecentGraphCard
          graph={summary?.graph}
          loading={summaryRes.loading}
          error={summaryRes.error}
          onReload={summaryRes.reload}
          onNav={onNav}
          onAskAI={() =>
            askWithContext("이 그래프에서 부족한 탐구 영역을 찾아줘.", {
              type: "graph",
              id: null,
              label: "내 지식 그래프",
            })
          }
        />
        <PendingFeedbackCard
          items={summary?.pending_feedback}
          count={summary?.pending_feedback_count}
          loading={summaryRes.loading}
          error={summaryRes.error}
          onReload={summaryRes.reload}
          onNav={onNav}
          onAskAI={(c) =>
            askWithContext("이 멘토 피드백을 반영하려면 무엇을 수정해야 해?", {
              type: "comment",
              id: c.id,
              label: `${c.author}님의 피드백`,
            })
          }
        />
      </div>
      <WeeklyActivitySummary weekly={summary?.weekly} />
    </>
  );

  if (summaryRes.error && !summary) {
    return (
      <div className="dash-wrap">
        <ErrorState message={summaryRes.error} onRetry={summaryRes.reload} />
      </div>
    );
  }

  return (
    <div className="dash-wrap">
      {!chat.started ? (
        <>
          <AIWorkspaceHero
            userName={userName}
            isNewUser={isNewUser}
            summary={summary}
            articles={articlesRes.data}
            conversations={convosRes.data}
            draft={draft}
            onDraftChange={setDraft}
            onSubmit={send}
            onRunQuick={(prompt, contextItem) => askWithContext(prompt, contextItem)}
            context={ctx.items}
            onRemoveContext={ctx.remove}
            onAttachGraph={attachGraph}
            onAttachLink={attachLink}
            onResume={chat.resume}
            onNav={onNav}
          />
          {cards}
        </>
      ) : (
        <>
          <div ref={threadTopRef} />
          <div className="chat-mode">
            <div className="chat-head">
              <button type="button" className="btn-inline" onClick={() => { chat.reset(); ctx.clear(); }}>
                ← 새로 시작하기
              </button>
              {ctx.items.length > 0 && (
                <span className="chat-head-ctx">문맥 {ctx.items.length}개 첨부됨</span>
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
                onAttachGraph={attachGraph}
                onAttachLink={attachLink}
                streaming={chat.streaming}
                onStop={chat.stop}
              />
            </div>
          </div>
          {cards}
        </>
      )}
    </div>
  );
}
