import { useState, useEffect } from "react";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Divider } from "../../components/ui.jsx";
import { BookViewer } from "../../components/doc/BookViewer.jsx";
import { PdfBookViewer } from "../../components/doc/PdfBookViewer.jsx";
import api from "../../api/index.js";

const AREA_META = [
  { type: "subject_specific", id: "세특", t: "세부능력 및 특기사항", d: "교사가 작성하는 교과 세부능력 및 특기사항" },
  { type: "autonomous", id: "자율", t: "자율활동", d: "학교 자율활동 기록 영역" },
  { type: "club", id: "동아리", t: "동아리활동", d: "동아리 활동 기록" },
  { type: "volunteer", id: "봉사", t: "봉사활동", d: "봉사활동 실적 및 특기사항" },
  { type: "career", id: "진로", t: "진로활동", d: "진로 활동 기록 및 특기사항" },
  { type: "behavior", id: "행특", t: "행동특성 및 종합의견", d: "담임교사의 행동특성 및 종합의견" },
  { type: "reading", id: "독서", t: "독서활동", d: "독서 활동 상황" },
  { type: "award", id: "수상", t: "수상경력", d: "수상 경력 기록" },
];

export function S11({ onNav }) {
  const [docs, setDocs] = useState([]);
  const [view, setView] = useState("book"); // book | list
  // 보관된 원본 PDF 가 있으면 그걸 그대로 보여준다 (없으면 추출 텍스트로)
  const [fileMeta, setFileMeta] = useState(null);
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      setDocs(await api.documents.list());
    } catch (e) {
      setErr(e.message);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    api.documentFile.meta().then(setFileMeta).catch(() => setFileMeta({ exists: false }));
  }, []);

  const byType = Object.fromEntries(
    AREA_META.map((m) => {
      const matches = docs.filter((d) => d.section_type === m.type);
      const latest = matches.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0];
      return [m.type, latest];
    })
  );

  const open = (meta) => {
    const doc = byType[meta.type];
    if (doc) {
      sessionStorage.setItem("mbx_doc_id", doc.id);
      sessionStorage.setItem("mbx_doc_type", meta.type);
      onNav("S12");
    } else {
      // create empty then edit
      setCreating(true);
      api.documents.create(meta.type, "(작성 시작)")
        .then((d) => {
          sessionStorage.setItem("mbx_doc_id", d.id);
          sessionStorage.setItem("mbx_doc_type", meta.type);
          onNav("S12");
        })
        .catch((e) => setErr(e.message))
        .finally(() => setCreating(false));
    }
  };

  const bType = { 완료: "green", 미작성: "grey", 입력중: "orange" };

  // 책 뷰에 넘길 영역 — 내용이 있는 것만 (빈 쪽을 넘기게 만들 이유가 없다)
  const bookAreas = AREA_META.map((m) => {
    const doc = byType[m.type];
    const content = doc?.content && doc.content !== "(작성 시작)" ? doc.content : "";
    return { type: m.type, title: m.t, desc: m.d, content };
  }).filter((a) => a.content);

  return (
    <div className="content">
      <div className="row-between mb24" style={{ marginBottom: 24 }}>
        <div className="sec-sub" style={{ marginBottom: 0 }}>8가지 생기부 영역을 관리하세요</div>
        <div className="row g-8" style={{ gap: 8 }}>
          <div className="tab-pill-wrap" style={{ marginRight: 4 }}>
            {[["book", "책으로 보기"], ["list", "목록"]].map(([id, label]) => (
              <div key={id} className={`tab-pill${view === id ? " active" : ""}`} onClick={() => setView(id)}>
                {label}
              </div>
            ))}
          </div>
          <Btn v="primary" s="sm" onClick={() => onNav("S13")}><TFI>📄</TFI> PDF 업로드</Btn>
          <Btn v="secondary" s="sm" disabled={creating} onClick={() => open(AREA_META[0])}>+ 직접 입력</Btn>
        </div>
      </div>
      {err && <div style={{ color: TDS.danger, marginBottom: 12 }}>{err}</div>}
      {view === "book" && fileMeta?.exists && (
        <>
          <div className="doc-src">
            <span>원본 <strong>{fileMeta.filename}</strong> · {fileMeta.page_count}쪽</span>
            <button
              type="button"
              className="rs-save"
              onClick={async () => {
                if (!window.confirm("보관된 생기부 원본을 지울까요? 추출된 텍스트는 남습니다.")) return;
                await api.documentFile.remove();
                setFileMeta({ exists: false });
              }}
            >
              원본 삭제
            </button>
          </div>
          <PdfBookViewer
            pageCount={fileMeta.page_count}
            onMissing={() => setFileMeta({ exists: false })}
          />
        </>
      )}

      {view === "book" && !fileMeta?.exists && (
        bookAreas.length
          ? <BookViewer areas={bookAreas} />
          : <div className="empty">
              <div className="empty-title">아직 기록이 없습니다.</div>
              <div className="empty-sub">PDF 를 올리거나 직접 입력하면 책처럼 넘겨볼 수 있습니다.</div>
              <Btn v="secondary" s="sm" onClick={() => onNav("S13")}>PDF 업로드</Btn>
            </div>
      )}

      <div className="grid3 g-16" style={{ gap: 16, display: view === "list" ? undefined : "none" }}>
        {AREA_META.map((a) => {
          const doc = byType[a.type];
          const chars = doc?.content ? doc.content.length : 0;
          const empty = !doc || !doc.content || doc.content === "(작성 시작)";
          const st = empty ? "미작성" : chars < 40 ? "입력중" : "완료";
          return (
            <div key={a.type} className="area-card" onClick={() => open(a)}>
              <div className="row-between mb8" style={{ marginBottom: 8 }}>
                <div className="area-card-title">{a.t}</div>
                <Badge t={bType[st]}>{st}</Badge>
              </div>
              <div className="area-card-desc">{a.d}</div>
              {/* 내용을 보여준다. 글자 수만 있으면 "뭐가 들어 있는지" 확인하려고
                  매번 편집 화면까지 들어가야 한다. */}
              {!empty && <p className="area-card-preview">{doc.content}</p>}
              <Divider my={12} />
              <div className="row-between">
                <span style={{ fontSize: 13, color: TDS.textTertiary }}>
                  {chars > 0 && !empty ? `${chars.toLocaleString()}자` : "아직 입력 없음"}
                </span>
                <Btn v="secondary" s="sm" onClick={(e) => { e.stopPropagation(); open(a); }}>편집</Btn>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { AREA_META };
