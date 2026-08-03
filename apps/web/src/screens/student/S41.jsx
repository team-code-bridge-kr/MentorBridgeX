/**
 * S41 — 탐구 피드
 *
 * 저작권상 제목 + 요약 2~3문장 + 원문 링크까지만 보여준다. 전문은 저장하지도
 * 표시하지도 않는다. 카드를 누르면 원 매체로 새 탭 이동하고, 매체명과 발행일을
 * 항상 함께 표시한다.
 *
 * 페이지네이션은 백엔드의 keyset 커서를 그대로 이어받는다.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import api from "../../api/index.js";

const TABS = [
  { id: "all", label: "전체" },
  { id: "news", label: "뉴스" },
  { id: "paper", label: "논문" },
  { id: "saved", label: "저장함" },
];

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function S41({ onNav }) {
  const [tab, setTab] = useState("all");
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [checkedProfile, setCheckedProfile] = useState(false);
  const sentinel = useRef(null);

  // 온보딩 게이트 — 트랙을 아직 고르지 않았으면 S40 으로 보낸다
  useEffect(() => {
    api.research
      .profile()
      .then((p) => {
        if (!p.onboarded) onNav("S40");
        else setCheckedProfile(true);
      })
      .catch((e) => {
        setErr(e.message || "프로필을 불러오지 못했습니다.");
        setCheckedProfile(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(
    async (nextTab, nextCursor) => {
      setLoading(true);
      setErr("");
      try {
        const data = await api.research.feed({ tab: nextTab, cursor: nextCursor });
        setItems((prev) => (nextCursor ? [...prev, ...data.items] : data.items));
        setCursor(data.next_cursor);
        setDone(!data.next_cursor);
      } catch (e) {
        setErr(e.message || "피드를 불러오지 못했습니다.");
        setDone(true);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!checkedProfile) return;
    setItems([]);
    setCursor(null);
    setDone(false);
    load(tab, null);
  }, [tab, checkedProfile, load]);

  // 무한 스크롤 — 바닥 센티넬이 보이면 다음 페이지
  useEffect(() => {
    const node = sentinel.current;
    if (!node || done || loading) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && cursor) load(tab, cursor);
      },
      { rootMargin: "300px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [cursor, done, loading, tab, load]);

  const openArticle = (item) => {
    // 낙관적 표시 — 읽음 기록 실패가 링크 이동을 막을 이유는 없다
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
    api.research.markRead(item.id).catch(() => {});
  };

  const toggleSave = async (item) => {
    const next = !item.saved;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, saved: next } : i)));
    try {
      await api.research.setSaved(item.id, next);
      if (tab === "saved" && !next) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      }
    } catch {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, saved: !next } : i)));
    }
  };

  const emptyMessage =
    tab === "saved"
      ? "저장한 글이 없습니다.\n피드에서 마음에 드는 글의 ‘저장’을 눌러보세요."
      : "아직 보여드릴 글이 없습니다.\n키워드를 늘리거나 잠시 후 다시 확인해 주세요.";

  return (
    <div className="rs-wrap">
      <div className="rs-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`rs-tab${tab === t.id ? " on" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {err && <div className="rs-empty" style={{ color: "var(--danger)" }}>{err}</div>}

      <div className="rs-list">
        {items.map((item) => (
          <article key={item.id} className={`rs-article${item.read ? " read" : ""}`}>
            <div className="rs-article-meta">
              <span className={`badge badge-${item.kind === "paper" ? "blue" : "grey"}`}>
                {item.kind === "paper" ? "논문" : "뉴스"}
              </span>
              <span style={{ fontWeight: 600, color: "var(--ts)" }}>{item.outlet}</span>
              {item.published_at && <span>· {fmtDate(item.published_at)}</span>}
              {item.read && <span>· 읽음</span>}
            </div>

            <a
              className="rs-article-title"
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => openArticle(item)}
            >
              {item.title}
            </a>

            {item.summary && <p className="rs-article-sum">{item.summary}</p>}

            <div className="rs-article-foot">
              <div className="rs-chips">
                {item.matched_keywords.slice(0, 4).map((k) => (
                  <span key={k} className="rs-chip match">{k}</span>
                ))}
              </div>
              <button
                type="button"
                className={`rs-save${item.saved ? " on" : ""}`}
                onClick={() => toggleSave(item)}
              >
                {item.saved ? "저장됨" : "저장"}
              </button>
            </div>
          </article>
        ))}
      </div>

      {!loading && items.length === 0 && !err && (
        <div className="rs-empty" style={{ whiteSpace: "pre-line" }}>
          {emptyMessage}
          {tab !== "saved" && (
            <div style={{ marginTop: 14 }}>
              <button type="button" className="btn-inline" onClick={() => onNav("S42")}>
                키워드 관리로 이동
              </button>
            </div>
          )}
        </div>
      )}

      {loading && <div className="rs-empty">불러오는 중…</div>}
      {!done && <div ref={sentinel} style={{ height: 1 }} />}
      {done && items.length > 0 && (
        <div className="rs-empty" style={{ fontSize: 13 }}>마지막 글까지 봤습니다.</div>
      )}
    </div>
  );
}
