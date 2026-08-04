/**
 * 노드 만들기 · 고치기 폼.
 *
 * 그래프는 AI 가 생기부에서 뽑아 만든다. 그런데 뽑힌 결과가 늘 맞지는 않는다 —
 * 이름이 어색하거나, 과목이 잘못 붙거나, 정작 중요한 개념이 빠져 있다. 그때
 * **학생이 직접 고칠 수 없으면 그래프는 남의 것**이 된다. 그래서 만들기·고치기를
 * 그래프 화면 안에 둔다(다른 화면으로 보내지 않는다).
 *
 * 과목·분야는 아이콘과 배치를 정하는 값이라 자유 입력이 아니라 목록에서 고른다.
 * 직접 만든 노드도 AI 가 만든 노드와 같은 모양·같은 자리에 서야 한다.
 */

import { useEffect, useState } from "react";
import TDS from "../../theme/tokens.js";
import { OVERLAY_TEXT } from "../../theme/graphMeta.js";
import { SUBJECT_LEGEND } from "../../theme/nodeIcons.js";
import { NavIcon } from "../NavIcon.jsx";
import { Btn } from "../ui.jsx";

/** 과목·분야 선택지. 범례와 같은 목록이어야 아이콘이 뜻대로 붙는다. */
const SECTIONS = SUBJECT_LEGEND.map((s) => s.label);
const NO_SECTION = "기타";

const field = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 9,
  border: `1px solid ${TDS.border}`,
  background: TDS.bgPrimary,
  color: TDS.textPrimary,
  fontFamily: "inherit",
  fontSize: 13.5,
  outline: "none",
};
const labelStyle = {
  display: "block",
  fontSize: 11.5,
  fontWeight: 700,
  color: TDS.textTertiary,
  marginBottom: 5,
};

export function NodeEditor({ mode, node, nodes, defaultParentId, onSubmit, onCancel, busy }) {
  const editing = mode === "edit";
  const [label, setLabel] = useState("");
  const [section, setSection] = useState(NO_SECTION);
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setLabel(editing ? node?.label || "" : "");
    setSection(editing ? node?.section || NO_SECTION : NO_SECTION);
    setDescription(editing ? node?.description || "" : "");
    setParentId(editing ? "" : defaultParentId || "");
    setError("");
  }, [editing, node?.id, node?.label, node?.section, node?.description, defaultParentId]);

  const submit = (e) => {
    e.preventDefault();
    const name = label.trim();
    if (!name) {
      setError("이름을 입력해 주세요.");
      return;
    }
    onSubmit({
      label: name,
      section: section === NO_SECTION ? "" : section,
      description: description.trim(),
      parentId: parentId || null,
    });
  };

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={labelStyle} htmlFor="node-label">이름</label>
        <input
          id="node-label"
          autoFocus
          value={label}
          maxLength={200}
          placeholder="예: 전염 모형"
          onChange={(e) => { setLabel(e.target.value); setError(""); }}
          style={field}
        />
      </div>

      <div>
        <label style={labelStyle} htmlFor="node-section">과목·분야</label>
        <select
          id="node-section"
          value={section}
          onChange={(e) => setSection(e.target.value)}
          style={{ ...field, cursor: "pointer" }}
        >
          <option value={NO_SECTION}>{NO_SECTION}</option>
          {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <p style={{ fontSize: 11, color: TDS.textTertiary, marginTop: 5, lineHeight: 1.5 }}>
          아이콘과 그래프에서의 자리가 이 값으로 정해집니다.
        </p>
      </div>

      <div>
        <label style={labelStyle} htmlFor="node-desc">설명 <span style={{ fontWeight: 500 }}>(선택)</span></label>
        <textarea
          id="node-desc"
          value={description}
          maxLength={2000}
          rows={3}
          placeholder="이 노드가 무엇인지 한두 줄로"
          onChange={(e) => setDescription(e.target.value)}
          style={{ ...field, resize: "vertical", lineHeight: 1.55 }}
        />
      </div>

      {/* 새로 만들 때만. 고칠 때는 연결을 아래 "연결" 목록에서 다룬다 —
          한 폼에서 이름도 고치고 연결도 바꾸면 무엇을 저장하는지 흐려진다. */}
      {!editing && (
        <div>
          <label style={labelStyle} htmlFor="node-parent">어디에 연결할까요 <span style={{ fontWeight: 500 }}>(선택)</span></label>
          <select
            id="node-parent"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            style={{ ...field, cursor: "pointer" }}
          >
            <option value="">연결 없이 두기</option>
            {nodes.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
          </select>
          <p style={{ fontSize: 11, color: TDS.textTertiary, marginTop: 5, lineHeight: 1.5 }}>
            연결하지 않으면 따로 떨어진 점으로 남습니다. 나중에 이어도 됩니다.
          </p>
        </div>
      )}

      {error && <p style={{ fontSize: 12, color: TDS.danger, margin: 0 }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
        <Btn v="primary" s="md" type="submit" disabled={busy} style={{ flex: 1 }}>
          {busy ? "저장 중…" : editing ? "저장" : "노드 추가"}
        </Btn>
        <Btn v="ghost" s="md" type="button" onClick={onCancel} disabled={busy}>취소</Btn>
      </div>
    </form>
  );
}

/**
 * 삭제 확인.
 *
 * 노드를 지우면 거기 걸린 연결도 함께 사라진다. 몇 개가 사라지는지 보여주지 않고
 * 지우면, 학생은 그래프가 왜 흩어졌는지 알 수 없다. 되돌리기가 없는 동작이므로
 * **무엇을 잃는지 먼저 말한다.**
 */
export function NodeDeleteConfirm({ node, edgeCount, onConfirm, onCancel, busy }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
        <span style={{ color: TDS.danger, lineHeight: 0, marginTop: 2 }}>
          <NavIcon name="alert" size={17} color={TDS.danger} />
        </span>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: TDS.textPrimary, margin: 0 }}>
            ‘{node.label}’ 노드를 지울까요?
          </p>
          <p style={{ fontSize: 12, color: TDS.textSecondary, margin: "5px 0 0", lineHeight: 1.55 }}>
            {edgeCount > 0
              ? `이 노드에 걸린 연결 ${edgeCount}개도 함께 사라집니다. 되돌릴 수 없습니다.`
              : "되돌릴 수 없습니다."}
          </p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn v="secondary" s="md" onClick={onConfirm} disabled={busy}
          style={{ flex: 1, color: TDS.danger, borderColor: TDS.danger }}>
          {busy ? "지우는 중…" : "삭제"}
        </Btn>
        <Btn v="ghost" s="md" onClick={onCancel} disabled={busy}>취소</Btn>
      </div>
    </div>
  );
}

