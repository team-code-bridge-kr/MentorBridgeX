/**
 * S24 — 멘토링 대화.
 *
 * 예전에는 이 화면이 **코멘트 목록**이었다. 「멘토링」이라 적혀 있는데 정작
 * 멘토에게 말을 걸 수는 없고, 그래프에 혼잣말을 남기는 자리였다. 코멘트는
 * 노드 판 안에 그대로 있으므로(거기가 제자리다) 이 화면은 이름이 말하는 일을
 * 한다 — 학생과 멘토가 주고받는다.
 *
 * **실시간 소켓을 두지 않는다.** 하루에 몇 번 오가는 대화라 몇 초에 한 번
 * 물어보는 것으로 충분하고, 소켓 하나에 연결 유지·재접속·인증 갱신이 딸려 온다.
 * 대신 **보낸 말은 기다리지 않고 바로 붙인다** — 서버를 왕복하는 사이 화면이
 * 비어 있으면 안 보내진 줄 안다.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import { Btn, Empty } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";
import { showNote } from "../../components/LoadingDock.jsx";
import { timeAgo } from "../../lib/activityMeta.js";
import api from "../../api/index.js";

/** 몇 초에 한 번 물어볼지. 보고 있는 대화는 자주, 목록은 뜸하게. */
const POLL_MS = 5000;

