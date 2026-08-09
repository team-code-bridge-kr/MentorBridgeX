/**
 * S17 — 녹음 검토
 *
 * 옮겨 적은 글을 학생이 한 번 읽고 고치는 자리. 여기서 "완료"를 눌러야
 * 목록에서 검토 대기가 내려간다.
 *
 * 옛 모습의 문제:
 * 1. 회색 제목 띠가 "보고서 검토" 라고 적혀 있었다. 이건 보고서가 아니라
 *    **녹음**이다 — 화면 이름부터 다른 물건을 가리키고 있었다.
 * 2. 편집 상자가 `.inp`(height:40px, 한 줄 입력)여서, 여덟 줄짜리 전사를
 *    한 줄 칸에서 고쳐야 했다. 보고서 화면과 똑같은 자리에서 났던 잘못이다.
 * 3. "완료"가 늘 파랗게 켜져 있었다. 옮긴 글이 없어도 누를 수 있어서,
 *    빈 녹음이 검토를 마친 것으로 목록에서 내려갔다.
 */

import { useState, useEffect } from "react";
import { Back, Btn } from "../../components/ui.jsx";
import { useLoading } from "../../components/LoadingDock.jsx";
import { notifyActivityChanged } from "../../hooks/useRecentActivity.js";
import api from "../../api/index.js";

export function S17({ onNav }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [keywords, setKeywords] = useState([]);
  const [title, setTitle] = useState("");
  const [meta, setMeta] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const sessionId = sessionStorage.getItem("mbx_voice_session");

  useEffect(() => {
    if (!sessionId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const s = await api.voice.getSession(sessionId);
        if (cancelled) return;
        setText(s.transcript || "");
        setKeywords(s.keywords || []);
        setTitle(s.t);
        setMeta({ date: s.date, dur: s.dur, ppl: s.ppl, st: s.st });
      } catch (e) {
        if (!cancelled) setErr(e.message);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  useLoading(Boolean(sessionId) && !loaded, "녹음을 불러오는 중이에요…");

  const save = async ({ done = false } = {}) => {
    if (!sessionId) return false;
    try {
      await api.voice.patchSession(sessionId, {
        transcript: text,
        keywords,
        ...(done ? { status: "완료" } : {}),
      });
      setEditing(false);
      notifyActivityChanged();
      return true;
    } catch (e) {
      setErr(e.message);
      return false;
    }
  };

  if (!sessionId) {
    return (
      <div className="rs-wrap">
        <div className="empty">
          <div className="empty-title">열어 볼 녹음을 고르지 않았습니다</div>
          <Btn v="primary" onClick={() => onNav("S15")}>음성 세션 보기</Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="rs-wrap">
      <div className="form-head">
        <Back onClick={() => onNav("S15")} label="목록" />
        <h1 className="form-title">{title || "녹음"}</h1>
        <Btn v="secondary" s="sm" onClick={() => (editing ? save() : setEditing(true))}>
          {editing ? "저장" : "편집"}
        </Btn>
      </div>

      {err && <div className="form-err">{err}</div>}

      <div className="form-detail">
        <div className="card card-p form-body">
          {editing
            ? (
              <>
                <div className="form-edit-hint">
                  잘못 들은 낱말만 고치면 됩니다. 없던 말을 새로 적지는 마세요.
                </div>
                {/* `.inp` 은 한 줄 입력이다. 여러 줄은 `.textarea`. */}
                <textarea
                  className="textarea form-edit"
                  rows={16}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </>
              )
            : text
              ? <p className="md-p" style={{ whiteSpace: "pre-wrap" }}>{text}</p>
              : (
                <div className="form-side-empty">
                  옮겨 적은 글이 없습니다. 말소리를 알아듣지 못했거나 녹음이 너무 짧았습니다.
                </div>
                )}
        </div>

        <aside className="form-side">
          <div className="card card-p">
            <div className="form-side-t">키워드 {keywords.length}개</div>
            {keywords.length
              ? (
                <div className="vdock-kws" style={{ marginTop: 8 }}>
                  {keywords.map((k) => <span key={k} className="vdock-kw">{k}</span>)}
                </div>
                )
              : <div className="form-side-empty">옮겨 적은 글에서 뽑을 낱말을 찾지 못했습니다.</div>}
            {meta && (
              <div className="form-side-foot">
                {meta.date} · {meta.dur} · 참여자 {meta.ppl}명
              </div>
            )}
          </div>

          {/* 두 단추는 나란히 두지 않는다 — "나중에 확인"과 "완료"는 되돌릴 수
              있는 정도가 달라서, 같은 크기로 붙여 두면 잘못 누르기 쉽다. */}
          <div className="card card-p review-act">
            <Btn
              v="primary" s="md" fw
              disabled={!text.trim()}
              title={text.trim() ? undefined : "옮겨 적은 글이 없어 검토를 마칠 수 없습니다"}
              onClick={async () => { if (await save({ done: true })) onNav("S15"); }}
            >
              검토 마치기
            </Btn>
            <button type="button" className="review-later" onClick={() => onNav("S15")}>
              나중에 하기
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
