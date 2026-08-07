/**
 * S43 — 발견 (Discover)
 *
 * 이 서비스의 차별점. 학생이 읽은 글들에 반복해서 등장한 개념을 보여준다.
 * 자기도 몰랐던 관심사를 드러내는 게 목적이라, 이미 키워드로 등록한 것은
 * "추가" 버튼을 감추고 등록됨으로 표시한다.
 */

import { useEffect, useState } from "react";
import api from "../../api/index.js";
import { useLoading } from "../../components/LoadingDock.jsx";

export function S43({ onNav }) {
  const [terms, setTerms] = useState([]);
  const [readCount, setReadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    api.research
      .discover(20)
      .then((d) => {
        setTerms(d.terms);
        setReadCount(d.read_count);
      })
      .catch((e) => setErr(e.message || "불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  const addTerm = async (term) => {
    setBusy(term);
    try {
      await api.research.addKeyword(term);
      setTerms((prev) => prev.map((t) => (t.term === term ? { ...t, registered: true } : t)));
    } catch (e) {
      setErr(e.message || "추가하지 못했습니다.");
    } finally {
      setBusy("");
    }
  };

  // 화면을 비우고 문구는 알림에 맡긴다. 여기저기 다른 말로 적으면 같은
  // 기다림이 화면마다 달라 보인다.
  useLoading(loading, "읽은 글에서 개념을 뽑는 중이에요…");

  if (loading) return <div className="rs-wrap" />;

  if (!readCount) {
    return (
      <div className="rs-wrap">
        <div className="rs-empty" style={{ whiteSpace: "pre-line" }}>
          아직 읽은 글이 없습니다.{"\n"}
          피드에서 글을 몇 개 읽으면, 그 글들에 자주 나온 개념을 모아서 보여드립니다.
          <div style={{ marginTop: 16 }}>
            <button type="button" className="btn-inline" onClick={() => onNav("S41")}>
              피드로 가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rs-wrap">
      <p className="rs-lead">
        지금까지 읽은 <b style={{ color: "var(--tp)" }}>{readCount}개</b> 의 글에서 자주 나온
        개념입니다.<br />
        눈에 띄는 게 있으면 키워드로 추가해 보세요 — 다음 탐구 주제의 실마리가 됩니다.
      </p>

      {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 14 }}>{err}</div>}

      <div className="rs-list">
        {terms.map((t) => (
          <div key={t.term} className="rs-term">
            <span className="rs-term-count">{t.article_count}건</span>
            <span className="rs-term-name">{t.term}</span>
            {t.registered ? (
              <span className="badge badge-green" style={{ flexShrink: 0 }}>등록됨</span>
            ) : (
              <button
                type="button"
                className="rs-save"
                style={{ flexShrink: 0 }}
                onClick={() => addTerm(t.term)}
                disabled={busy === t.term}
              >
                {busy === t.term ? "추가 중…" : "＋ 추가"}
              </button>
            )}
          </div>
        ))}
      </div>

      {terms.length === 0 && (
        <div className="rs-empty" style={{ whiteSpace: "pre-line" }}>
          아직 반복해서 나타난 개념이 없습니다.{"\n"}
          글을 조금 더 읽으면 패턴이 드러납니다.
        </div>
      )}
    </div>
  );
}
