/**
 * S15 — 음성 세션 목록
 *
 * 활동 기록(S44)과 같은 옷을 입는다. 둘 다 "내가 남긴 것을 시간순으로 훑는"
 * 화면인데 하나는 흰 카드가 뚝뚝 떨어져 있고 하나는 유리 판 위에 묶여 있으면,
 * 같은 일을 두 가지 방식으로 하는 것처럼 보인다.
 *
 * 그래서 여기도 같은 것을 쓴다.
 *   - 유리 표면 한 벌(.act-glass) — 검색·거르개·목록이 같은 재질
 *   - 날짜 묶음(오늘 · 어제 · 최근 7일 · 이전) — 목록이 길어지면 "언제쯤" 이
 *     있어야 찾는다
 *   - 줄 끝의 ⋯ — 이름 바꾸기와 **삭제**가 여기 들어간다
 *
 * 삭제는 이번에 처음 생겼다. 잘못 눌러 만들어진 0초짜리 녹음이 목록에 그대로
 * 쌓이는데 치울 방법이 없었다 — 자기 기록인데.
 */

import { useState, useEffect, useMemo } from "react";
import { Btn, Empty } from "../../components/ui.jsx";
import api from "../../api/index.js";
import { useLoading, showNote } from "../../components/LoadingDock.jsx";
import { openVoiceDock } from "../../components/voice/VoiceDock.jsx";
import { RenameField } from "../../components/dashboard/RenameField.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";
import { notifyActivityChanged } from "../../hooks/useRecentActivity.js";
import { dateGroup, DATE_GROUP_ORDER, timeAgo } from "../../lib/activityMeta.js";
import { VoiceRow } from "../../components/voice/VoiceRow.jsx";

const TABS = [
  { id: "all", label: "전체" },
  { id: "todo", label: "검토 대기" },
  { id: "done", label: "완료" },
];

export function S15({ onNav }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  useLoading(loading, "녹음 목록을 불러오는 중이에요…");
  const [err, setErr] = useState("");
  const [renaming, setRenaming] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items = await api.voice.listSessions();
        if (!cancelled) setSessions(items);
      } catch (e) {
        if (!cancelled) setErr(e.message || "세션을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 녹음은 이 화면이 아니라 도크에서 한다. 녹음할 상황은 다른 일을 하는 도중에
  // 생기는데, 녹음 화면으로 옮겨 가야 하면 하던 일을 멈춰야 하기 때문이다.
  const startNew = () => openVoiceDock();

  const rename = async (id, title) => {
    setRenaming(null);
    setSessions((list) => list.map((s) => (s.id === id ? { ...s, t: title } : s)));
    try {
      await api.voice.patchSession(id, { title });
      notifyActivityChanged();  // 최근 활동에도 이 녹음이 이름으로 떠 있다
    } catch (e) {
      setErr(e.message || "이름을 바꾸지 못했습니다.");
    }
  };

  const remove = async (s) => {
    // 화면에서 먼저 치운다. 지우기를 누르고 한 박자 기다리면 안 지워진 줄 안다.
    setSessions((list) => list.filter((x) => x.id !== s.id));
    try {
      await api.voice.removeSession(s.id);
      notifyActivityChanged();
      showNote(`‘${s.t}’ 을(를) 지웠습니다.`);
    } catch (e) {
      // 실패하면 되돌린다 — 화면에서만 사라지고 서버에 남으면 다음에 다시 뜬다.
      setSessions((list) => [...list, s].sort((a, b) => (a.date < b.date ? 1 : -1)));
      setErr(e.message || "지우지 못했습니다.");
    }
  };

  const open = (s) => {
    sessionStorage.setItem("mbx_voice_session", s.id);
    onNav("S17");
  };

  const shown = useMemo(() => {
    if (tab === "todo") return sessions.filter((s) => s.st !== "완료");
    if (tab === "done") return sessions.filter((s) => s.st === "완료");
    return sessions;
  }, [sessions, tab]);

  /** 날짜 묶음. 목록이 길어지면 "언제쯤" 이 있어야 찾는다. */
  const groups = useMemo(() => {
    const by = new Map();
    for (const s of shown) {
      const when = s.raw?.created_at || s.raw?.updated_at;
      const key = when ? dateGroup(when) : "이전 활동";
      if (!by.has(key)) by.set(key, []);
      by.get(key).push(s);
    }
    return DATE_GROUP_ORDER.filter((k) => by.has(k)).map((k) => [k, by.get(k)]);
  }, [shown]);

  return (
    <div className="content act-wrap">
      <div className="act-head">
        <h1 className="act-title">음성 세션</h1>
        <Btn v="primary" s="sm" onClick={startNew}>
          <NavIcon name="voice" size={15} color="#fff" /> 새 녹음 시작
        </Btn>
      </div>

      {/* 거르개도 활동 기록과 같은 알약. 같은 조작이 화면마다 다르게 생기면
          그것이 같은 것인 줄 모른다. */}
      <div className="act-filters" role="group" aria-label="녹음 상태 거르개">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tab === t.id}
            className={`act-filter act-glass${tab === t.id ? " is-on" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {err && <div className="form-err">{err}</div>}

      {!loading && !shown.length && (
        <Empty
          title={
            sessions.length
              ? tab === "done" ? "검토를 마친 녹음이 없습니다." : "검토할 녹음이 없습니다."
              : "아직 녹음이 없습니다."
          }
          hint="멘토링이나 발표를 녹음하면 글로 옮겨 탐구 기록에 쓸 수 있습니다."
          cta={sessions.length ? undefined : "새 녹음 시작"}
          onCta={startNew}
        />
      )}

      {groups.map(([label, items]) => (
        <section key={label} className="act-group">
          <h2 className="act-group-title">{label}</h2>
          <ul className="ra-list act-list act-glass">
            {items.map((s) =>
              renaming === s.id ? (
                <li key={s.id} className="ra-row is-editing">
                  <RenameField
                    value={s.t}
                    label="녹음 이름"
                    onSave={(title) => rename(s.id, title)}
                    onCancel={() => setRenaming(null)}
                  />
                </li>
              ) : (
                <VoiceRow
                  key={s.id}
                  session={s}
                  when={timeAgo(s.raw?.created_at || s.raw?.updated_at)}
                  onOpen={() => open(s)}
                  onRename={() => setRenaming(s.id)}
                  onDelete={() => remove(s)}
                />
              ),
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}
