/**
 * S13 — 생기부 PDF 업로드.
 *
 * 파일을 고르면 **올리기 전에 브라우저에서 먼저 열어** 구획을 보여준다.
 * 서버는 추출된 텍스트·키워드만 보관하고 PDF 원본은 오래 두지 않으므로,
 * 원본을 눈으로 확인할 수 있는 시점은 여기뿐이다. 뷰어는 전부 클라이언트에서
 * 돌아서 파일이 이 단계에서 서버로 나가지 않는다.
 */

import { useState } from "react";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Notice } from "../../components/ui.jsx";
import { PdfRegionViewer } from "../../components/pdf/PdfRegionViewer.jsx";
import api from "../../api/index.js";

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
    try {
      const { jobId } = await api.ingest.uploadPdf(file);
      sessionStorage.setItem("mbx_pdf_job", jobId);
      setProgress("파싱 중… (텍스트·키워드 추출)");
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
      setUploading(false);
    }
  };

  return (
    <div className="content" style={{ maxWidth: file ? 1000 : 560, margin: "0 auto" }}>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>PDF 업로드</div>
      <div style={{ fontSize: 14, color: TDS.textTertiary, marginBottom: 24 }}>
        생활기록부 PDF를 업로드하면 텍스트·키워드를 추출하고 그래프에 반영합니다
      </div>
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
      {err && <div style={{ color: TDS.danger, marginBottom: 12, fontSize: 13 }}>{err}</div>}
      <Notice type="info" style={{ marginBottom: 20 }}>
        서버에 PDF 원본은 오래 보관하지 않고, 추출된 텍스트·키워드만 저장합니다.
      </Notice>
      <Btn v="primary" s="lg" fw disabled={!file || uploading} onClick={handleUpload}>
        {uploading ? "처리 중…" : "업로드 시작"}
      </Btn>
    </div>
  );
}
