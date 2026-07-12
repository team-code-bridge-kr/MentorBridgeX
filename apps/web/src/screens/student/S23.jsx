import { useState, useEffect } from "react";
import TDS from "../../theme/tokens.js";
import { Btn, Notice } from "../../components/ui.jsx";
import api from "../../api/index.js";

export function S23({ onNav }) {
  const [recs, setRecs] = useState([]);
  const [decisions, setDecisions] = useState({});
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items = await api.graph.pruneSuggestions();
        if (!cancelled) setRecs(items);
      } catch (e) {
        if (!cancelled) setErr(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const decide = async (r, v) => {
    if (v === "채택") {
      try {
        await api.graph.acceptSuggestion(r.label);
        setDecisions((d) => ({ ...d, [r.id]: "채택됨" }));
      } catch (e) {
        setErr(e.message);
      }
    } else {
      setDecisions((d) => ({ ...d, [r.id]: "거부" }));
    }
  };

  return (
    <div className="content" style={{ maxWidth: 700, margin: "0 auto" }}>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>가지치기 / 확장 추천</div>
      <div style={{ fontSize: 14, color: TDS.textTertiary, marginBottom: 16 }}>
        ML(Mock)이 추천한 키워드 {loading ? "…" : recs.length}개
      </div>
      <Notice type="info" style={{ marginBottom: 20 }}>
        채택하면 그래프에 키워드 노드가 추가됩니다.
      </Notice>
      {err && <div style={{ color: TDS.danger, marginBottom: 12 }}>{err}</div>}
      <div className="card card-p" style={{ marginBottom: 16 }}>
        {!loading && !recs.length && (
          <div style={{ fontSize: 13, color: TDS.textTertiary, padding: 12 }}>추천이 없습니다. 그래프에 시드를 먼저 추가해 보세요.</div>
        )}
        {recs.map((r, i) => (
          <div
            key={r.id}
            style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 0",
              borderBottom: i < recs.length - 1 ? `1px solid ${TDS.bgTertiary}` : "none",
              opacity: decisions[r.id] ? 0.5 : 1,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{r.label}</div>
                <div style={{ padding: "2px 8px", background: TDS.blue50, borderRadius: 10, fontSize: 11, fontWeight: 600, color: TDS.blue500 }}>
                  {r.action || "추가"} 추천
                </div>
              </div>
              <div style={{ fontSize: 12, color: TDS.textTertiary }}>{r.reason}</div>
            </div>
            {decisions[r.id]
              ? <div style={{ fontSize: 12, color: TDS.textTertiary }}>{decisions[r.id]}</div>
              : (
                <div style={{ display: "flex", gap: 6 }}>
                  <Btn v="primary" s="sm" onClick={() => decide(r, "채택")}>채택</Btn>
                  <Btn v="ghost" s="sm" onClick={() => decide(r, "거부")}>거부</Btn>
                </div>
                )}
          </div>
        ))}
      </div>
      <Btn v="primary" s="md" fw onClick={() => onNav("S06")}>그래프로 이동</Btn>
    </div>
  );
}
