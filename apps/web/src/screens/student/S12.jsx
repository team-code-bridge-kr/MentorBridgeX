import { useState, useEffect } from "react";
import TDS from "../../theme/tokens.js";
import { Back, Btn, Notice } from "../../components/ui.jsx";
import api from "../../api/index.js";
import { subjectMarkers } from "../../lib/subjectBlocks.js";
import { AREA_META } from "./S11.jsx";

/**
 * 이 글에서 나온 노드만 고른다.
 *
 * 예전에는 그래프의 **앞 여덟 개**를 그냥 잘라 왔다(`nodes.slice(0, 8)`).
 * 자율활동을 열어도 "국어"·"무리함수의 역함수와 넓이" 가 「연결된 노드」로
 * 떴다 — 이어져 있지 않은데 이어졌다고 적은 셈이다.
 *
 * 노드는 자기가 어느 구획에서 나왔는지 갖고 있다(external_refs.section →
 * api/index.js 의 sectionOf). 세특이면 그 값이 과목 이름이고, 나머지 일곱
 * 영역이면 영역 이름이다. 이름이 딱 맞지 않는 경우가 있어(구획은
 * "독서활동상황", 화면은 "독서활동") 한쪽이 다른 쪽을 품으면 같은 것으로 본다.
 */
function linkedTo(nodes, doc) {
  const meta = AREA_META.find((m) => m.type === doc?.section_type);
  const key = (doc?.subject_id || meta?.t || "").trim();
  if (!key) return [];
  return (nodes || [])
    .filter((n) => {
      const sec = (n.section || "").trim();
      return sec && sec !== "기타" && (sec === key || sec.includes(key) || key.includes(sec));
    })
    .map((n) => n.label);
}

