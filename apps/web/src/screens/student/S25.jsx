/**
 * S25 — 알림
 *
 * 활동 기록(S44)·음성 세션(S15)과 같은 옷을 입는다. 셋 다 "내게 쌓인 것을
 * 시간순으로 훑는" 화면인데, 여기만 큼직한 파란 카드가 뚝뚝 떨어져 있어서
 * 다른 앱처럼 보였다. 같은 유리 표면(.act-glass) 한 벌, 같은 알약 거르개,
 * 같은 날짜 묶음을 쓴다.
 *
 * 사이드바 아래 유틸에서 오는 화면이라 상단 바를 쓰지 않는다(NO_HDR) —
 * 화면이 제 제목을 갖는다.
 */

import { useState, useEffect, useMemo } from "react";
import TDS from "../../theme/tokens.js";
import { Btn, Empty } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";
import { useStore } from "../../store/StoreProvider.jsx";
import { dateGroup, DATE_GROUP_ORDER, timeAgo } from "../../lib/activityMeta.js";

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

  /** 날짜 묶음. 목록이 길어지면 "언제쯤" 이 있어야 찾는다. */
  const groups = useMemo(() => {
    const by = new Map();
    for (const n of shown) {
      const key = n.at ? dateGroup(n.at) : "이전 활동";
      if (!by.has(key)) by.set(key, []);
      by.get(key).push(n);
    }
    return DATE_GROUP_ORDER.filter((k) => by.has(k)).map((k) => [k, by.get(k)]);
  }, [shown]);

  const TABS = [["전체", items.length], ["안 읽음", unread], ["읽음", items.length - unread]];

  return (
    <div className="content act-wrap">
      <div className="act-page">
        <header className="act-head">
          <h1 className="act-title">알림</h1>
          <Btn v="secondary" s="sm" onClick={markAll} disabled={!unread}>모두 읽음 처리</Btn>
        </header>

        {/* 거르개는 밑줄 탭이 아니라 알약이다 — 같은 조작이 화면마다 다르게
            생기면 그것이 같은 것인 줄 모른다. 개수는 알약이 이고 있다. */}
        <div className="act-filters" role="group" aria-label="알림 거르개">
          {TABS.map(([t, c]) => (
            <button
              key={t}
              type="button"
              aria-pressed={tab === t}
              className={`act-filter act-glass${tab === t ? " is-on" : ""}`}
              onClick={() => setTab(t)}
            >
              {t} {c}
            </button>
          ))}
        </div>

        {err && <div className="form-err">{err}</div>}

        {!shown.length && (
          <Empty
            title={
              items.length
                ? tab === "읽음" ? "읽은 알림이 없습니다." : "읽지 않은 알림이 없습니다."
                : "알림이 없습니다."
            }
            hint="멘토 코멘트, 검증 결과 같은 소식이 생기면 이곳에서 알려드릴게요."
          />
        )}

        {groups.map(([label, list]) => (
          <section key={label} className="act-group">
            <h2 className="act-group-title">{label}</h2>
            <ul className="ra-list act-list act-glass">
              {list.map((n) => (
                <li key={n.id} className={`ra-row${n.read ? " is-read" : ""}`}>
                  {/* 읽은 알림은 누를 것이 없다. 여기서 할 수 있는 일은 "읽음으로
                      바꾸기" 하나뿐이라, 이미 읽은 줄에 손이 닿는 느낌을 주면
                      뭔가 더 있는 줄 안다. */}
                  <button
                    type="button"
                    className="ra-item"
                    disabled={n.read}
                    onClick={() => markOne(n.id)}
                    title={`${n.t}\n${n.d}`}
                  >
                    <span className="ra-ic">
                      <NavIcon name={n.ic} size={17} color={n.read ? TDS.textTertiary : TDS.primary} />
                    </span>
                    <span className="ra-body">
                      <span className="ra-line">
                        <span className="ra-title">{n.t}</span>
                        <span className="ra-time">{n.at ? timeAgo(n.at) : n.time}</span>
                      </span>
                      <span className="ra-sub">
                        {!n.read && <span className="ra-badge is-new">안 읽음</span>}
                        <span className="ra-sub-text">{n.d}</span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
