import { useState, useEffect } from "react";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Divider, Notice } from "../../components/ui.jsx";
import { BookViewer } from "../../components/doc/BookViewer.jsx";
import { PdfBookViewer } from "../../components/doc/PdfBookViewer.jsx";
import api from "../../api/index.js";
import { hasSubjectBlocks, subjectMarkers } from "../../lib/subjectBlocks.js";

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
  const [splitting, setSplitting] = useState(false);
  const [splitMsg, setSplitMsg] = useState("");

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

  // 세특은 다른 일곱 영역과 모양이 다르다. 한 영역이 아니라 **학년별 과목**이다.
  // 과목별로 갈라져 있으면 카드 하나에 밀어 넣지 않고 따로 펼친다.
  const subjectDocs = docs
    .filter((d) => d.section_type === "subject_specific" && d.subject_id)
    .sort((a, b) => a.subject_id.localeCompare(b.subject_id, "ko"));
  const splitSelf = subjectDocs.length >= 2;

  // 학년으로 묶는다. 같은 과목이 1학년과 3학년에 모두 있을 수 있어서(미술),
  // 학년이 없으면 어느 해 기록인지 알 수 없다.
  const gradeGroups = [];
  for (const d of subjectDocs) {
    const grade = d.period_id || "";
    let group = gradeGroups.find((g) => g.grade === grade);
    if (!group) gradeGroups.push((group = { grade, docs: [] }));
    group.docs.push(d);
  }
  gradeGroups.sort((a, b) => (a.grade || "￿").localeCompare(b.grade || "￿", "ko"));

  // 아직 한 덩어리로 남아 있는 세특. 나눌 수 있다는 걸 알려 준다.
  const lump = docs.find((d) => d.section_type === "subject_specific" && hasSubjectBlocks(d.content));
  const lumpCount = lump ? subjectMarkers(lump.content).length : 0;

  // 같은 과목이 같은 학년에 두 벌 있으면 생기부를 두 번 올린 것이다.
  const dupCount = subjectDocs.length
    - new Set(subjectDocs.map((d) => `${d.period_id || ""}/${d.subject_id}`)).size;
  // 학년을 아직 모르는 과목(원본 PDF 없이 나눈 것)도 정리 대상이다.
  const noGrade = subjectDocs.filter((d) => !d.period_id).length;

  const openDoc = (doc, type) => {
    sessionStorage.setItem("mbx_doc_id", doc.id);
    sessionStorage.setItem("mbx_doc_type", type || doc.section_type);
    sessionStorage.setItem("mbx_doc_subject", doc.subject_id || "");
    onNav("S12");
  };

  const splitSubjects = async () => {
    setSplitting(true);
    setErr("");
    try {
      const made = await api.documents.splitSubjects();
      await load();
      // 원본이 있으면 세특 말고 다른 영역(행동특성·자율활동 …)도 함께 다시 읽는다.
      setSplitMsg(
        `세부능력 및 특기사항을 학년·과목 ${made.length}개로 정리했습니다.` +
        (fileMeta?.exists ? " 다른 영역도 원본에서 다시 읽었습니다." : ""),
      );
    } catch (e) {
      setErr(e.message);
    } finally {
      setSplitting(false);
    }
  };

  const open = (meta) => {
    const doc = byType[meta.type];
    if (doc) {
      sessionStorage.setItem("mbx_doc_id", doc.id);
      sessionStorage.setItem("mbx_doc_type", meta.type);
      sessionStorage.setItem("mbx_doc_subject", doc.subject_id || "");
      onNav("S12");
    } else {
      // create empty then edit
      setCreating(true);
      api.documents.create(meta.type, "(작성 시작)")
        .then((d) => {
          sessionStorage.setItem("mbx_doc_id", d.id);
          sessionStorage.setItem("mbx_doc_type", meta.type);
          sessionStorage.setItem("mbx_doc_subject", "");
          onNav("S12");
        })
        .catch((e) => setErr(e.message))
        .finally(() => setCreating(false));
    }
  };

  const bType = { 완료: "green", 미작성: "grey", 입력중: "orange" };

  // 책 뷰에 넘길 영역 — 내용이 있는 것만 (빈 쪽을 넘기게 만들 이유가 없다)
  // 세특이 과목별로 갈라져 있으면 과목마다 한 쪽이다. 한 쪽에 46과목을 밀어
  // 넣으면 책이 아니라 두루마리가 된다.
  const bookAreas = AREA_META.flatMap((m) => {
    if (m.type === "subject_specific" && splitSelf) {
      return subjectDocs.map((d) => ({
        type: m.type,
        title: `${m.t} · ${d.subject_id}`,
        desc: d.subject_id,
        content: d.content && d.content !== "(작성 시작)" ? d.content : "",
      }));
    }
    const doc = byType[m.type];
    const content = doc?.content && doc.content !== "(작성 시작)" ? doc.content : "";
    return [{ type: m.type, title: m.t, desc: m.d, content }];
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

      {/* 세특이 아직 한 덩어리일 때. 46과목 21,000자를 편집 상자 하나에 담아 두면
          원하는 과목을 스크롤로 찾아야 하고, 노드가 어느 과목에서 나왔는지도
          말할 수 없다. 글자는 그대로 두고 과목 단위로만 가른다. */}
      {(lump || dupCount > 0) && (
        <Notice type="info" className="mb16">
          <div className="row-between" style={{ gap: 12, width: "100%" }}>
            <span>
              {lump
                ? <>세부능력 및 특기사항이 <strong>{lumpCount}과목</strong>({lump.content.length.toLocaleString()}자) 한 덩어리로 들어 있습니다. 학년·과목별로 나누면 하나씩 열어 볼 수 있습니다.</>
                : <>같은 과목이 <strong>{dupCount}개</strong> 겹쳐 있습니다. 생기부를 두 번 올린 것으로 보입니다.</>}
            </span>
            <Btn v="primary" s="sm" disabled={splitting} onClick={splitSubjects}>
              {splitting ? "정리하는 중…" : lump ? `과목 ${lumpCount}개로 나누기` : "세특 정리하기"}
            </Btn>
          </div>
        </Notice>
      )}
      {splitMsg && <div style={{ color: TDS.success, marginBottom: 12, fontSize: 13 }}>{splitMsg}</div>}
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

      {/* 과목별 세특 — 이 영역만 카드 하나가 아니라 과목마다 한 장이다. */}
      {view === "list" && splitSelf && (
        <>
          <div className="subj-head">
            <span className="subj-title">세부능력 및 특기사항</span>
            <span className="subj-count">{subjectDocs.length}과목</span>
            {/* 학년을 모르는 과목이 있으면 여기서 다시 정리한다. 원본을 나중에
                올린 경우가 이에 해당한다 — 학년은 원본에만 적혀 있다. */}
            {noGrade > 0 && (
              <button type="button" className="subj-fix" disabled={splitting} onClick={splitSubjects}>
                {splitting ? "정리하는 중…" : `학년 미상 ${noGrade}과목 정리`}
              </button>
            )}
          </div>
          {gradeGroups.map((g) => (
            <div key={g.grade || "unknown"}>
              <div className="subj-grade">
                <span className="subj-grade-name">{g.grade || "학년 미상"}</span>
                <span className="subj-grade-count">{g.docs.length}과목</span>
              </div>
              <div className="subj-grid">
                {g.docs.map((d) => (
                  <div key={d.id} className="subj-card" onClick={() => openDoc(d, "subject_specific")}>
                    <span className="subj-pill" title={d.subject_id}>{d.subject_id}</span>
                    <p className="subj-preview">{d.content}</p>
                    <span className="subj-meta">{d.content.length.toLocaleString()}자</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      <div className="grid3 g-16" style={{ gap: 16, display: view === "list" ? undefined : "none" }}>
        {AREA_META.filter((a) => !(a.type === "subject_specific" && splitSelf)).map((a) => {
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
