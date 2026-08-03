import { useState, useEffect } from "react";
import TDS from "../../theme/tokens.js";
import { Card, StatCard, Empty } from "../../components/ui.jsx";
import api from "../../api/index.js";

export function S28() {
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.stats.get().then(setStats).catch((e) => setErr(e.message));
  }, []);

  const s = stats || { node_count: 0, edge_count: 0, comment_count: 0, form_count: 0, sections: [], top_nodes: [] };
  const maxTop = Math.max(1, ...((s.top_nodes || []).map((n) => n.count || 1)));
  const sectionDone = (s.sections || []).filter((sec) => (sec.pct ?? 0) > 0).length;

  return (
    <div className="content">
      <div className="sec-sub mb24" style={{ marginBottom: 24 }}>
        그래프·코멘트·양식·음성 실데이터 기준 · 대시보드에 있던 누적 통계는 이곳으로 모았습니다
      </div>
      {err && <div style={{ color: TDS.danger }}>{err}</div>}
      <div className="stat-row mb24" style={{ marginBottom: 24 }}>
        <StatCard label="총 노드" value={`${s.node_count}개`} sub={`엣지 ${s.edge_count}`} />
        <StatCard label="텍스트 영역" value={`${sectionDone} / 8`} sub={sectionDone === 8 ? "모든 영역 입력됨" : `${8 - sectionDone}개 미작성`} />
        <StatCard label="음성 세션" value={`${s.voice_count || 0}회`} sub={`${Math.floor((s.voice_duration_sec || 0) / 60)}분`} />
        <StatCard label="코멘트" value={`${s.comment_count}개`} sub="내 코멘트" tone="warning" />
        <StatCard label="양식 생성" value={`${s.form_count}개`} sub="생성 이력" />
      </div>
      <div className="grid2 g-20" style={{ gap: 20 }}>
        <Card>
          <div className="card-title mb16" style={{ marginBottom: 16 }}>영역별 완성도</div>
          {(s.sections || []).map((sec) => (
            <div key={sec.name} style={{ marginBottom: 12 }}>
              <div className="row-between mb4" style={{ marginBottom: 4, fontSize: 13 }}>
                <span style={{ color: TDS.textSecondary }}>{sec.name}</span>
                <span style={{ fontWeight: 600, color: sec.pct > 0 ? TDS.blue500 : TDS.textDisabled }}>{sec.pct}%</span>
              </div>
              <div className="prog-wrap">
                <div className="prog-fill" style={{ width: `${sec.pct}%`, background: sec.pct > 0 ? TDS.blue500 : TDS.bgTertiary }} />
              </div>
            </div>
          ))}
        </Card>
        <Card>
          <div className="card-title mb16" style={{ marginBottom: 16 }}>노드 분포</div>
          {(s.top_nodes || []).map((n) => (
            <div key={n.label} className="row g-12 mb12" style={{ gap: 12, marginBottom: 12, alignItems: "center" }}>
              <span style={{ fontSize: 13, width: 90, color: TDS.textSecondary }}>{n.label}</span>
              <div style={{ flex: 1, height: 8, background: TDS.bgTertiary, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: 8, background: TDS.blue500, borderRadius: 4, width: `${((n.count || 1) / maxTop) * 100}%`, opacity: 0.85 }} />
              </div>
            </div>
          ))}
          {!s.top_nodes?.length && (
            <Empty title="그래프 노드가 없습니다." hint="지식 그래프를 만들면 어떤 주제에 집중했는지 여기서 보입니다." />
          )}
        </Card>
      </div>
    </div>
  );
}
