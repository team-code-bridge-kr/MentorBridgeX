import { useState, useEffect } from "react";
import TDS from "../../theme/tokens.js";
import { Btn } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";
import api from "../../api/index.js";

export function S25() {
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState("전체");
  const [err, setErr] = useState("");

  const load = async () => {
    try {
      setItems(await api.notifications.list());
    } catch (e) {
      setErr(e.message);
    }
  };

  useEffect(() => { load(); }, []);

  const unread = items.filter((n) => !n.read).length;
  const markAll = async () => {
    await api.notifications.readAll();
    setItems((p) => p.map((n) => ({ ...n, read: true })));
  };
  const markOne = async (id) => {
    await api.notifications.read(id);
    setItems((p) => p.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };
  const shown = items.filter((n) => (tab === "전체" ? true : tab === "안 읽음" ? !n.read : n.read));

  return (
    <div className="content">
      <div className="row-between mb16" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          <div className="sec-sub" style={{ marginBottom: 0 }}>
            {unread > 0 ? `읽지 않은 알림 ${unread}개` : "새 알림이 없습니다"}
          </div>
          {unread > 0 && <span className="badge-num">{unread}</span>}
        </div>
        <Btn v="secondary" s="sm" onClick={markAll} disabled={!unread}>모두 읽음 처리</Btn>
      </div>
      {err && <div style={{ color: TDS.danger }}>{err}</div>}

      <div className="tab-pill-wrap" style={{ marginBottom: 16 }}>
        {[["전체", items.length], ["안 읽음", unread], ["읽음", items.length - unread]].map(([t, c]) => (
          <div key={t} className={`tab-pill${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>{t} ({c})</div>
        ))}
      </div>

      {!shown.length && <div style={{ textAlign: "center", padding: "48px 0", color: TDS.textTertiary, fontSize: 14 }}>알림이 없습니다</div>}

      {shown.map((n) => (
        <div key={n.id} onClick={() => markOne(n.id)} style={{ padding: "16px 18px", borderRadius: 14, marginBottom: 10, background: n.read ? TDS.bgPrimary : TDS.blue50, border: `1px solid ${n.read ? TDS.borderDefault : TDS.blue100}`, display: "flex", gap: 14, cursor: "pointer", alignItems: "flex-start", position: "relative" }}>
          {!n.read && <div style={{ position: "absolute", left: 6, top: 22, width: 7, height: 7, borderRadius: "50%", background: TDS.blue500 }} />}
          <div style={{ width: 38, height: 38, borderRadius: 10, background: n.read ? TDS.bgTertiary : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: n.read ? 0 : 6 }}>
            <NavIcon name={n.ic} size={20} color={n.read ? TDS.textTertiary : TDS.blue500} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: n.read ? 500 : 700, color: TDS.textPrimary }}>{n.t}</div>
            <div style={{ fontSize: 13, color: TDS.textSecondary, marginTop: 3, lineHeight: 1.5 }}>{n.d}</div>
          </div>
          <div style={{ fontSize: 12, color: TDS.textTertiary, flexShrink: 0, whiteSpace: "nowrap" }}>{n.time}</div>
        </div>
      ))}
    </div>
  );
}
