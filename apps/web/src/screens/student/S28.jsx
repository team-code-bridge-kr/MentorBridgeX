import { useState, useEffect } from "react";
import TDS from "../../theme/tokens.js";
import { Card, StatCard } from "../../components/ui.jsx";
import api from "../../api/index.js";

export function S28() {
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.stats.get().then(setStats).catch((e) => setErr(e.message));
  }, []);

  const s = stats || { node_count: 0, edge_count: 0, comment_count: 0, form_count: 0, sections: [], top_nodes: [] };
  const maxTop = Math.max(1, ...((s.top_nodes || []).map((n) => n.count || 1)));

  return (
    <div className="content">
      <div className="sec-title mb6" style={{ marginBottom: 6 }}>나의 활동 통계</div>
      <div className="sec-sub">그래프·코멘트·양식·음성 실데이터 기준</div>
      {err && <div style={{ color: TDS.danger }}>{err}</div>}
      <div className="grid4 g-20 mb24" style={{ gap: 20, marginBottom: 24 }}>
        <StatCard label="총 노드" value={`${s.node_count}개`} sub={`엣지 ${s.edge_count}`} color={TDS.blue500} />
        <StatCard label="음성 세션" value={`${s.voice_count || 0}회`} sub={`${Math.floor((s.voice_duration_sec || 0) / 60)}분`} color={TDS.success} />
        <StatCard label="코멘트" value={`${s.comment_count}개`} sub="내 코멘트" color={TDS.warning} />
        <StatCard label="양식 생성" value={`${s.form_count}개`} sub="생성 이력" color={TDS.textPrimary} />
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
          {!s.top_nodes?.length && <div style={{ fontSize: 13, color: TDS.textTertiary }}>그래프 노드가 없습니다</div>}
        </Card>
      </div>
    </div>
  );
}