export function S12({ onNav }) {
  const docId = sessionStorage.getItem("mbx_doc_id");
  const docType = sessionStorage.getItem("mbx_doc_type");
  const meta = AREA_META.find((m) => m.type === docType) || AREA_META[0];
  const [subject, setSubject] = useState(sessionStorage.getItem("mbx_doc_subject") || "");
  const [splitting, setSplitting] = useState(false);
  const [txt, setTxt] = useState("");
  const [linked, setLinked] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!docId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const docs = await api.documents.list();
        const doc = docs.find((d) => d.id === docId);
        if (!cancelled && doc) {
          setTxt(doc.content === "(작성 시작)" ? "" : doc.content);
          setUpdatedAt(doc.updated_at || "");
          setSubject(doc.subject_id || "");
        }
        const g = await api.graph.fetch();
        if (!cancelled) setLinked(linkedTo(g.nodes, doc));
      } catch (e) {
        if (!cancelled) setErr(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [docId]);

  const save = async () => {
    if (!docId || !txt.trim()) { setErr("내용을 입력하세요."); return; }
    setSaving(true);
    setErr("");
    try {
      const d = await api.documents.patch(docId, txt.trim());
      setUpdatedAt(d.updated_at || "");
      setMsg("저장되었습니다.");
      // light sync: seed a few tokens from text into graph
      const seeds = txt.match(/[가-힣A-Za-z0-9]{2,}/g)?.slice(0, 5) || [];
      if (seeds.length) {
        try { await api.graph.generateFromSeeds(seeds); } catch { /* optional */ }
        const g = await api.graph.fetch();
        setLinked(linkedTo(g.nodes, d));
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const removeDoc = async () => {
    setDeleting(true);
    setErr("");
    try {
      await api.documents.remove(docId);
      sessionStorage.removeItem("mbx_doc_id");
      onNav("S11");
    } catch (e) {
      setErr(e.message);
      setDeleting(false);
    }
  };

  // 지금 열린 글에 `[과목]` 표시가 남아 있는지. 세특일 때만 뜻이 있다.
  const markers = docType === "subject_specific" ? subjectMarkers(txt) : [];

  if (!docId) {
    return (
      <div className="content">
        <Btn v="primary" onClick={() => onNav("S11")}>영역 목록으로</Btn>
      </div>
    );
  }

  return (
    <div className="rs-wrap">
        <div className="form-head">
          <Back label="생기부" onClick={() => onNav("S11")} />
          <div className="doc-head-name">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 className="form-title">{meta.t}</h1>
              {/* 과목이 있으면 그게 이 문서의 이름이다 — 영역명보다 먼저 눈에 띄어야 한다. */}
              {subject && <span className="subj-pill">{subject}</span>}
            </div>
            <div style={{ fontSize: 12, color: TDS.textTertiary }}>
              {updatedAt ? `마지막 저장: ${String(updatedAt).slice(0, 19).replace("T", " ")}` : "새 문서"}
            </div>
          </div>
          {/* 지우기는 오른쪽 끝. 저장 단추 옆에 두면 손이 잘못 간다. */}
          <button
            type="button"
            className="doc-del"
            style={{ marginLeft: "auto" }}
            onClick={() => setConfirmDel(true)}
          >
            이 영역 지우기
          </button>
        </div>

        {confirmDel && (
          <Notice type="danger" className="mb16">
            <div className="row-between" style={{ gap: 12, width: "100%" }}>
              <span>
                <strong>{subject || meta.t}</strong> {txt.length.toLocaleString()}자를 지웁니다.
                되돌릴 수 없습니다. 그래프의 노드는 남습니다.
              </span>
              <div className="row g-8" style={{ gap: 8 }}>
                <Btn v="secondary" s="sm" onClick={() => setConfirmDel(false)}>취소</Btn>
                <button type="button" className="subj-confirm-yes" disabled={deleting} onClick={removeDoc}>
                  {deleting ? "지우는 중…" : "지우기"}
                </button>
              </div>
            </div>
          </Notice>
        )}

        {/* 세특이 아직 한 덩어리면 여기서도 나눌 수 있다. 목록으로 되돌아가
            같은 버튼을 다시 찾게 만들 이유가 없다. */}
        {markers.length >= 2 && (
          <Notice type="info" className="mb16">
            <div className="row-between" style={{ gap: 12, width: "100%" }}>
              <span>
                이 글은 <strong>{markers.length}과목</strong>이 한 덩어리로 들어 있습니다.
                과목별로 나누면 하나씩 열어 볼 수 있습니다.
              </span>
              <Btn
                v="primary"
                s="sm"
                disabled={splitting}
                onClick={async () => {
                  setSplitting(true);
                  setErr("");
                  try {
                    const made = await api.documents.splitSubjects();
                    setMsg(`과목 ${made.length}개로 나눴습니다. 목록에서 과목을 골라 편집하세요.`);
                    onNav("S11");
                  } catch (e) {
                    setErr(e.message);
                  } finally {
                    setSplitting(false);
                  }
                }}
              >
                {splitting ? "나누는 중…" : `과목 ${markers.length}개로 나누기`}
              </Btn>
            </div>
          </Notice>
        )}

        {err && <div className="form-err">{err}</div>}
        {msg && <div className="form-ok">{msg}</div>}

        {/* 보고서 상세(S22)와 같은 뼈대 — 본문 한 판, 옆에 좁은 곁판.
            두 화면 다 "긴 글 하나 + 그 글의 근거" 라서 같은 모양이어야 한다. */}
        <div className="form-detail">
          <div className="card card-p form-body">
            <div className="form-edit-hint">
              저장하면 본문에서 뽑은 말이 그래프에 시드로 더해집니다.
            </div>
            <textarea
              className="textarea form-edit"
              value={txt}
              onChange={(e) => setTxt(e.target.value)}
              placeholder="영역 내용을 입력하세요"
            />
            <div className="row-between" style={{ marginTop: 14 }}>
              <span style={{ fontSize: 13, color: TDS.textTertiary }}>{txt.length.toLocaleString()}자</span>
              <div className="row g-8" style={{ gap: 8 }}>
                <Btn v="secondary" s="sm" onClick={() => setTxt("")}>초기화</Btn>
                <Btn v="primary" s="sm" disabled={saving} onClick={save}>
                  {saving ? "저장 중…" : "저장 및 그래프 동기화"}
                </Btn>
              </div>
            </div>
          </div>

          <aside className="form-side">
            <div className="card card-p">
              <div className="form-side-t">이어진 노드</div>
              <div className="form-side-lead">
                이 글에서 나와 지식 그래프에 놓인 것들입니다.
              </div>
              {linked.length ? (
                <ul className="form-nodes">
                  {linked.map((n) => <li key={n}><span className="form-node-dot" />{n}</li>)}
                </ul>
              ) : (
                <div className="form-side-empty">
                  아직 없습니다. 저장하면 본문에서 뽑은 말이 그래프에 놓입니다.
                </div>
              )}
            </div>
          </aside>
        </div>
    </div>
  );
}
