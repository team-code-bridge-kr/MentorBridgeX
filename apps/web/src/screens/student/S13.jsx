/**
 * S13 — 생기부 PDF 업로드.
 *
 * 파일을 고르면 **올리기 전에 브라우저에서 먼저 열어** 구획을 보여준다.
 * 이 미리보기는 전부 클라이언트에서 돌아 이 단계에서는 파일이 서버로 나가지 않는다.
 *
 * 업로드하면 원본 PDF 도 함께 보관된다(학생당 최신본 한 개). 파싱 결과가 아니라
 * 실제로 받은 문서를 다시 볼 수 있어야 한다는 요구다. 민감 정보라 본인만 열람
 * 가능하고 삭제 경로도 함께 제공한다 — 자세한 규칙은 routers/documents.py 참고.
 *
 * 화면은 알림·활동 기록·설정과 같은 유리 표면(.act-glass)을 쓴다.
 *
 * 화면의 설명문을 모두 걷었다(요청). 보관 정책은 온보딩의 「생기부를 미리
 * 올려 볼까요?」 단계에 그대로 있다 — 본인만 열람 · 최신본 한 개 · 인적사항
 * 가림. **그 화면을 건너뛰고 여기로 바로 온 사람은 그 약속을 못 본다**는 점만
 * 기억해 둘 것. 보관 방식을 바꾸면 온보딩 쪽 문구를 반드시 함께 고쳐야 한다.
 */

import { useState } from "react";
import { Back, Btn } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";
import { PdfRegionViewer } from "../../components/pdf/PdfRegionViewer.jsx";
import api from "../../api/index.js";
import { showLoading } from "../../components/LoadingDock.jsx";

const MAX_MB = 50;

export function S13({ onNav }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [err, setErr] = useState("");

  const pick = (f) => {
    setErr("");
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf") && f.type !== "application/pdf") {
      setErr("PDF 파일만 업로드할 수 있습니다.");
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setErr(`파일은 ${MAX_MB}MB 이하여야 합니다.`);
      return;
    }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file || uploading) return;
    setUploading(true);
    setErr("");
    setProgress("업로드 중…");
    // 이 앱에서 가장 오래 걸리는 일이다(표본 19쪽에 56초). 화면을 떠나도
    // 무슨 일이 도는지 보여야 한다.
    let doneLoading = showLoading("생기부를 올리는 중이에요…");
    try {
      // 원본을 먼저 보관한다 — 파싱이 실패해도 학생이 올린 문서는 다시 볼 수 있어야 한다
      await api.documentFile.put(file).catch(() => {});
      const { jobId } = await api.ingest.uploadPdf(file);
      sessionStorage.setItem("mbx_pdf_job", jobId);
      setProgress("파싱 중… (텍스트·키워드 추출)");
      doneLoading();
      doneLoading = showLoading("생기부를 읽고 그래프를 만드는 중이에요…");
      const job = await api.jobs.wait(jobId);
      if (job.status !== "completed") {
        throw new Error(job.error || "PDF 처리에 실패했습니다.");
      }
      sessionStorage.setItem("mbx_pdf_job", jobId);
      onNav("S14", { replace: true });
    } catch (e) {
      setErr(e.message || "업로드 실패");
      setProgress("");
    } finally {
      doneLoading();
      setUploading(false);
    }
  };

  return (
    <div className="content act-wrap">
      <div className="act-page">
        <header className="act-head">
          <Back onClick={() => onNav("S11")} label="생기부" />
          <h1 className="act-title">생기부 올리기</h1>
        </header>

        <section className="set-card act-glass">
          <button
            type="button"
            className={`up-drop${file ? " is-on" : ""}`}
            onClick={() => document.getElementById("pdf-inp").click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pick(e.dataTransfer.files?.[0]);
            }}
          >
            <NavIcon name={file ? "record" : "upload"} size={30} color="currentColor" />
            <span className="up-drop-t">
              {file ? file.name : "파일을 선택하거나 여기로 드래그하세요"}
            </span>
            {/* 파일을 고른 뒤에만 한 줄 — 무엇을 골랐는지 확인해야 하니까.
                고르기 전의 "PDF · 최대 50MB" 는 지웠다. 지금 알 필요가 없고,
                어긋나면(PDF 아님·너무 큼) 그때 말해 준다. */}
            {file && (
              <span className="up-drop-s">
                {(file.size / 1024 / 1024).toFixed(2)} MB · 다른 파일로 바꾸려면 누르세요
              </span>
            )}
          </button>
          <input
            id="pdf-inp"
            type="file"
            accept=".pdf,application/pdf"
            style={{ display: "none" }}
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </section>

        {file && (
          <section className="set-card act-glass">
            <h2 className="set-card-title">올리기 전에 확인</h2>
            <p className="set-note" style={{ margin: "0 0 12px" }}>
              구획 위에 커서를 올리면 범위가 보이고, 누르면 확대됩니다. 이 화면은 브라우저
              안에서만 열리며 파일이 아직 서버로 나가지 않습니다.
            </p>
            <PdfRegionViewer file={file} />
          </section>
        )}

        {progress && <p className="set-note">{progress}</p>}
        {err && <div className="form-err">{err}</div>}

        <Btn v="primary" s="lg" fw disabled={!file || uploading} onClick={handleUpload}>
          {uploading ? "처리 중…" : "업로드 시작"}
        </Btn>
      </div>
    </div>
  );
}