/**
 * 이 노드에 걸린 연결 목록. 하나씩 끊을 수 있고, 새로 이을 수도 있다.
 * 연결이 없으면 그래프에서 떨어진 점이 되므로, 비어 있을 때도 그 사실을 말한다.
 */
export function NodeConnections({ node, edges, nodes, onConnect, onDisconnect, busy }) {
  const [adding, setAdding] = useState(false);
  const [target, setTarget] = useState("");

  const linked = edges
    .filter((e) => e.from === node.id || e.to === node.id)
    .map((e) => ({
      edgeId: e.id,
      other: nodes.find((n) => n.id === (e.from === node.id ? e.to : e.from)),
    }))
    .filter((l) => l.other);

  const linkedIds = new Set(linked.map((l) => l.other.id));
  const candidates = nodes.filter((n) => n.id !== node.id && !linkedIds.has(n.id));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: TDS.textTertiary, margin: 0 }}>
          연결 {linked.length}개
        </p>
        {!adding && candidates.length > 0 && (
          <Btn v="secondary" s="sm" onClick={() => setAdding(true)} disabled={busy}>연결 추가</Btn>
        )}
      </div>

      {adding && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            style={{ ...field, flex: 1, minWidth: 0, cursor: "pointer" }}
          >
            <option value="">이을 노드 고르기</option>
            {candidates.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
          </select>
          <Btn v="primary" s="sm" disabled={!target || busy}
            onClick={() => { onConnect(target); setTarget(""); setAdding(false); }}>잇기</Btn>
          <Btn v="ghost" s="sm" onClick={() => { setAdding(false); setTarget(""); }}>취소</Btn>
        </div>
      )}

      {!linked.length && !adding && (
        <p style={{ fontSize: 12, color: OVERLAY_TEXT.tertiary, margin: "0 0 8px", lineHeight: 1.5 }}>
          아직 아무 데도 이어져 있지 않습니다. 관련 있는 노드와 이으면 그래프가 하나로 읽힙니다.
        </p>
      )}

      {linked.map((l) => (
        <div key={l.edgeId}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: TDS.bgTertiary, borderRadius: 9, marginBottom: 6 }}>
          <span style={{ color: TDS.textTertiary, lineHeight: 0, flexShrink: 0 }}>
            <NavIcon name="link" size={13} color={TDS.textTertiary} />
          </span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: TDS.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {l.other.label}
          </span>
          <button
            type="button"
            onClick={() => onDisconnect(l.edgeId)}
            disabled={busy}
            title="연결 끊기"
            aria-label={`${l.other.label} 연결 끊기`}
            style={{ flexShrink: 0, border: "none", background: "transparent", cursor: "pointer", color: TDS.textTertiary, padding: 2, lineHeight: 0 }}
          >
            <NavIcon name="close" size={13} color={TDS.textTertiary} />
          </button>
        </div>
      ))}
    </div>
  );
}
