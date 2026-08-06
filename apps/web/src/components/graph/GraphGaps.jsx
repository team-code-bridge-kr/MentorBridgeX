/**
 * 그래프의 빈 곳.
 *
 * 그래프의 값어치는 있는 것을 예쁘게 보여주는 데 있지 않다. 있는 것은 학생이
 * 이미 안다 — 자기가 쓴 생기부다. 정작 모르는 것은 **없는 것**이다.
 *
 * 판단하지 않는다. "3학년 화학Ⅱ 세특 617자가 그래프에 없다"는 사실이고,
 * 그게 문제인지 아닌지는 학생이 안다. 그래서 세 묶음 모두 **무엇이 없는지만**
 * 적고, 각 줄을 누르면 그 자리로 데려다 준다.
 */

import TDS from "../../theme/tokens.js";
import { NavIcon } from "../NavIcon.jsx";
import { Btn } from "../ui.jsx";

function Group({ title, hint, items, empty, children }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <h3 style={{ fontSize: 12, fontWeight: 700, color: TDS.textTertiary, margin: "0 0 4px" }}>
        {title} {items.length > 0 && <span style={{ color: TDS.textSecondary }}>{items.length}</span>}
      </h3>
      <p style={{ fontSize: 11.5, color: TDS.textTertiary, lineHeight: 1.55, margin: "0 0 9px", wordBreak: "keep-all" }}>
        {hint}
      </p>
      {items.length ? children : (
        <p style={{ fontSize: 12, color: TDS.textDisabled, margin: 0 }}>{empty}</p>
      )}
    </section>
  );
}

export function GraphGaps({ state, onOpenDoc, onPickNode, onRetry }) {
  if (state?.loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12 }}>
        <div className="spinner" />
        <span style={{ fontSize: 13, color: TDS.textSecondary }}>빈 곳을 찾는 중…</span>
      </div>
    );
  }
  if (state?.error) {
    return (
      <div style={{ padding: 12 }}>
        <p style={{ fontSize: 13, color: TDS.danger, margin: "0 0 8px" }}>{state.error}</p>
        <Btn v="secondary" s="sm" onClick={onRetry}>다시 시도</Btn>
      </div>
    );
  }

  const { empty_subjects: subjects = [], lonely_nodes: lonely = [], faded_topics: faded = [] } = state || {};

  return (
    <div>
      <Group
        title="그래프에 없는 과목"
        hint="생기부에는 글이 있는데 그래프에 노드가 하나도 없는 곳입니다."
        items={subjects}
        empty="모든 항목이 그래프에 들어와 있습니다."
      >
        {subjects.map((s) => (
          <button key={s.section_id} type="button" className="gap-row" onClick={() => onOpenDoc(s)}>
            <span className="gap-name">{s.where}</span>
            <span className="gap-meta">{s.chars.toLocaleString()}자</span>
          </button>
        ))}
      </Group>

      <Group
        title="이어지지 않은 개념"
        hint="다른 개념과 한 번도 이어지지 않은 노드입니다. 생기부 문서와의 연결은 세지 않았습니다."
        items={lonely}
        empty="모든 노드가 다른 개념과 이어져 있습니다."
      >
        {lonely.map((n) => (
          <button key={n.node_id} type="button" className="gap-row" onClick={() => onPickNode(n.node_id)}>
            <span className="gap-name">{n.label}</span>
            {n.section && n.section !== "기타" && <span className="gap-meta">{n.section}</span>}
          </button>
        ))}
      </Group>

      <Group
        title="요즘 안 보이는 주제"
        hint="예전 학년에는 나오는데 마지막 학년 기록에는 안 나오는 주제입니다. 나쁘다는 뜻은 아닙니다 — 이어갈지는 직접 정하세요."
        items={faded}
        empty="학년이 두 해 이상 있어야 견줄 수 있습니다."
      >
        {faded.map((t) => (
          <button key={t.node_id} type="button" className="gap-row" onClick={() => onPickNode(t.node_id)}>
            <span className="gap-name">{t.label}</span>
            <span className="gap-meta">
              <NavIcon name="history" size={11} color={TDS.textTertiary} /> {t.last_seen}까지
            </span>
          </button>
        ))}
      </Group>
    </div>
  );
}
