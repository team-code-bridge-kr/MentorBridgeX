import { useState, useEffect, useMemo } from "react";
import TDS from "../../theme/tokens.js";
import { TFI, Badge } from "../../components/ui.jsx";
import api from "../../api/index.js";

const AREA_LABEL = {
  subject_specific: "세부능력 및 특기사항",
  autonomous: "자율활동",
  club: "동아리활동",
  volunteer: "봉사활동",
  career: "진로활동",
  behavior: "행동특성 및 종합의견",
  reading: "독서활동",
  award: "수상경력",
};

function ago(ms) {
  if (!ms || Number.isNaN(ms)) return "";
  const d = Date.now() - ms;
  if (d < 60_000) return "방금 전";
  if (d < 3600_000) return `${Math.floor(d / 60_000)}분 전`;
  if (d < 86400_000) return `${Math.floor(d / 3600_000)}시간 전`;
  return `${Math.floor(d / 86400_000)}일 전`;
}

function match(q, ...parts) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return parts.some((p) => String(p || "").toLowerCase().includes(needle));
}

export function S27({ onNav }) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("전체");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const [graph, docs, voices, comments] = await Promise.all([
          api.graph.fetch(),
          api.documents.list(),
          api.voice.listSessions(),
          api.comments.list(),
        ]);
        if (cancelled) return;

        const edgeCount = {};
        for (const e of graph.edges || []) {
          edgeCount[e.from] = (edgeCount[e.from] || 0) + 1;
          edgeCount[e.to] = (edgeCount[e.to] || 0) + 1;
        }

        const results = [];

        for (const n of graph.nodes || []) {
          results.push({
            id: `node:${n.id}`,
            type: "노드",
            ic: "🔵",
            t: n.label,
            d: `${n.cat || n.kind || "노드"} · 연결 ${edgeCount[n.id] || 0}개`,
            hay: [n.label, n.cat, n.kind],
            nav: { screen: "S06", store: { mbx_node_id: n.id } },
          });
        }

        for (const doc of docs || []) {
          const title = AREA_LABEL[doc.section_type] || doc.section_type || "텍스트";
          const chars = (doc.content || "").length;
          const empty = !doc.content || doc.content === "(작성 시작)";
          const updated = doc.updated_at ? Date.parse(doc.updated_at) : 0;
          results.push({
            id: `doc:${doc.id}`,
            type: "텍스트",
            ic: "📄",
            t: title,
            d: empty
              ? "미작성"
              : `${chars.toLocaleString()}자 · 수정 ${ago(updated) || "—"}`,
            hay: [title, doc.content, doc.section_type],
            nav: {
              screen: "S12",
              store: { mbx_doc_id: doc.id, mbx_doc_type: doc.section_type },
            },
          });
        }

        for (const v of voices || []) {
          results.push({
            id: `voice:${v.id}`,
            type: "음성",
            ic: "🎙️",
            t: v.t || "음성 세션",
            d: `${v.date || "—"} · ${v.dur || "0분"}${v.st ? ` · ${v.st}` : ""}`,
            hay: [v.t, v.transcript, ...(v.keywords || [])],
            nav: {
              screen: v.transcript ? "S17" : "S15",
              store: { mbx_voice_session: v.id },
            },
          });
        }

        for (const c of comments || []) {
          results.push({
            id: `comment:${c.id}`,
            type: "코멘트",
            ic: "💬",
            t: c.author ? `${c.author} 코멘트` : "코멘트",
            d: `${c.target || "전체"} · ${ago(c.createdAt) || "—"}`,
            hay: [c.author, c.content, c.target, c.type],
            nav: { screen: "S24" },
          });
        }

        setItems(results);
      } catch (e) {
        if (!cancelled) setErr(e.message || "검색 데이터를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const shown = useMemo(
    () =>
      items.filter(
        (r) =>
          (tab === "전체" || r.type === tab) &&
          match(q, r.t, r.d, ...(r.hay || [])),
      ),
    [items, tab, q],
  );

  const open = (r) => {
    if (r.nav?.store) {
      for (const [k, v] of Object.entries(r.nav.store)) {
        sessionStorage.setItem(k, v);
      }
    }
    onNav(r.nav.screen);
  };

  return (
    <div className="content" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="sec-title mb16" style={{ marginBottom: 16 }}>통합 검색</div>
      <div className="search-wrap mb20" style={{ marginBottom: 20, height: 52, fontSize: 16 }}>
        <span style={{ fontSize: 18 }}><TFI s={18} color={TDS.textTertiary}>🔍</TFI></span>
        <input
          style={{ fontSize: 16 }}
          placeholder="노드, 문서, 보고서, 코멘트 검색..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
      </div>
      <div className="tab-bar mb20" style={{ marginBottom: 20 }}>
        {["전체", "노드", "텍스트", "음성", "코멘트"].map((t) => (
          <div key={t} className={`tab-item${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>{t}</div>
        ))}
      </div>
      {err && <div style={{ color: TDS.danger, marginBottom: 12 }}>{err}</div>}
      {loading && (
        <div style={{ color: TDS.textTertiary, padding: "24px 0", textAlign: "center" }}>불러오는 중…</div>
      )}
      {!loading && !shown.length && (
        <div style={{ color: TDS.textTertiary, padding: "32px 0", textAlign: "center" }}>
          {q.trim() ? "검색 결과가 없습니다." : "아직 검색할 데이터가 없습니다."}
        </div>
      )}
      {!loading && shown.map((r) => (
        <div key={r.id} className="list-row" style={{ cursor: "pointer" }} onClick={() => open(r)}>
          <div style={{ fontSize: 24 }}><TFI s={24} color={TDS.textSecondary}>{r.ic}</TFI></div>
          <div className="list-row-left">
            <div className="list-row-title">{r.t}</div>
            <div className="list-row-sub">{r.d}</div>
          </div>
          <Badge t="grey">{r.type}</Badge>
        </div>
      ))}
    </div>
  );
}
