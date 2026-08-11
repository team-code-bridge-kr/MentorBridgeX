/**
 * S15 — 음성 세션 목록
 *
 * 활동 기록(S44)과 같은 옷을 입는다. 둘 다 "내가 남긴 것을 시간순으로 훑는"
 * 화면인데 하나는 흰 카드가 뚝뚝 떨어져 있고 하나는 유리 판 위에 묶여 있으면,
 * 같은 일을 두 가지 방식으로 하는 것처럼 보인다.
 *
 * 그래서 여기도 같은 것을 쓴다.
 *   - 날짜 묶음(오늘 · 어제 · 최근 7일 · 이전) — 목록이 길어지면 "언제쯤" 이
 *     있어야 찾는다
 *   - 줄 끝의 ⋯ — 이름 바꾸기와 **삭제**가 여기 들어간다
 *
 * 다만 **이 화면만 유리를 벗었다**(`.act-wrap.is-plain`). 배경을 흰색으로
 * 되돌리고, 목록을 가르는 것은 생기부 뷰어와 같은 밑줄 탭이다. 유리는 뒤에
 * 흐릴 빛이 있을 때만 유리이고, 흰 배경 위의 반투명 흰 판은 그냥 흰 판이다 —
 * 그래서 판도 평범한 흰 카드로 떨어뜨렸다(`.is-plain .act-glass`).
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
    <div className="content act-wrap is-plain">
      {/* 제목 「음성 세션」을 걷었다. 왼쪽 바에서 그 이름을 눌러 들어온 자리라
          화면이 제 이름을 한 번 더 말할 이유가 없었다 — 26px 짜리 글자가 한 줄을
          통째로 먹고 정작 목록은 아래로 밀려 있었다. 화면 낭독기를 위해서만
          남긴다. */}
      <h1 className="act-title sr-only">음성 세션</h1>

      {/* 생기부 뷰어(.rs-tabs)와 **같은 밑줄 탭**. 알약 거르개는 유리 배경
          위에서만 뜻이 있었는데 배경을 흰색으로 되돌리면서 근거가 사라졌고,
          같은 앱 안에서 목록을 가르는 방식이 화면마다 다를 이유도 없다.
          「새 녹음 시작」은 그 줄 오른쪽 끝에 선다. */}
      <div className="rs-tabs act-tabs" role="tablist" aria-label="녹음 상태">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`rs-tab${tab === t.id ? " on" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <Btn v="primary" s="sm" onClick={startNew}>
          <NavIcon name="voice" size={15} color="#fff" /> 새 녹음 시작
        </Btn>
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
