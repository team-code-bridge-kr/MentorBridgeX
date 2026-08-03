/**
 * 상단 문맥 카드 세 장.
 *
 * **한 카드가 실패해도 나머지는 그대로 뜬다.** 기사 추천이 죽었다고 그래프와
 * 피드백까지 사라지면, 학생은 서비스 전체가 고장 난 줄 안다. 그래서 로딩·오류를
 * 카드마다 따로 처리한다.
 */

import { ContextError, ContextSkeleton } from "./ContextCard.jsx";
import { RotatingArticleCard } from "./RotatingArticleCard.jsx";
import { RecentGraphContextCard } from "./RecentGraphContextCard.jsx";
import { PendingFeedbackContextCard } from "./PendingFeedbackContextCard.jsx";

export function DashboardContextGrid({
  articles,
  summary,
  graphNodes,
  graphEdges,
  graphTitle,
  onNav,
  onOpenArticle,
  onAskArticle,
  onAskGraph,
  onAskFeedback,
  onCurrentArticle,
}) {
  return (
    <div className="ctx-grid">
      {articles.loading ? (
        <ContextSkeleton title="오늘의 관심 기사" />
      ) : articles.error ? (
        <ContextError title="오늘의 관심 기사" message={articles.error} onRetry={articles.reload} />
      ) : (
        <RotatingArticleCard
          articles={articles.data}
          onOpen={onOpenArticle}
          onAsk={onAskArticle}
          onNav={onNav}
          onCurrentChange={onCurrentArticle}
        />
      )}

      {summary.loading ? (
        <ContextSkeleton title="최근 지식 그래프" />
      ) : summary.error ? (
        <ContextError title="최근 지식 그래프" message={summary.error} onRetry={summary.reload} />
      ) : (
        <RecentGraphContextCard
          graph={summary.data?.graph}
          nodes={graphNodes}
          edges={graphEdges}
          title={graphTitle}
          onNav={onNav}
          onAsk={onAskGraph}
        />
      )}

      {summary.loading ? (
        <ContextSkeleton title="확인할 피드백" />
      ) : summary.error ? (
        <ContextError title="확인할 피드백" message={summary.error} onRetry={summary.reload} />
      ) : (
        <PendingFeedbackContextCard
          items={summary.data?.pending_feedback}
          count={summary.data?.pending_feedback_count}
          onNav={onNav}
          onAsk={onAskFeedback}
        />
      )}
    </div>
  );
}
