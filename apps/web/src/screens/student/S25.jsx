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
    <div className="rs-wrap">
      {/* 탭이 개수를 이고 있으므로 위에 "읽지 않은 알림 N개" 를 따로 쓸
          필요가 없다. 알약 탭도 밑줄 탭으로 바꿔 다른 화면과 맞춘다. */}
      {/* 사이드바 아래 유틸에서 오는 화면이라 메뉴에 불이 들어오지 않는다.
          제목이 없으면 여기가 어디인지 알 길이 없다. */}
      <h1 className="rs-title">알림</h1>
      <div className="rs-head">
        <div className="rs-tabs" role="tablist" aria-label="알림">
          {[["전체", items.length], ["안 읽음", unread], ["읽음", items.length - unread]].map(([t, c]) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`rs-tab${tab === t ? " on" : ""}`}
              onClick={() => setTab(t)}
            >
              {t} {c}
            </button>
          ))}
        </div>
        <Btn v="secondary" s="sm" onClick={markAll} disabled={!unread}>모두 읽음 처리</Btn>
      </div>
      {err && <div className="form-err">{err}</div>}

      {!shown.length && (
        <Empty
          title="알림이 없습니다."
          hint="멘토 코멘트, 검증 결과 같은 소식이 생기면 이곳에서 알려드릴게요."
        />
      )}

      <div className="rs-list">
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
    </div>
  );
}
