/**
 * S22 — 보고서 상세
 *
 * 예전 모습의 문제가 둘이었다.
 *
 * 1. **본문이 마크다운 그대로였다.** `# 세특 요약 보고서`, `## 컴퓨터 과학과…`
 *    가 기호째 뿌려져서, 학생이 보는 건 제목이 아니라 `#` 이라는 글자였다.
 *    자기 보고서인데 남의 코드처럼 보인다.
 * 2. **혼자 다른 옷을 입고 있었다.** 회색 제목 띠, 손으로 짠 머리 줄, 640px
 *    본문 — 탐구 피드·생기부와 나란히 놓으면 다른 앱 화면 같았다.
 *
 * 본문은 조각으로 갈라 요소로 그리고, 껍데기는 탭 띠로 통일한다.
 */

import { useState, useEffect, useMemo } from "react";
import { Back, Btn } from "../../components/ui.jsx";
import { FormTabs } from "../../components/forms/FormTabs.jsx";
import { Markdown } from "../../components/forms/Markdown.jsx";
import { toPlainText } from "../../lib/miniMarkdown.js";
import { showNote } from "../../components/LoadingDock.jsx";
import { useLoading } from "../../components/LoadingDock.jsx";
import api from "../../api/index.js";

// 만든 경로를 사람 말로. `upload`, `setuk` 같은 내부 이름을 그대로 보이면
// 무엇으로 만든 문서인지 알 수 없다.
const TEMPLATE_LABEL = {
  upload: "올린 양식을 채움",
  setuk: "세특 요약 보고서",
  club: "동아리 활동 보고서",
  career: "진로 포트폴리오",
  reading: "독서 감상문",
  service: "봉사활동 에세이",
};

/** 접기 전에 보여 줄 구획 수. 세특은 27구획까지 나와서 옆 판이 본문보다 길어진다. */
const SOURCE_PREVIEW = 10;

/**
 * 학년 순으로 세운다.
 *
 * 저장된 차례는 생기부를 마지막으로 고친 순서라, 3학년 한 과목이 1학년들
 * 앞에 오는 식으로 섞여 있다. 값이 맞아도 뒤죽박죽이면 또 지어낸 것처럼
 * 보인다. 학년이 없는 영역(자율활동·수상경력…)은 뒤로 보낸다.
 */
function byGrade(list) {
  const grade = (s) => Number(/^(\d)학년/.exec(s)?.[1] ?? 99);
  return [...list]
    .map((s, i) => [s, i])
    .sort((a, b) => grade(a[0]) - grade(b[0]) || a[1] - b[1])
    .map(([s]) => s);
}

