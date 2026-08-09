/**
 * S13 — 생기부 PDF 업로드.
 *
 * 파일을 고르면 **올리기 전에 브라우저에서 먼저 열어** 구획을 보여준다.
 * 이 미리보기는 전부 클라이언트에서 돌아 이 단계에서는 파일이 서버로 나가지 않는다.
 *
 * 업로드하면 원본 PDF 도 함께 보관된다(학생당 최신본 한 개). 파싱 결과가 아니라
 * 실제로 받은 문서를 다시 볼 수 있어야 한다는 요구다. 민감 정보라 본인만 열람
 * 가능하고 삭제 경로도 함께 제공한다 — 자세한 규칙은 routers/documents.py 참고.
 */

import { useState } from "react";
import TDS from "../../theme/tokens.js";
import { Back, TFI, Btn, Notice } from "../../components/ui.jsx";
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
    <div className={`rs-wrap${file ? "" : " rs-narrow"}`}>
      <div className="form-head">
        <Back onClick={() => onNav("S11")} label="생기부" />
        <h1 className="form-title">생기부 올리기</h1>
      </div>
      <p className="sec-sub">올리면 글을 뽑아 영역별로 나누고, 그래프에 이어 붙입니다.</p>
      <div className="card card-p" style={{ marginBottom: 16 }}>
        <div
          style={{
            border: `2px dashed ${file ? TDS.blue500 : TDS.borderDefault}`,
            borderRadius: 12,
            padding: "40px 24px",
            textAlign: "center",
            background: file ? TDS.blue50 : "transparent",
            cursor: "pointer",
          }}
          onClick={() => document.getElementById("pdf-inp").click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pick(e.dataTransfer.files?.[0]);
          }}
        >
          <TFI s={48}>{file ? "📄" : "📤"}</TFI>
          <div style={{ fontSize: 15, fontWeight: 600, color: file ? TDS.blue500 : TDS.textSecondary, marginTop: 12 }}>
            {file ? file.name : "파일을 선택하거나 여기로 드래그하세요"}
          </div>
          <div style={{ fontSize: 12, color: TDS.textTertiary, marginTop: 6 }}>
            {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : `PDF 파일 · 최대 ${MAX_MB} MB`}
          </div>
        </div>
        <input
          id="pdf-inp"
          type="file"
          accept=".pdf,application/pdf"
          style={{ display: "none" }}
          onChange={(e) => pick(e.target.files?.[0])}
        />
        {file && (
          <div style={{ marginTop: 16, padding: 12, background: TDS.successBg, borderRadius: 8, fontSize: 13, color: TDS.success, display: "flex", alignItems: "center", gap: 8 }}>
            <TFI>✅</TFI>파일이 선택되었습니다
          </div>
        )}
      </div>
      {file && (
        <div className="card card-p" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>구획 확인</div>
          <div style={{ fontSize: 13, color: TDS.textTertiary, marginBottom: 14, lineHeight: 1.6 }}>
            올리기 전에 미리 봅니다. 영역 위에 커서를 올리면 범위가 보이고, 누르면 확대됩니다.
            이 화면은 브라우저 안에서만 열리며 파일이 서버로 나가지 않습니다.
          </div>
          <PdfRegionViewer file={file} />
        </div>
      )}

      {progress && <Notice type="info" style={{ marginBottom: 12 }}>{progress}</Notice>}
      {err && <div className="form-err">{err}</div>}
      {/* 보관 정책이 바뀌면 이 문구도 반드시 같이 바꿀 것 — 사용자에게 하는 약속이다 */}
      <Notice type="info" style={{ marginBottom: 20 }}>
        올린 PDF 원본은 <strong>본인만 열람</strong>할 수 있게 보관되어 ‘생기부 문서’에서
        책처럼 다시 볼 수 있습니다. 최신본 한 개만 남고, 언제든 그 화면에서 원본만 삭제할 수 있습니다.
      </Notice>
      <Btn v="primary" s="lg" fw disabled={!file || uploading} onClick={handleUpload}>
        {uploading ? "처리 중…" : "업로드 시작"}
      </Btn>
    </div>
  );
}
