/**
 * S15 — 음성 세션 목록
 *
 * 여기도 혼자 옛 옷을 입고 있었다. 회색 제목 띠, 한 줄에 다 밀어 넣은
 * 안내문과 단추, 그리고 목록은 카드 안에 실선으로 갈린 표. 탐구 피드·보고서
 * 옆에 놓으면 다른 앱 화면 같았다.
 *
 * 같은 밑줄 탭, 같은 목록 카드로 맞춘다. 탭은 꾸밈이 아니라 실제 상태다 —
 * 녹음은 "검토 대기"로 쌓이고, 검토를 마치면 "완료"로 내려간다. 열 개가
 * 넘어가면 아직 손대야 할 것이 어느 것인지 목록에서 사라진다.
 */

import { useState, useEffect, useMemo } from "react";
import TDS from "../../theme/tokens.js";
import { Btn, Badge, Empty } from "../../components/ui.jsx";
import api from "../../api/index.js";
import { useLoading } from "../../components/LoadingDock.jsx";
import { openVoiceDock } from "../../components/voice/VoiceDock.jsx";
import { RenameField } from "../../components/dashboard/RenameField.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";
import { notifyActivityChanged } from "../../hooks/useRecentActivity.js";

const TABS = [
  { id: "all", label: "전체" },
  { id: "todo", label: "검토 대기" },
  { id: "done", label: "완료" },
];

const stType = { 완료: "green", "검토 대기": "orange", "녹음 중": "blue" };

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
  // 이 화면은 지난 녹음을 모아 보는 자리로 남는다.
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

  const open = (s) => {
    sessionStorage.setItem("mbx_voice_session", s.id);
    onNav("S17");
  };

  const shown = useMemo(() => {
    if (tab === "todo") return sessions.filter((s) => s.st !== "완료");
    if (tab === "done") return sessions.filter((s) => s.st === "완료");
    return sessions;
  }, [sessions, tab]);

  return (
    <div className="rs-wrap">
      <div className="rs-head">
        <div className="rs-tabs" role="tablist" aria-label="녹음 상태">
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
        </div>
        <Btn v="primary" s="sm" onClick={startNew}>
          <NavIcon name="voice" size={15} color="#fff" /> 새 녹음 시작
        </Btn>
      </div>

      {/* (≤5MB) 를 뺐다. 여기서 올릴 파일이 없으니 학생이 지킬 것도 없다 —
          한계는 도크가 스스로 지키고, 걸리면 그때 말한다. */}
      <p className="sec-sub voice-lead">
        오른쪽 아래 마이크 단추로 어느 화면에서든 녹음할 수 있습니다.
        소리는 저장하지 않고 옮겨 적은 글만 남습니다.
      </p>

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

      <div className="rs-list">
        {shown.map((s) => (
          <div key={s.id} className="rs-article form-row voice-row">
            <span className={`form-row-ic${s.st === "검토 대기" ? " is-todo" : ""}`}>
              <NavIcon
                name="voice" size={18}
                color={s.st === "검토 대기" ? TDS.warning : TDS.primary}
              />
            </span>
            <span className="form-row-body">
              {/* 이름은 그 자리에서 고친다. 서버가 붙인 "녹음 26. 8. 5. …" 로는
                  나중에 어느 것이 무엇이었는지 찾을 수 없다. */}
              {renaming === s.id ? (
                <RenameField
                  value={s.t}
                  label="녹음 이름"
                  onSave={(title) => rename(s.id, title)}
                  onCancel={() => setRenaming(null)}
                />
              ) : (
                <button
                  type="button"
                  className="sess-name"
                  title="이름 바꾸기"
                  onClick={() => setRenaming(s.id)}
                >
                  <span className="sess-name-t">{s.t}</span>
                  <NavIcon name="pen" size={13} color={TDS.textTertiary} />
                </button>
              )}
              <span className="rs-article-meta">
                {s.date}<span aria-hidden>·</span>{s.dur}<span aria-hidden>·</span>참여자 {s.ppl}명
              </span>
            </span>
            <Badge t={stType[s.st] || "grey"}>{s.st}</Badge>
            {/* 예전에는 완료된 녹음에 단추가 아예 없어서, 옮겨 적은 글을
                **다시 볼 길이 없었다.** 상태와 상관없이 열리게 둔다. */}
            <Btn v={s.st === "검토 대기" ? "primary" : "secondary"} s="sm" onClick={() => open(s)}>
              {s.st === "검토 대기" ? "검토하기" : "열기"}
            </Btn>
          </div>
        ))}
      </div>
    </div>
  );
}