export function S22({ onNav }) {
  const [editing, setEditing] = useState(false);
  const [doc, setDoc] = useState(null);
  const [content, setContent] = useState("");
  const [err, setErr] = useState("");
  const [expanded, setExpanded] = useState(false);
  const formId = sessionStorage.getItem("mbx_form_id");

  /**
   * 내보내기 — **복사**와 **내려받기** 둘뿐이다.
   *
   * 링크로 공유하는 길은 두지 않는다. 이 글은 생기부에 적힌 것으로 쓴 것이라
   * 주소만 알면 누구나 열리는 자리에 두면 미성년자의 기록이 그대로 새어 나간다.
   * 학생이 자기 손으로 붙여 넣거나 내려받아 건네는 것과, 우리가 공개 주소를
   * 만들어 주는 것은 다른 일이다.
   *
   * 둘 다 **화면에 보이는 대로** 나간다 — `##`, `**` 를 걷어 낸 평문이다.
   * 한글이나 구글 문서에 붙여 넣는 것이 이 글의 거의 유일한 쓸모라, 원문
   * 그대로 주면 제목이 `## 인공지능탐구반` 으로 붙는다.
   */
  const plain = () =>
    `${doc?.title || "보고서"}\n\n${toPlainText(content, { dropLeadingTitle: true })}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plain());
      showNote("보고서를 복사했습니다. 붙여 넣어 쓰세요.");
    } catch {
      // 클립보드를 막아 둔 브라우저가 있다. 그때는 내려받기로 안내한다.
      setErr("복사가 막혀 있습니다. 「내려받기」를 눌러 파일로 받아 주세요.");
    }
  };

  const download = () => {
    const blob = new Blob([plain()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // 파일 이름에 쓸 수 없는 글자만 걷는다. 제목은 학생이 알아볼 이름이다.
    a.download = `${(doc?.title || "보고서").replace(/[\\/:*?"<>|]/g, "")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!formId) return undefined;
    let cancelled = false;
    api.forms.get(formId)
      .then((d) => {
        if (cancelled) return;
        setDoc(d);
        setContent(d.content || "");
      })
      .catch((e) => { if (!cancelled) setErr(e.message); });
    return () => { cancelled = true; };
  }, [formId]);

  // 문구는 알림에 맡긴다. 화면마다 다른 말로 적으면 같은 기다림이 달라 보인다.
  useLoading(Boolean(formId) && !doc && !err, "보고서를 불러오는 중이에요…");

  const save = async () => {
    try {
      const d = await api.forms.patch(formId, { content });
      setDoc(d);
      setEditing(false);
    } catch (e) {
      setErr(e.message);
    }
  };

  if (!formId) {
    return (
      <div className="rs-wrap">
        <FormTabs active="S21" onNav={onNav} />
        <div className="empty">
          <div className="empty-title">열어 볼 보고서를 고르지 않았습니다</div>
          <Btn v="primary" onClick={() => onNav("S21")}>내 보고서 보기</Btn>
        </div>
      </div>
    );
  }

  const sources = useMemo(() => byGrade(doc?.used_nodes || []), [doc]);
  const shown = expanded ? sources : sources.slice(0, SOURCE_PREVIEW);

  return (
    <div className="rs-wrap">
      <FormTabs active="S21" onNav={onNav} />

      <div className="form-head">
        <Back onClick={() => onNav("S21")} label="목록" />
        <h1 className="form-title">{doc?.title || "보고서"}</h1>
        <div className="form-head-acts">
          {!editing && (
            <>
              <Btn v="secondary" s="sm" onClick={copy}>복사</Btn>
              <Btn v="secondary" s="sm" onClick={download}>내려받기</Btn>
            </>
          )}
          <Btn v="secondary" s="sm" onClick={() => (editing ? save() : setEditing(true))}>
            {editing ? "저장" : "편집"}
          </Btn>
        </div>
      </div>

      {err && <div className="form-err">{err}</div>}

      <div className="form-detail">
        <div className="card card-p form-body">
          {editing
            ? (
              <>
                {/* 편집은 원문 그대로다 — 보이는 대로 고치게 만들면 `##` 이
                    사라져 다음에 열 때 제목이 문단으로 내려앉는다. */}
                <div className="form-edit-hint">마크다운으로 적습니다. ## 은 소제목, - 는 글머리표입니다.</div>
                {/* `.inp` 은 height:40px 인 한 줄 입력이다. 여기에 textarea 를
                    걸어 두어서, 편집을 누르면 스무 줄짜리 보고서가 한 줄 칸에
                    갇혀 있었다. 여러 줄 입력은 `.textarea` 다. */}
                <textarea
                  className="textarea form-edit"
                  rows={20}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </>
              )
            : <Markdown text={content} dropLeadingTitle />}
        </div>

        {/* "어떻게 만들었나" 카드를 없앴다. 거기 적힌 두 줄(양식 이름·만든 날)은
            바로 위 제목과 목록에 이미 있는 말이라, 칸만 하나 더 차지하고 있었다.
            남길 만한 것은 만든 날 하나뿐이라 이 판 아래에 한 줄로 붙인다. */}
        <aside className="form-side">
          <div className="card card-p">
            <div className="form-side-t">무엇을 근거로 썼나</div>
            <div className="form-side-lead">
              이 보고서는 아래 생기부 {sources.length ? `${sources.length}구획` : "구획"}에 적힌
              내용만으로 썼습니다.
            </div>
            {sources.length
              ? (
                <>
                  <ul className="form-nodes">
                    {shown.map((n) => <li key={n}><span className="form-node-dot" />{n}</li>)}
                  </ul>
                  {sources.length > SOURCE_PREVIEW && (
                    <button type="button" className="form-side-more" onClick={() => setExpanded((v) => !v)}>
                      {expanded ? "접기" : `${sources.length - SOURCE_PREVIEW}개 더 보기`}
                    </button>
                  )}
                </>
                )
              : (
                <div className="form-side-empty">
                  근거를 찾지 못했습니다. 생기부를 올리면 그 내용으로 다시 쓸 수 있습니다.
                </div>
                )}
            <div className="form-side-foot">
              {TEMPLATE_LABEL[doc?.template_id] || doc?.template_id} · {(doc?.created_at || "").slice(0, 10)}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
