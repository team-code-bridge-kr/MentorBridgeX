/**
 * 최근 지식 그래프 — 가장 최근에 손댄 그래프 하나.
 *
 * 예전 카드는 그래프 그림이 카드의 대부분을 차지했다. 그림이 크면 예쁘지만,
 * 이 카드가 알려야 하는 것은 **"어디까지 했고 무엇을 이어서 할지"**다. 그래서
 * 그림은 오른쪽 구석의 작은 지도로 줄이고 글자를 앞에 뒀다.
 *
 * 그래프 제목은 뿌리 노드 이름이다. MBX 는 학생당 그래프 하나를 쓰고 별도의
 * 제목 필드가 없다 — 없는 이름을 지어내지 않고 있는 것을 쓴다.
 */

import { NavIcon } from "../NavIcon.jsx";
import { KIND_META } from "../../theme/graphMeta.js";
import { visualEdgesOf } from "../../theme/graphView.js";
import { iconForNode } from "../../theme/nodeIcons.js";
import { ContextButton, ContextCard, ContextEmpty, timeAgo } from "./ContextCard.jsx";

const DOT = { root: 7, topic: 4, leaf: 3 };

/**
 * S06 과 같은 좌표·같은 선 규칙·같은 색으로 그린 축소판.
 * 따로 배치를 만들면 "미리보기"가 아니라 다른 그림이 된다.
 */
function MiniGraph({ nodes, edges }) {
  if (!nodes?.length) return <div className="ctx-graph" aria-hidden="true" />;
  const num = (v) => (typeof v === "string" ? parseFloat(v) : Number(v)) || 0;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const lines = visualEdgesOf(nodes, edges || []);

  return (
    <div className="ctx-graph" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        {lines.map((e) => {
          const a = byId.get(e.from);
          const b = byId.get(e.to);
          if (!a || !b) return null;
          return (
            <line
              key={e.id}
              x1={num(a.x)} y1={num(a.y)} x2={num(b.x)} y2={num(b.y)}
              stroke="rgba(255,255,255,.18)"
              strokeWidth={e.branch ? 0.5 : 0.8}
            />
          );
        })}
      </svg>
      {nodes.map((n) => {
        const meta = KIND_META[n.kind] || KIND_META.topic;
        const size = DOT[n.kind] ?? DOT.leaf;
        return (
          <span
            key={n.id}
            className="ctx-graph-dot"
            style={{
              left: `${num(n.x)}%`,
              top: `${num(n.y)}%`,
              width: size,
              height: size,
              background: meta.color,
            }}
          >
            {n.kind === "root" && <NavIcon name={iconForNode(n)} size={5} color="#fff" />}
          </span>
        );
      })}
    </div>
  );
}

export function RecentGraphContextCard({ graph, nodes, edges, title, onNav, onAsk }) {
  const has = (graph?.node_count ?? 0) > 0;

  if (!has) {
    return (
      <ContextCard title="최근 지식 그래프">
        <ContextEmpty
          title="아직 생성된 지식 그래프가 없습니다."
          hint="첫 번째 탐구 주제를 그래프로 연결해보세요."
          cta="첫 그래프 만들기"
          onCta={() => onNav("S09")}
        />
      </ContextCard>
    );
  }

  return (
    <ContextCard
      title="최근 지식 그래프"
      onViewAll={() => onNav("S06")}
      actions={
        <>
          <ContextButton onClick={() => onNav("S06")}>이어서 작업</ContextButton>
          <ContextButton primary onClick={onAsk} label="이 그래프를 AI 문맥으로 첨부">
            AI 확장
          </ContextButton>
        </>
      }
    >
      <div className="ctx-graph-row">
        <div className="ctx-graph-text">
          <p className="ctx-strong">{title || "내 지식 그래프"}</p>
          <p className="ctx-sub">
            노드 {graph.node_count}개 · 연결 {graph.edge_count}개
            {graph.suggested_count > 0 && ` · 확장 추천 ${graph.suggested_count}개`}
          </p>
          <p className="ctx-sub ctx-sub-dim">
            {timeAgo(graph.last_updated) ? `${timeAgo(graph.last_updated)} 수정` : "수정 기록 없음"}
          </p>
        </div>
        <MiniGraph nodes={nodes} edges={edges} />
      </div>
    </ContextCard>
  );
}
