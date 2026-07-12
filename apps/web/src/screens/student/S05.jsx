import { useState, useEffect } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn } from "../../components/ui.jsx";
import { KIND_META } from "../../theme/graphMeta.js";
import { NavIcon } from "../../components/NavIcon.jsx";
import api from "../../api/index.js";

function ago(ts) {
  const ms = Date.now() - ts;
  if (ms < 3_600_000) return `${Math.max(1, Math.floor(ms / 60_000))}분 전`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}시간 전`;
  return "어제";
}

export function S05({ onNav }) {
  const { state, actions } = useStore();
  const { nodes } = state.graph;
  const [stats,    setStats]    = useState(null);
  const [comments, setComments] = useState([]);
  const [notifs,   setNotifs]   = useState([]);

  useEffect(() => {
    if (state.session?.user?.id) actions.loadGraph(state.session.user.id);
    api.stats.get()           .then(setStats)   .catch(() => {});
    api.comments.list()       .then(setComments).catch(() => {});
    api.notifications.list()  .then(setNotifs)  .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.session?.user?.id]);

  const nodeCount    = nodes.length || stats?.node_count || 0;
  const sectionDone  = stats?.sections?.filter(s => (s.pct ?? 0) > 0)?.length ?? 0;
  const unreadCount  = comments.filter(c => !c.replied).length;

  // ── stat 카드 ────────────────────────────────────────────────
  const cards = [
    {
      label: "총 노드 수",
      value: `${nodeCount.toLocaleString()}개`,
      sub:   nodeCount ? "Neo4j 실제 데이터" : "시드를 추가해 보세요",
      color: TDS.blue500, icon: "🧠", iconBg: TDS.blue50,
    },
    {
      label: "텍스트 영역",
      value: `${sectionDone} / 8`,
      sub:   sectionDone === 8 ? "모든 영역 입력됨" : `${8 - sectionDone}개 미작성`,
      color: TDS.success, icon: "📄", iconBg: TDS.successBg,
    },
    {
      label: "음성 세션",
      value: `${stats?.voice_count ?? 0}회`,
      sub:   `총 ${Math.floor((stats?.voice_duration_sec || 0) / 60)}분 녹음`,
      color: TDS.textPrimary, icon: "🎙️", iconBg: TDS.bgTertiary,
    },
    {
      label: "양식 생성",
      value: `${stats?.form_count ?? 0}개`,
      sub:   "이번 달 생성",
      color: TDS.warning, icon: "📋", iconBg: TDS.warningBg,
    },
  ];

  // ── 최근 활동: stats.recent_activities 없으면 코멘트로 파생 ──
  const rawActivities = stats?.recent_activities || [];
  const feedItems = rawActivities.length
    ? rawActivities.slice(0, 5)
    : comments.slice(0, 5).map(c => ({
        type:   "코멘트 수신",
        detail: `${c.author}님이 코멘트를 남겼습니다`,
        time:   ago(c.createdAt),
      }));

  return (
    <div className="content">

      {/* ── Stat 카드 ─────────────────────────────────────────── */}
      <div className="grid4" style={{ gap: 20, marginBottom: 24 }}>
        {cards.map((s) => (
          <div key={s.label} className="card" style={{ padding: "22px 24px", position: "relative", overflow: "hidden" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: s.iconBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <TFI s={22} color={s.color}>{s.icon}</TFI>
            </div>
            <div style={{ fontSize: 13, color: TDS.textTertiary, fontWeight: 500, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color, lineHeight: 1.15, marginBottom: 8 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: TDS.textDisabled }}>{s.sub}</div>
            <div style={{ position: "absolute", top: 20, right: 20, padding: "3px 8px", borderRadius: 4, background: TDS.successBg, color: TDS.success, fontSize: 11, fontWeight: 700 }}>LIVE</div>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: s.color, borderRadius: "0 0 16px 16px" }} />
          </div>
        ))}
      </div>

      {/* ── 그래프 미리보기 | 최근 활동 ──────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 20, marginBottom: 20 }}>

        {/* 그래프 미리보기 */}
        <div className="card card-p">
          <div className="card-hdr" style={{ marginBottom: 12 }}>
            <span className="card-title">그래프 미리보기</span>
            <Btn v="ghost" s="sm" onClick={() => onNav("S06")}>전체 보기</Btn>
          </div>
          <div style={{ position: "relative", height: 230, background: `radial-gradient(circle at 50% 40%, ${TDS.bgSecondary} 0%, ${TDS.bgTertiary} 100%)`, borderRadius: 12, border: `1px solid ${TDS.borderDefault}`, overflow: "hidden" }}>
            {!nodes.length ? (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, color: TDS.textTertiary }}>
                <NavIcon name="branch" size={32} color={TDS.borderStrong} />
                <div style={{ fontSize: 13 }}>아직 노드가 없습니다</div>
                <Btn v="primary" s="sm" onClick={() => onNav("S09")}>첫 시드 추가</Btn>
              </div>
            ) : nodes.slice(0, 24).map((n) => {
              const meta = KIND_META[n.kind] || KIND_META.topic;
              return (
                <div key={n.id}
                  onClick={() => onNav("S06")}
                  style={{ position: "absolute", left: n.x, top: n.y, transform: "translate(-50%,-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: n.color, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(0,0,0,.18)" }}>
                    <NavIcon name={meta.icon} size={12} color="#fff" />
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 600, color: TDS.textPrimary, background: TDS.bgPrimary, padding: "1px 5px", borderRadius: 6, whiteSpace: "nowrap", border: `1px solid ${TDS.borderDefault}` }}>
                    {n.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 최근 활동 */}
        <div className="card card-p">
          <div className="card-hdr" style={{ marginBottom: 12 }}>
            <span className="card-title">최근 활동</span>
          </div>
          {!feedItems.length ? (
            <div style={{ fontSize: 13, color: TDS.textTertiary }}>최근 활동이 없습니다</div>
          ) : feedItems.map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: i < feedItems.length - 1 ? `1px solid ${TDS.bgTertiary}` : "none" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: TDS.blue500, flexShrink: 0, marginTop: 6 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: TDS.textPrimary }}>{a.type ?? a.title}</div>
                <div style={{ fontSize: 12, color: TDS.textTertiary, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.detail ?? a.description}</div>
              </div>
              <div style={{ fontSize: 11, color: TDS.textDisabled, whiteSpace: "nowrap", flexShrink: 0 }}>{a.time ?? a.ago}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 미읽 코멘트 | 알림 ───────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 20 }}>

        {/* 미읽 코멘트 */}
        <div className="card card-p">
          <div className="card-hdr" style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="card-title">미읽 코멘트</span>
              {unreadCount > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 700 }}>
                  {unreadCount}
                </span>
              )}
            </div>
            <Btn v="ghost" s="sm" onClick={() => onNav("S24")}>전체 보기</Btn>
          </div>
          {!comments.length ? (
            <div style={{ fontSize: 13, color: TDS.textTertiary, padding: "12px 0" }}>코멘트가 없습니다</div>
          ) : comments.slice(0, 3).map((c, i) => (
            <div key={c.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 0", borderBottom: i < Math.min(comments.length, 3) - 1 ? `1px solid ${TDS.bgTertiary}` : "none" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: TDS.blue50, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14, fontWeight: 700, color: TDS.blue500 }}>
                {c.author?.[0] ?? "?"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: TDS.textPrimary }}>{c.author}</span>
                  <span style={{ fontSize: 11, color: TDS.textDisabled }}>{ago(c.createdAt)}</span>
                </div>
                <div style={{ fontSize: 13, color: TDS.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.content}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 알림 */}
        <div className="card card-p">
          <div className="card-hdr" style={{ marginBottom: 12 }}>
            <span className="card-title">알림</span>
            <Btn v="ghost" s="sm" onClick={() => onNav("S25")}>전체 보기</Btn>
          </div>
          {!notifs.length ? (
            <div style={{ fontSize: 13, color: TDS.textTertiary }}>새 알림이 없습니다</div>
          ) : notifs.slice(0, 4).map((n, i) => (
            <div key={n.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: i < Math.min(notifs.length, 4) - 1 ? `1px solid ${TDS.bgTertiary}` : "none" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: n.read ? TDS.borderStrong : TDS.blue500, flexShrink: 0, marginTop: 5 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: TDS.textPrimary }}>{n.t}</div>
                <div style={{ fontSize: 12, color: TDS.textTertiary, marginTop: 2 }}>{n.d}</div>
              </div>
              <div style={{ fontSize: 11, color: TDS.textDisabled, whiteSpace: "nowrap", flexShrink: 0 }}>{n.time}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
