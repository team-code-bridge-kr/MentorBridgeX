import { useState, useEffect } from "react";
import TDS from "../../theme/tokens.js";
import { TFI, Btn } from "../../components/ui.jsx";
import api from "../../api/index.js";

export function S21({ onNav }) {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.forms.list()
      .then((data) => setItems(data || []))
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <div className="content" style={{ maxWidth: 700, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>양식 결과물 목록</div>
        <Btn v="primary" s="sm" onClick={() => onNav("S20")}>+ 새로 생성</Btn>
      </div>
      {err && <div style={{ color: TDS.danger }}>{err}</div>}
      {!items.length
        ? (
          <div className="empty">
            <TFI s={48}>📄</TFI>
            <div className="empty-title">생성한 양식이 없습니다</div>
            <Btn v="primary" s="md" onClick={() => onNav("S20")}>템플릿 선택</Btn>
          </div>
          )
        : (
          <div className="card card-p">
            {items.map((it, i) => (
              <div
                key={it.id}
                className="list-row"
                style={{ cursor: "pointer", borderBottom: i < items.length - 1 ? `1px solid ${TDS.bgTertiary}` : "none" }}
                onClick={() => { sessionStorage.setItem("mbx_form_id", it.id); onNav("S22"); }}
              >
                <TFI s={24} color={TDS.blue500}>📝</TFI>
                <div className="list-row-left">
                  <div className="list-row-title">{it.title}</div>
                  <div className="list-row-sub">{it.template_id} · {(it.created_at || "").slice(0, 10)}</div>
                </div>
                <div style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: TDS.successBg, color: TDS.success }}>{it.status}</div>
                <span style={{ color: TDS.textTertiary }}>›</span>
              </div>
            ))}
          </div>
          )}
    </div>
  );
}
