import { useState, useEffect } from "react";
import TDS from "../../theme/tokens.js";
import { Btn, Notice } from "../../components/ui.jsx";
import api from "../../api/index.js";
import { useLoading } from "../../components/LoadingDock.jsx";

export function S14({ onNav }) {
  const [job, setJob] = useState(null);
  useLoading(!job, "파싱 결과를 불러오는 중이에요…");
  const [sel, setSel] = useState(new Set());
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const jobId = sessionStorage.getItem("mbx_pdf_job");

  useEffect(() => {
    if (!jobId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        let j = await api.jobs.get(jobId);
        if (j.status !== "completed" && j.status !== "failed") {
          j = await api.jobs.wait(jobId);
        }
        if (cancelled) return;
        setJob(j);
        const tokens = j.result?.tokens || (j.result?.keywords || []).map((label) => ({ label, frequency: 1 }));
        setSel(new Set(tokens.map((_, i) => i)));
      } catch (e) {
        if (!cancelled) setErr(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [jobId]);

  const tokens = job?.result?.tokens
    || (job?.result?.keywords || []).map((label) => ({ label, frequency: 1 }));

  const toggle = (id) => {
    const s = new Set(sel);
    s.has(id) ? s.delete(id) : s.add(id);
    setSel(s);
  };

  const apply = async () => {
    setBusy(true);
    setErr("");
    try {
      // PDF import already created all keyword nodes. Remove deselected by label match.
      const deselected = tokens.filter((_, i) => !sel.has(i)).map((t) => t.label);
      if (deselected.length) {
        const g = await api.graph.fetch();
        for (const label of deselected) {
          const node = (g.nodes || []).find((n) => n.label === label);
          if (node) {
            try { await api.graph.removeNode(node.id); } catch { /* ignore */ }
          }
        }
      }
      onNav("S06");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!jobId) {
    return (
      <div className="content" style={{ maxWidth: 720, margin: "0 auto" }}>
        <Notice type="warning">최근 PDF 작업이 없습니다.</Notice>
        <Btn v="primary" s="md" style={{ marginTop: 16 }} onClick={() => onNav("S13")}>PDF 업로드로 이동</Btn>
      </div>
    );
  }

  return (
    <div className="content" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>PDF 파싱 결과 검토</div>
      <div style={{ fontSize: 14, color: TDS.textTertiary, marginBottom: 20 }}>
        {job
          ? `${job.result?.page_count ?? "?"}페이지 · 키워드 ${tokens.length}개 · 영역 ${job.result?.sections_parsed ?? 0}개`
          : ""}
      </div>
      {err && <div style={{ color: TDS.danger, marginBottom: 12 }}>{err}</div>}
      {job?.status === "failed" && <Notice type="danger">{job.error || "처리 실패"}</Notice>}

      {!!(job?.result?.section_titles || []).length && (
        <Notice type="info" style={{ marginBottom: 16 }}>
          추출 영역: {(job.result.section_titles || []).join(", ")}
        </Notice>
      )}

      <div className="card card-p" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: TDS.textPrimary }}>{sel.size}/{tokens.length}개 선택</div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn v="ghost" s="sm" onClick={() => setSel(new Set(tokens.map((_, i) => i)))}>전체 선택</Btn>
            <Btn v="ghost" s="sm" onClick={() => setSel(new Set())}>전체 해제</Btn>
          </div>
        </div>
        {!tokens.length && <div style={{ fontSize: 13, color: TDS.textTertiary, padding: 12 }}>추출된 키워드가 없습니다</div>}
        {tokens.map((n, i) => (
          <div
            key={`${n.label}-${i}`}
            onClick={() => toggle(i)}
            style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, marginBottom: 6,
              background: sel.has(i) ? TDS.blue50 : TDS.bgSecondary,
              border: `1px solid ${sel.has(i) ? TDS.blue500 : TDS.borderDefault}`,
              cursor: "pointer",
            }}
          >
            <div style={{
              width: 18, height: 18, borderRadius: 4,
              border: `2px solid ${sel.has(i) ? TDS.blue500 : TDS.borderDefault}`,
              background: sel.has(i) ? TDS.blue500 : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              {sel.has(i) && <div style={{ width: 8, height: 6, borderLeft: "2px solid #fff", borderBottom: "2px solid #fff", transform: "rotate(-45deg)", marginTop: -2 }} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: TDS.textPrimary }}>{n.label}</div>
              <div style={{ fontSize: 11, color: TDS.textTertiary }}>키워드 · 빈도 {n.frequency ?? 1}</div>
            </div>
          </div>
        ))}
      </div>
      <Notice type="info" style={{ marginBottom: 16 }}>
        업로드 시 키워드는 이미 그래프에 반영됩니다. 선택 해제 후 반영하면 해당 노드를 삭제합니다.
      </Notice>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn v="secondary" s="md" fw onClick={() => onNav("S11")}>텍스트 영역</Btn>
        <Btn v="primary" s="md" fw disabled={!sel.size || busy} onClick={apply}>
          {busy ? "반영 중…" : `선택한 ${sel.size}개 그래프 확인`}
        </Btn>
      </div>
    </div>
  );
}
