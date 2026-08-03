import { useState, useEffect } from "react";
import TDS from "../../theme/tokens.js";
import { Btn, Empty } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";
import { useStore } from "../../store/StoreProvider.jsx";

export function S25() {
  const { state, actions } = useStore();
  const items = state.notifications || [];
  const [tab, setTab] = useState("전체");
  const [err, setErr] = useState("");

  useEffect(() => {
    actions.loadNotifications().catch((e) => setErr(e.message || "알림을 불러오지 못했습니다."));
  }, [actions]);

  const unread = items.filter((n) => !n.read).length;
  const markAll = async () => {
    try {
      await actions.markAllNotificationsRead();
    } catch (e) {
      setErr(e.message);
    }
  };
  const markOne = async (id) => {
    const n = items.find((x) => x.id === id);
    if (!n || n.read) return;
    try {
      await actions.markNotificationRead(id);
    } catch (e) {
      setErr(e.message);
    }
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

      {!shown.length && (
        <Empty
          title="알림이 없습니다."
          hint="멘토 코멘트, 검증 결과 같은 소식이 생기면 이곳에서 알려드릴게요."
        />
      )}

      {shown.map((n) => (
        <div
          key={n.id}
          className={`notif-item${n.read ? " read" : ""}`}
          onClick={() => markOne(n.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); markOne(n.id); } }}
        >
          {!n.read && <span className="notif-unread" aria-label="읽지 않음" />}
          <span className="notif-ic">
            <NavIcon name={n.ic} size={20} color={n.read ? TDS.textTertiary : TDS.blue500} />
          </span>
          <div className="notif-body">
            <div className="notif-title">{n.t}</div>
            <div className="notif-desc">{n.d}</div>
          </div>
          <span className="notif-time">{n.time}</span>
        </div>
      ))}
    </div>
  );
}
