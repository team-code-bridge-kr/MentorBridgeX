import { useState, useEffect, useRef } from "react";
import TDS from "../../theme/tokens.js";
import { Btn, Badge, Card } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";
import api from "../../api/index.js";
import { withLoading } from "../../components/LoadingDock.jsx";
import { FormTabs } from "../../components/forms/FormTabs.jsx";
import { eul } from "../../lib/josa.js";

/** 서버가 글자를 뽑을 수 있는 것들. `accept` 속성과 같은 목록이다. */
const ACCEPT_RE = /\.(pdf|txt|md|markdown)$/i;

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
    // 한글·워드 안내는 여기서 한다. 상자에 미리 적어 두면 세 줄짜리 주의문이
    // 늘 서 있는데, 정작 그 말이 필요한 사람은 .hwp 를 끌어다 놓은 순간이다.
    if (!ACCEPT_RE.test(file.name)) {
      setErr("한글(.hwp)·워드(.docx)는 PDF 로 저장해 올려 주세요. PDF · txt · md 만 읽을 수 있습니다.");
      return;
    }
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
    <div className="rs-wrap">
      {/* "생성 이력 보기" 단추는 탭이 대신한다 — 목록으로 가는 길이 화면
          안쪽 작은 단추 하나뿐이면 매번 찾아야 한다. */}
      <FormTabs active="S20" onNav={onNav} />
      {err && <div className="form-err">{err}</div>}

      {/* 학교가 준 양식을 그대로 채운다. 우리가 만든 여섯 가지 말고 실제로
          내야 하는 건 대개 학교 양식이다 — 그걸 못 채우면 여기까지 온 뜻이 없다. */}
      <div
        className={`form-drop${drag ? " is-over" : ""}${busy === "upload" ? " is-busy" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); fill(e.dataTransfer.files?.[0]); }}
        onClick={() => !busy && fileRef.current?.click()}
      >
        <span className="form-drop-ic"><NavIcon name="exportIco" size={22} color={TDS.blue500} /></span>
        <div className="form-drop-title">
          {busy === "upload" ? "양식을 읽고 채우는 중…" : "학교에서 받은 양식 올리기"}
        </div>
        <div className="form-drop-sub">물음 항목을 찾아 생기부 기록으로 채웁니다</div>
        {/* 형식·크기·보관 여부는 셋 다 남긴다. 앞의 둘은 올리기 전에 알아야
            헛수고를 안 하고, 마지막은 약속이라 지울 수 없다. 크기를 줄여
            줄글에서 빼면 세 줄이 한 줄로 접힌다. */}
        <div className="form-drop-meta">PDF · txt · md · 5MB 이하 · 보관하지 않습니다</div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
          hidden
          onChange={(e) => fill(e.target.files?.[0])}
        />
      </div>

      {/* "또는 자주 쓰는 보고서로 시작하기" 를 지웠다. 카드 다섯 장이 이미
          보고서 이름을 달고 있어서, 그 위의 한 줄은 보이는 것을 한 번 더
          말할 뿐이었다. */}
      <div className="grid3 g-16" style={{ gap: 16, marginTop: 22 }}>
        {templates.map((tmpl) => (
          <Card key={tmpl.id} style={{ cursor: "pointer" }} onClick={() => !busy && generate(tmpl)}>
            {/* "사용 892회" 를 지웠다. 아무도 세지 않는 숫자였다 — 서버에
                손으로 적어 둔 상수라 몇 명이 쓰든 892 였다. */}
            <div style={{ marginBottom: 10 }}>
              <Badge t="blue" pill>{tmpl.category}</Badge>
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
