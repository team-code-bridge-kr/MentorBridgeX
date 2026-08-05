import { useState, useEffect } from "react";
import TDS from "../../theme/tokens.js";
import { Back, TFI, Btn, Card, Notice } from "../../components/ui.jsx";
import api from "../../api/index.js";
import { subjectMarkers } from "../../lib/subjectBlocks.js";
import { AREA_META } from "./S11.jsx";

export function S12({ onNav }) {
  const docId = sessionStorage.getItem("mbx_doc_id");
  const docType = sessionStorage.getItem("mbx_doc_type");
  const meta = AREA_META.find((m) => m.type === docType) || AREA_META[0];
  const [subject, setSubject] = useState(sessionStorage.getItem("mbx_doc_subject") || "");
  const [splitting, setSplitting] = useState(false);
  const [txt, setTxt] = useState("");
  const [linked, setLinked] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState("");

  useEffect(() => {
    if (!docId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const docs = await api.documents.list();
        const doc = docs.find((d) => d.id === docId);
        if (!cancelled && doc) {
          setTxt(doc.content === "(작성 시작)" ? "" : doc.content);
          setUpdatedAt(doc.updated_at || "");
          setSubject(doc.subject_id || "");
        }
        const g = await api.graph.fetch();
        if (!cancelled) {
          setLinked((g.nodes || []).slice(0, 8).map((n) => n.label));
        }
      } catch (e) {
        if (!cancelled) setErr(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [docId]);

  const save = async () => {
    if (!docId || !txt.trim()) { setErr("내용을 입력하세요."); return; }
    setSaving(true);
    setErr("");
    try {
      const d = await api.documents.patch(docId, txt.trim());
      setUpdatedAt(d.updated_at || "");
      setMsg("저장되었습니다.");
      // light sync: seed a few tokens from text into graph
      const seeds = txt.match(/[가-힣A-Za-z0-9]{2,}/g)?.slice(0, 5) || [];
      if (seeds.length) {
        try { await api.graph.generateFromSeeds(seeds); } catch { /* optional */ }
        const g = await api.graph.fetch();
        setLinked((g.nodes || []).slice(0, 8).map((n) => n.label));
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  // 지금 열린 글에 `[과목]` 표시가 남아 있는지. 세특일 때만 뜻이 있다.
  const markers = docType === "subject_specific" ? subjectMarkers(txt) : [];

  if (!docId) {
    return (
      <div className="content">
        <Btn v="primary" onClick={() => onNav("S11")}>영역 목록으로</Btn>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100%" }}>
      <div style={{ flex: 1, padding: 28, overflowY: "auto", background: TDS.bgSecondary }}>
        <div className="row g-12 mb24" style={{ gap: 12, marginBottom: 24 }}>
          <Back label="목록" onClick={() => onNav("S11")} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: TDS.textPrimary }}>{meta.t}</div>
              {/* 과목이 있으면 그게 이 문서의 이름이다 — 영역명보다 먼저 눈에 띄어야 한다. */}
              {subject && <span className="subj-pill">{subject}</span>}
            </div>
            <div style={{ fontSize: 12, color: TDS.textTertiary }}>
              {updatedAt ? `마지막 저장: ${String(updatedAt).slice(0, 19).replace("T", " ")}` : "새 문서"}
            </div>
          </div>
        </div>

        {/* 세특이 아직 한 덩어리면 여기서도 나눌 수 있다. 목록으로 되돌아가
            같은 버튼을 다시 찾게 만들 이유가 없다. */}
        {markers.length >= 2 && (
          <Notice type="info" className="mb16">
            <div className="row-between" style={{ gap: 12, width: "100%" }}>
              <span>
                이 글은 <strong>{markers.length}과목</strong>이 한 덩어리로 들어 있습니다.
                과목별로 나누면 하나씩 열어 볼 수 있습니다.
              </span>
              <Btn
                v="primary"
                s="sm"
                disabled={splitting}
                onClick={async () => {
                  setSplitting(true);
                  setErr("");
                  try {
                    const made = await api.documents.splitSubjects();
                    setMsg(`과목 ${made.length}개로 나눴습니다. 목록에서 과목을 골라 편집하세요.`);
                    onNav("S11");
                  } catch (e) {
                    setErr(e.message);
                  } finally {
                    setSplitting(false);
                  }
                }}
              >
                {splitting ? "나누는 중…" : `과목 ${markers.length}개로 나누기`}
              </Btn>
            </div>
          </Notice>
        )}

        <Notice type="info" className="mb16"><TFI>💡</TFI> 저장 시 본문 키워드를 시드로 그래프에 추가합니다.</Notice>
        {err && <div style={{ color: TDS.danger, marginBottom: 8 }}>{err}</div>}
        {msg && <div style={{ color: TDS.success, marginBottom: 8 }}>{msg}</div>}
        <Card>
          <textarea
            className="textarea"
            style={{ minHeight: 300, fontSize: 15, lineHeight: 1.8 }}
            value={txt}
            onChange={(e) => setTxt(e.target.value)}
            placeholder="영역 내용을 입력하세요"
          />
          <div className="row-between mt16" style={{ marginTop: 14 }}>
            <span style={{ fontSize: 13, color: TDS.textTertiary }}>{txt.length}자</span>
            <div className="row g-8" style={{ gap: 8 }}>
              <Btn v="secondary" s="sm" onClick={() => setTxt("")}>초기화</Btn>
              <Btn v="primary" s="sm" disabled={saving} onClick={save}>{saving ? "저장 중…" : "저장 및 그래프 동기화"}</Btn>
            </div>
          </div>
        </Card>
      </div>
      <div style={{ width: 280, flexShrink: 0, background: TDS.bgPrimary, borderLeft: `1px solid ${TDS.borderDefault}`, padding: 20, overflowY: "auto" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: TDS.textPrimary, marginBottom: 16 }}>연결된 노드</div>
        {linked.map((n) => (
          <div key={n} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: TDS.blue50, borderRadius: 10, marginBottom: 8 }}>
            <TFI s={14} color={TDS.blue500}>🔵</TFI>
            <span style={{ fontSize: 13, color: TDS.blue500, fontWeight: 600 }}>{n}</span>
          </div>
        ))}
        {!linked.length && <div style={{ fontSize: 12, color: TDS.textTertiary }}>아직 노드가 없습니다</div>}
      </div>
    </div>
  );
}
