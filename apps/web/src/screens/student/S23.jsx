/**
 * S23 가지치기/확장 추천 — **잠들어 있다.** 기능은 살아서 자리를 옮겼다.
 *
 * 여기 쓰는 API(`api.graph.pruneSuggestions` / `acceptSuggestion`)는 진짜지만,
 * 이 화면은 원래도 사이드바에서 닿지 않는 고아였다(디버그 화면 고르개로만 열렸다).
 * 같은 기능이 이제 그래프 화면의 **둘러보기 패널 → "넓혀 볼 만한 주제"** 에 있다
 * (`components/graph/GraphExplore.jsx`). 추천은 그래프를 **보면서** 판단하는
 * 것이라, 그림이 없는 화면에 따로 두면 무엇에 뻗는 가지인지 알 수 없다.
 *
 * 이 파일은 나중에 "추천만 몰아 보는 자리"가 필요해질 때를 위해 남긴다.
 */
import { useState, useEffect } from "react";
import TDS from "../../theme/tokens.js";
import { Back, Btn, Notice } from "../../components/ui.jsx";
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
    <div className="rs-wrap rs-narrow">
      <div className="form-head">
        <Back onClick={() => onNav("S06")} label="그래프" />
        <h1 className="form-title">가지치기 추천</h1>
      </div>
      {/* "ML(Mock)이 추천한" 이라고 적혀 있었다. 학생이 알 말도 아니고,
          Mock 이라는 글자는 "이건 진짜가 아니다" 로 읽힌다. */}
      <p className="sec-sub">덜어 낼 만한 가지와 더 뻗을 만한 가지 {loading ? "…" : recs.length}개</p>
      <Notice type="info" style={{ marginBottom: 20 }}>
        채택하면 그래프에 키워드 노드가 추가됩니다.
      </Notice>
      {err && <div className="form-err">{err}</div>}
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
