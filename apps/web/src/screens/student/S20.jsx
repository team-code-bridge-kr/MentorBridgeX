import { useState, useEffect } from "react";
import TDS from "../../theme/tokens.js";
import { Btn, Badge, Card } from "../../components/ui.jsx";
import api from "../../api/index.js";

export function S20({ onNav }) {
  const [templates, setTemplates] = useState([]);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.forms.listTemplates().then(setTemplates).catch((e) => setErr(e.message));
  }, []);

  const generate = async (tmpl) => {
    setBusy(tmpl.id);
    setErr("");
    try {
      const doc = await api.forms.generate(tmpl.id);
      sessionStorage.setItem("mbx_form_id", doc.id);
      onNav("S22");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="content">
      <div className="row-between mb24" style={{ marginBottom: 24 }}>
        <div>
          <div className="sec-title">양식 템플릿</div>
          <div className="sec-sub">그래프 노드를 바탕으로 양식을 생성합니다 (LLM 없이 경량 생성)</div>
        </div>
        <Btn v="secondary" s="sm" onClick={() => onNav("S21")}>생성 이력 보기</Btn>
      </div>
      {err && <div style={{ color: TDS.danger, marginBottom: 12 }}>{err}</div>}
      <div className="grid3 g-16" style={{ gap: 16 }}>
        {templates.map((tmpl) => (
          <Card key={tmpl.id} style={{ cursor: "pointer" }} onClick={() => !busy && generate(tmpl)}>
            <div className="row-between mb8" style={{ marginBottom: 10 }}>
              <Badge t="blue" pill>{tmpl.category}</Badge>
              <span style={{ fontSize: 12, color: TDS.textTertiary }}>사용 {(tmpl.uses || 0).toLocaleString()}회</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{tmpl.title}</div>
            <div style={{ fontSize: 13, color: TDS.textTertiary, marginBottom: 18, lineHeight: 1.6 }}>{tmpl.description}</div>
            <Btn v="primary" s="sm" style={{ width: "100%" }} disabled={busy === tmpl.id}>
              {busy === tmpl.id ? "생성 중…" : "이 템플릿으로 생성"}
            </Btn>
          </Card>
        ))}
      </div>
    </div>
  );
}
