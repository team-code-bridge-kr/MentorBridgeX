import { useState, useEffect } from "react";
import TDS from "../../theme/tokens.js";
import { Btn } from "../../components/ui.jsx";
import api from "../../api/index.js";

export function S22({ onNav }) {
  const [editing, setEditing] = useState(false);
  const [doc, setDoc] = useState(null);
  const [content, setContent] = useState("");
  const [err, setErr] = useState("");
  const formId = sessionStorage.getItem("mbx_form_id");

  useEffect(() => {
    if (!formId) return undefined;
    let cancelled = false;
    api.forms.get(formId)
      .then((d) => {
        if (cancelled) return;
        setDoc(d);
        setContent(d.content || "");
      })
      .catch((e) => { if (!cancelled) setErr(e.message); });
    return () => { cancelled = true; };
  }, [formId]);

  const save = async () => {
    try {
      const d = await api.forms.patch(formId, { content });
      setDoc(d);
      setEditing(false);
    } catch (e) {
      setErr(e.message);
    }
  };

  if (!formId) {
    return (
      <div className="content">
        <Btn v="primary" onClick={() => onNav("S20")}>템플릿에서 생성</Btn>
      </div>
    );
  }

  const usedNodes = doc?.used_nodes || [];

  return (
    <div className="content" style={{ maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => onNav("S21")}>← 목록</button>
        <div style={{ flex: 1, fontSize: 20, fontWeight: 700 }}>{doc?.title || "양식"}</div>
        <Btn v="ghost" s="sm" onClick={() => (editing ? save() : setEditing(true))}>{editing ? "저장" : "편집"}</Btn>
      </div>
      {err && <div style={{ color: TDS.danger }}>{err}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16 }}>
        <div className="card card-p">
          {editing
            ? <textarea className="inp" rows={14} value={content} onChange={(e) => setContent(e.target.value)} style={{ fontFamily: "inherit", lineHeight: 1.8 }} />
            : <div style={{ fontSize: 14, color: TDS.textSecondary, lineHeight: 1.85, whiteSpace: "pre-line" }}>{content}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card card-p">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>사용된 노드 ({usedNodes.length}개)</div>
            {usedNodes.map((n) => (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${TDS.bgTertiary}` }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: TDS.blue500 }} />
                <span style={{ fontSize: 13, color: TDS.textSecondary }}>{n}</span>
              </div>
            ))}
            {!usedNodes.length && <div style={{ fontSize: 12, color: TDS.textTertiary }}>그래프 노드가 없습니다</div>}
          </div>
          <div className="card card-p">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>템플릿 정보</div>
            <div style={{ fontSize: 13, color: TDS.textTertiary }}>{doc?.template_id}</div>
            <div style={{ fontSize: 12, color: TDS.textDisabled, marginTop: 4 }}>생성: {(doc?.created_at || "").slice(0, 10)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