function fmtTime(at) {
  if (!at) return "";
  const d = new Date(at);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${m}`;
}

export function S24() {
  const { state } = useStore();
  const role = state.session?.user?.role || "student";
  const isMentor = role === "mentor";

  const [threads, setThreads] = useState([]);
  const [linkId, setLinkId] = useState(null);
  const [thread, setThread] = useState({ partner: null, messages: [] });
  const [draft, setDraft] = useState("");
  const [code, setCode] = useState("");
  const [invite, setInvite] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  const loadThreads = useCallback(async (pick) => {
    try {
      const d = await api.mentoring.threads();
      setThreads(d.threads);
      // 처음 들어오면 맨 위 대화를 연다. 목록만 덩그러니 두면 한 번 더 눌러야 한다.
      setLinkId((cur) => cur ?? pick ?? d.threads[0]?.linkId ?? null);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (id) => {
    if (!id) return;
    try {
      setThread(await api.mentoring.messages(id));
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  useEffect(() => { loadThreads(); }, [loadThreads]);
  useEffect(() => { loadMessages(linkId); }, [linkId, loadMessages]);

  // 몇 초에 한 번 다시 묻는다. 보고 있는 대화와 목록을 함께 — 목록의 안 읽은
  // 수가 안 줄면 배지가 계속 켜져 있다.
  useEffect(() => {
    const t = setInterval(() => {
      loadThreads();
      loadMessages(linkId);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [linkId, loadThreads, loadMessages]);

  // 새 말이 오면 맨 아래로. 읽던 자리를 지키는 것보다 마지막 말을 보는 쪽이 낫다.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [thread.messages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !linkId || sending) return;
    setSending(true);
    setDraft("");
    // 낙관적으로 먼저 붙인다 — 왕복하는 사이 화면이 비면 안 보내진 줄 안다.
    const temp = { id: `temp-${Date.now()}`, body, mine: true, read: false, at: new Date().toISOString() };
    setThread((t) => ({ ...t, messages: [...t.messages, temp] }));
    try {
      const saved = await api.mentoring.send(linkId, body);
      setThread((t) => ({
        ...t,
        messages: t.messages.map((m) => (m.id === temp.id ? saved : m)),
      }));
      loadThreads();
    } catch (e) {
      // 실패하면 되돌리고 쓰던 글을 칸에 돌려준다. 사라지면 다시 써야 한다.
      setThread((t) => ({ ...t, messages: t.messages.filter((m) => m.id !== temp.id) }));
      setDraft(body);
      setErr(e.message);
    } finally {
      setSending(false);
    }
  };

  const makeInvite = async () => {
    setErr("");
    try {
      const c = await api.mentoring.invite();
      setInvite(c);
    } catch (e) { setErr(e.message); }
  };

  const join = async () => {
    setErr("");
    try {
      const t = await api.mentoring.join(code);
      setCode("");
      showNote(`${t.partner.name} 님과 이어졌습니다.`);
      setLinkId(t.linkId);
      loadThreads(t.linkId);
    } catch (e) { setErr(e.message); }
  };

  /* ── 짝이 아직 없을 때 ─────────────────────────────────── */
  if (!loading && !threads.length) {
    return (
      <div className="content">
        <h1 className="rs-title">멘토링</h1>
        {err && <div className="form-err">{err}</div>}
        <div className="mt-empty">
          <Empty
            title={isMentor ? "아직 이어진 학생이 없습니다." : "아직 이어진 멘토가 없습니다."}
            hint={
              isMentor
                ? "초대 코드를 만들어 학생에게 알려주면 대화가 열립니다."
                : "멘토에게 받은 초대 코드를 넣으면 대화가 열립니다."
            }
          />
          {isMentor ? (
            <div className="mt-invite">
              {invite ? (
                <>
                  <div className="mt-code">{invite}</div>
                  <p className="mt-invite-hint">
                    이 코드를 학생에게 알려주세요. <b>한 학생만</b> 쓸 수 있습니다.
                  </p>
                </>
              ) : (
                <Btn v="primary" onClick={makeInvite}>초대 코드 만들기</Btn>
              )}
            </div>
          ) : (
            <div className="mt-join">
              <input
                className="inp"
                placeholder="초대 코드 6자리"
                value={code}
                maxLength={8}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && join()}
              />
              <Btn v="primary" onClick={join} disabled={code.trim().length < 4}>잇기</Btn>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── 대화 ─────────────────────────────────────────────── */
  return (
    <div className="mt-wrap">
      {/* 왼쪽 — 대화 목록. 상대가 하나뿐이어도 자리를 지킨다: 나중에 둘이
          되었을 때 화면이 통째로 바뀌면 어디를 보던 중이었는지 잃는다. */}
      <aside className="mt-side">
        <div className="mt-side-head">
          <span className="mt-side-title">멘토링</span>
          {isMentor && (
            <button type="button" className="mt-side-add" onClick={makeInvite} title="초대 코드">
              <NavIcon name="plusSeed" size={15} color="currentColor" />
            </button>
          )}
        </div>
        {invite && (
          <div className="mt-code sm">{invite}<span>학생에게 알려주세요</span></div>
        )}
        <ul className="mt-list">
          {threads.map((t) => (
            <li key={t.linkId}>
              <button
                type="button"
                className={`mt-item${t.linkId === linkId ? " is-on" : ""}`}
                onClick={() => setLinkId(t.linkId)}
              >
                <span className="mt-av">{t.partner.name.slice(0, 1)}</span>
                <span className="mt-item-body">
                  <span className="mt-item-top">
                    <b>{t.partner.name}</b>
                    {t.lastAt && <em>{timeAgo(t.lastAt)}</em>}
                  </span>
                  <span className="mt-item-last">{t.last || "아직 주고받은 말이 없습니다"}</span>
                </span>
                {t.unread > 0 && <span className="mt-unread">{t.unread}</span>}
              </button>
            </li>
          ))}
        </ul>
        {!isMentor && (
          <div className="mt-join sm">
            <input
              className="inp"
              placeholder="초대 코드"
              value={code}
              maxLength={8}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && join()}
            />
            <Btn v="secondary" s="sm" onClick={join} disabled={code.trim().length < 4}>잇기</Btn>
          </div>
        )}
      </aside>

      {/* 오른쪽 — 주고받은 말 */}
      <section className="mt-main">
        <header className="mt-head">
          <span className="mt-av lg">{(thread.partner?.name || "?").slice(0, 1)}</span>
          <span className="mt-head-name">
            <b>{thread.partner?.name || "대화"}</b>
            {thread.partner?.affiliation && <em>{thread.partner.affiliation}</em>}
          </span>
        </header>

        {err && <div className="form-err" style={{ margin: "0 20px" }}>{err}</div>}

        <div className="mt-log">
          {!thread.messages.length && (
            <p className="mt-log-empty">
              먼저 말을 걸어 보세요. 지금 하는 탐구를 한 줄로 적으면 이야기가 빨리 붙습니다.
            </p>
          )}
          {thread.messages.map((m) => (
            <div key={m.id} className={`mt-msg${m.mine ? " is-mine" : ""}`}>
              <div className="mt-bubble">{m.body}</div>
              <div className="mt-meta">
                {fmtTime(m.at)}
                {/* 읽음은 **내가 보낸 말에만** 붙인다. 상대 말 옆의 "읽음"은
                    내가 읽었다는 뜻이라 아무것도 알려 주지 않는다. */}
                {m.mine && m.read && <span className="mt-read">읽음</span>}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div className="mt-compose">
          <textarea
            className="mt-input"
            rows={1}
            placeholder="메시지를 입력하세요"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // 엔터로 보내고 Shift+Enter 로 줄을 바꾼다. 긴 글은 보고서가 있다.
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
          />
          <Btn v="primary" s="sm" onClick={send} disabled={!draft.trim() || sending}>
            보내기
          </Btn>
        </div>
      </section>
    </div>
  );
}
