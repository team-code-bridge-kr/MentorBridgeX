import { useState, useEffect, useRef } from "react";
import TDS from "../../theme/tokens.js";
import { Btn, Badge, Card } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";
import api from "../../api/index.js";
import { withLoading } from "../../components/LoadingDock.jsx";
import { eul } from "../../lib/josa.js";

export function S20({ onNav }) {
  const [templates, setTemplates] = useState([]);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    api.forms.listTemplates().then(setTemplates).catch((e) => setErr(e.message));
  }, []);

  const open = (doc) => {
    sessionStorage.setItem("mbx_form_id", doc.id);
    onNav("S22");
  };

  const generate = async (tmpl) => {
    setBusy(tmpl.id);
    setErr("");
    try {
      open(await withLoading(
        `${tmpl.title}${eul(tmpl.title)} 쓰는 중이에요…`,
        () => api.forms.generate(tmpl.id),
      ));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  const fill = async (file) => {
    if (!file) return;
    setBusy("upload");
    setErr("");
    try {
      open(await withLoading(
        "양식을 읽고 채우는 중이에요…",
        () => api.forms.fillFromFile(file),
      ));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="content">
      <div className="row-between mb24" style={{ marginBottom: 24 }}>
        <div className="sec-sub" style={{ marginBottom: 0 }}>
          생기부에 적힌 내용을 근거로 씁니다. 기록에 없는 것은 지어내지 않습니다.
        </div>
        <Btn v="secondary" s="sm" onClick={() => onNav("S21")}>생성 이력 보기</Btn>
      </div>
      {err && <div style={{ color: TDS.danger, marginBottom: 12 }}>{err}</div>}

      {/* 학교가 준 양식을 그대로 채운다. 우리가 만든 여섯 가지 말고 실제로
          내야 하는 건 대개 학교 양식이다 — 그걸 못 채우면 여기까지 온 뜻이 없다. */}
      <div
        className={`form-drop${drag ? " is-over" : ""}${busy === "upload" ? " is-busy" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); fill(e.dataTransfer.files?.[0]); }}
        onClick={() => !busy && fileRef.current?.click()}
      >
        <NavIcon name="exportIco" size={22} color={TDS.blue500} />
        <div>
          <div className="form-drop-title">
            {busy === "upload" ? "양식을 읽고 채우는 중…" : "학교에서 받은 양식 올리기"}
          </div>
          <div className="form-drop-sub">
            물음 항목을 찾아 생기부 기록으로 채웁니다 · PDF · txt · md (5MB 이하)
            <br />
            한글(.hwp)·워드(.docx)는 PDF 로 저장해 올려 주세요. 올린 파일은 보관하지 않습니다.
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
          hidden
          onChange={(e) => fill(e.target.files?.[0])}
        />
      </div>

      <div className="sec-sub" style={{ margin: "26px 0 12px" }}>또는 자주 쓰는 보고서로 시작하기</div>
      <div className="grid3 g-16" style={{ gap: 16 }}>
        {templates.map((tmpl) => (
          <Card key={tmpl.id} style={{ cursor: "pointer" }} onClick={() => !busy && generate(tmpl)}>
            <div className="row-between mb8" style={{ marginBottom: 10 }}>
              <Badge t="blue" pill>{tmpl.category}</Badge>
              <span style={{ fontSize: 12, color: TDS.textTertiary }}>사용 {(tmpl.uses || 0).toLocaleString()}회</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{tmpl.title}</div>
            <div style={{ fontSize: 13, color: TDS.textTertiary, marginBottom: 18, lineHeight: 1.6 }}>{tmpl.description}</div>
            {/* 카드 전체가 클릭 대상이라 버튼은 보조로 둔다 — 같은 무게의 파란
                버튼이 여섯 개면 어디를 눌러야 할지 오히려 알기 어렵다 */}
            {/* 키보드로 다니는 사람에게는 이 단추가 유일한 길이다. 카드 클릭은
                손을 위한 편의일 뿐이라 여기에도 같은 동작을 건다. */}
            <Btn
              v="secondary"
              s="sm"
              style={{ width: "100%" }}
              disabled={busy === tmpl.id}
              onClick={(e) => { e.stopPropagation(); if (!busy) generate(tmpl); }}
            >
              {busy === tmpl.id ? "쓰는 중…" : "이 보고서 쓰기"}
            </Btn>
          </Card>
        ))}
      </div>
    </div>
  );
}
