import { useState, useEffect } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, DonutChart } from "../../components/ui.jsx";
import api from "../../api/index.js";

export function S05({ onNav }) {
  const { state, actions } = useStore();
  const [stats, setStats] = useState(null);
  const [comments, setComments] = useState([]);
  const nodeCount = state.graph?.nodes?.length ?? stats?.node_count ?? 0;

  useEffect(() => {
    if (state.session?.user?.id) actions.loadGraph(state.session.user.id);
    api.stats.get().then(setStats).catch(() => {});
    api.comments.list().then((c) => setComments(c.slice(0, 3))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.session?.user?.id]);

  const cards = [
    {
      label: "총 노드 수",
      value: `${nodeCount.toLocaleString()}개`,
      sub: nodeCount ? "Neo4j 실제 데이터" : "시드를 추가해 보세요",
      color: TDS.blue500, icon: "🧠", iconBg: TDS.blue50, trend: "LIVE",
    },
    {
      label: "텍스트 / 양식",
      value: `${stats?.form_count ?? 0}개`,
      sub: `코멘트 ${stats?.comment_count ?? 0}개`,
      color: TDS.success, icon: "📄", iconBg: TDS.successBg, trend: "LIVE",
    },
    {
      label: "음성 세션",
      value: `${stats?.voice_count ?? 0}회`,
      sub: `${Math.floor((stats?.voice_duration_sec || 0) / 60)}분 녹음`,
      color: TDS.textPrimary, icon: "🎙️", iconBg: TDS.bgTertiary, trend: "LIVE",
    },
    {
      label: "엣지",
      value: `${stats?.edge_count ?? 0}개`,
      sub: "그래프 연결",
      color: TDS.warning, icon: "🔗", iconBg: TDS.warningBg, trend: "LIVE",
    },
  ];

  const sections = stats?.sections || [];
  const topNodes = stats?.top_nodes || [];
  const maxTop = Math.max(1, ...topNodes.map((n) => n.count || 1));

  return (
    <div className="content">
      <div className="grid4" style={{ gap: 20, marginBottom: 24 }}>
        {cards.map((s) => (
          <div key={s.label} className="card" style={{ padding: "22px 24px", position: "relative", overflow: "hidden" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: s.iconBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <TFI s={22} color={s.color}>{s.icon}</TFI>
            </div>
            <div style={{ fontSize: 13, color: TDS.textTertiary, fontWeight: 500, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color, lineHeight: 1.15, marginBottom: 8 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: TDS.textDisabled }}>{s.sub}</div>
            <div style={{ position: "absolute", top: 20, right: 20, padding: "3px 8px", borderRadius: 4, background: TDS.successBg, color: TDS.success, fontSize: 11, fontWeight: 700 }}>{s.trend}</div>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: s.color, borderRadius: "0 0 16px 16px" }} />
          </div>
        ))}
      </div>

      <div className="grid2" style={{ gap: 20, marginBottom: 24 }}>
        <div className="card card-p">
          <div className="card-hdr">
            <span className="card-title">영역 완성도</span>
            <Btn v="ghost" s="sm" onClick={() => onNav("S28")}>통계</Btn>
          </div>
          {sections.length === 0 && <div style={{ fontSize: 13, color: TDS.textTertiary }}>데이터 로딩 중…</div>}
          {sections.map((sec) => (
            <div key={sec.name} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: TDS.textSecondary }}>{sec.name}</span>
                <span style={{ fontWeight: 600, color: sec.pct > 0 ? TDS.blue500 : TDS.textDisabled }}>{sec.pct}%</span>
              </div>
              <div className="prog-wrap">
                <div className="prog-fill" style={{ width: `${sec.pct}%`, background: sec.pct > 0 ? TDS.blue500 : TDS.bgTertiary }} />
              </div>
            </div>
          ))}
          {!!sections.length && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
              <DonutChart
                size={120}
                label="평균"
                pct={`${Math.round(sections.reduce((a, s) => a + (s.pct || 0), 0) / sections.length) || 0}%`}
                data={sections.slice(0, 4).map((s, i) => ({
                  color: [TDS.blue500, TDS.success, TDS.warning, TDS.chartiOS][i % 4],
                  pct: Math.max(0.01, (s.pct || 0) / 100),
                }))}
              />
            </div>
          )}
        </div>

        <div className="card card-p">
          <div className="card-hdr">
            <span className="card-title">주요 노드</span>
            <Btn v="ghost" s="sm" onClick={() => onNav("S06")}>그래프</Btn>
          </div>
          {!topNodes.length && <div style={{ fontSize: 13, color: TDS.textTertiary }}>아직 노드가 없습니다</div>}
          {topNodes.map((n) => (
            <div key={n.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: TDS.blue500, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: TDS.textSecondary, minWidth: 90 }}>{n.label}</span>
              <div style={{ flex: 1, height: 4, background: TDS.bgTertiary, borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: 4, borderRadius: 2, background: TDS.blue500, width: `${((n.count || 1) / maxTop) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid2" style={{ gap: 20 }}>
        <div className="card card-p">
          <div className="card-hdr">
            <span className="card-title">빠른 작업</span>
          </div>
          {[
            { t: "PDF 업로드", d: "생기부 PDF 파싱", s: "S13", c: TDS.blue500 },
            { t: "음성 녹음", d: "STT 세션 시작", s: "S15", c: TDS.warning },
            { t: "양식 생성", d: "템플릿으로 작성", s: "S20", c: TDS.success },
            { t: "시드 추가", d: "그래프 키워드", s: "S09", c: TDS.blue500 },
          ].map((a, i, arr) => (
            <div
              key={a.t}
              onClick={() => onNav(a.s)}
              style={{
                display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 0", cursor: "pointer",
                borderBottom: i < arr.length - 1 ? `1px solid ${TDS.bgTertiary}` : "none",
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: a.c, flexShrink: 0, marginTop: 7 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: TDS.textPrimary }}>{a.t}</div>
                <div style={{ fontSize: 13, color: TDS.textTertiary, marginTop: 2 }}>{a.d}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="card card-p">
          <div className="card-hdr">
            <div className="row" style={{ gap: 8, alignItems: "center" }}>
              <span className="card-title">최근 코멘트</span>
              {comments.length > 0 && <span className="badge-num">{comments.length}</span>}
            </div>
            <Btn v="ghost" s="sm" onClick={() => onNav("S24")}>전체 보기</Btn>
          </div>
          {!comments.length && <div style={{ fontSize: 13, color: TDS.textTertiary, padding: "12px 0" }}>코멘트가 없습니다</div>}
          {comments.map((c, i) => (
            <div key={c.id} style={{ padding: "13px 0", borderBottom: i < comments.length - 1 ? `1px solid ${TDS.bgTertiary}` : "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{c.author}</span>
                <span style={{ fontSize: 11, color: TDS.textDisabled }}>{c.type}</span>
              </div>
              <div style={{ fontSize: 13, color: TDS.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.content}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
