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
import { Section } from "./GraphPanel.jsx";
import api from "../../api/index.js";

/** 과목·분야 선택지. 범례와 같은 목록이어야 아이콘이 뜻대로 붙는다. */
const SECTIONS = SUBJECT_LEGEND.map((s) => s.label);
const NO_SECTION = "기타";

/**
 * 노드 고르기 — 찾아서 누른다.
 *
 * 기본 `<select>` 를 썼었다. 운영체제가 그리는 목록이라 판 안의 다른 것들과
 * 테두리·글자·모서리가 전부 어긋났고, 무엇보다 **찾을 수가 없었다** — 노드가
 * 백 개면 스크롤로 훑는 수밖에 없다.
 *
 * 고르기와 잇기를 한 번에 한다. 예전에는 고른 뒤 「잇기」를 또 눌러야 했는데,
 * 목록에서 이름을 누르는 것 자체가 이미 "이걸로 하겠다" 는 뜻이다.
 */
function NodePicker({ nodes, placeholder, onPick, onCancel }) {
  const [q, setQ] = useState("");
  const packed = q.trim().replace(/\s+/g, "").toLowerCase();
  const hits = packed
    ? nodes.filter((n) => n.label.replace(/\s+/g, "").toLowerCase().includes(packed))
    : nodes;

  return (
    <div className="npick">
      <input
        className="nform-input"
        autoFocus
        value={q}
        placeholder={placeholder}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.preventDefault(); onCancel(); }
          // 하나만 남았으면 엔터로 바로 잇는다 — 찾아 놓고 또 누르게 하지 않는다.
          if (e.key === "Enter") { e.preventDefault(); if (hits.length === 1) onPick(hits[0].id); }
        }}
      />
      <div className="npick-list">
        {hits.length === 0 && <p className="npick-empty">찾는 이름이 없습니다.</p>}
        {hits.slice(0, 40).map((n) => (
          <button key={n.id} type="button" className="npick-item" onClick={() => onPick(n.id)}>
            <NavIcon name="link" size={12} color={TDS.textTertiary} />
            <span>{n.label}</span>
          </button>
        ))}
        {hits.length > 40 && (
          <p className="npick-empty">{hits.length - 40}개 더 있습니다. 이름을 더 적어 좁혀 보세요.</p>
        )}
      </div>
      <button type="button" className="npick-cancel" onClick={onCancel}>취소</button>
    </div>
  );
}

export function NodeEditor({ mode, node, nodes, defaultParentId, onSubmit, onCancel, busy }) {
  const editing = mode === "edit";
  const [label, setLabel] = useState("");
  const [section, setSection] = useState(NO_SECTION);
  const [description, setDescription] = useState("");
  /* 다른 이름은 **하나씩** 담는다.
     예전에는 "인공지능, 머신러닝" 처럼 한 칸에 쉼표로 적게 했다. 쉼표를 안 쓰면
     통째로 한 이름이 되고, 이름 안에 쉼표가 들어가면 둘로 쪼개진다. 무엇보다
     지금 몇 개를 넣어 뒀는지 눈으로 셀 수가 없었다. */
  const [aliases, setAliases] = useState([]);
  const [aliasDraft, setAliasDraft] = useState("");
  const [parentId, setParentId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setLabel(editing ? node?.label || "" : "");
    setSection(editing ? node?.section || NO_SECTION : NO_SECTION);
    setDescription(editing ? node?.description || "" : "");
    setAliases(editing ? [...(node?.aliases || [])] : []);
    setAliasDraft("");
    setParentId(editing ? "" : defaultParentId || "");
    setError("");
  }, [editing, node?.id, node?.label, node?.section, node?.description, defaultParentId]);

  const addAlias = () => {
    const t = aliasDraft.trim();
    // 이름과 같은 것, 이미 담은 것은 넣지 않는다 — 같은 말을 두 번 찾을 이유가 없다.
    if (!t || t === label.trim() || aliases.includes(t) || aliases.length >= 8) {
      setAliasDraft("");
      return;
    }
    setAliases((prev) => [...prev, t]);
    setAliasDraft("");
  };

  const submit = (e) => {
    e.preventDefault();
    const name = label.trim();
    if (!name) {
      setError("이름을 입력해 주세요.");
      return;
    }
    // 적어만 두고 엔터를 안 눌렀을 수도 있다. 그것도 함께 담는다 —
    // 저장했는데 방금 친 말이 사라지면 없어진 줄도 모른다.
    const pending = aliasDraft.trim();
    const all = pending && pending !== name && !aliases.includes(pending)
      ? [...aliases, pending]
      : aliases;
    onSubmit({
      label: name,
      section: section === NO_SECTION ? "" : section,
      description: description.trim(),
      aliases: all.filter((t) => t && t !== name).slice(0, 8),
      parentId: parentId || null,
    });
  };

  return (
    <form onSubmit={submit} className="nform">
      <div className="nform-row">
        <label className="nform-label" htmlFor="node-label">이름</label>
        <input
          id="node-label"
          className="nform-input"
          autoFocus
          value={label}
          maxLength={200}
          placeholder="예: 전염 모형"
          onChange={(e) => { setLabel(e.target.value); setError(""); }}
        />
      </div>

      <div className="nform-row">
        <label className="nform-label" htmlFor="node-section">과목·분야</label>
        {/* 브라우저 기본 select 는 운영체제마다 생김새가 다르다 — 판 안의 다른
            칸들과 테두리·모서리·글자가 전부 어긋났다. 알약 칩으로 고른다:
            무엇을 고를 수 있는지 펼치지 않아도 보이고, 지금 고른 것도 보인다. */}
        <div className="nform-chips" role="radiogroup" aria-labelledby="node-section">
          {[NO_SECTION, ...SECTIONS].map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={section === s}
              className={`nform-chip${section === s ? " on" : ""}`}
              onClick={() => setSection(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="nform-row">
        <label className="nform-label" htmlFor="node-desc">설명 <span>선택</span></label>
        <textarea
          id="node-desc"
          className="nform-input nform-area"
          value={description}
          maxLength={2000}
          rows={3}
          placeholder="이 노드가 무엇인지 한두 줄로"
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="nform-row">
        <label className="nform-label" htmlFor="node-alias">다른 이름 <span>선택</span></label>
        {!!aliases.length && (
          <div className="nform-tags">
            {aliases.map((t) => (
              <span key={t} className="nform-tag">
                {t}
                <button type="button" aria-label={`${t} 빼기`}
                  onClick={() => setAliases((prev) => prev.filter((x) => x !== t))}>
                  <NavIcon name="close" size={11} color={TDS.textTertiary} />
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          id="node-alias"
          className="nform-input"
          value={aliasDraft}
          maxLength={60}
          placeholder="적고 엔터"
          onChange={(e) => setAliasDraft(e.target.value)}
          onKeyDown={(e) => {
            // 엔터가 폼을 보내지 않게 막는다 — 이름 하나 넣으려다 저장된다.
            if (e.key === "Enter") { e.preventDefault(); addAlias(); }
            if (e.key === "Backspace" && !aliasDraft && aliases.length) {
              setAliases((prev) => prev.slice(0, -1));
            }
          }}
          onBlur={addAlias}
        />
      </div>

      {/* 새로 만들 때만. 고칠 때는 연결을 아래 "연결" 목록에서 다룬다 —
          한 폼에서 이름도 고치고 연결도 바꾸면 무엇을 저장하는지 흐려진다. */}
      {!editing && (
        <div className="nform-row">
          <label className="nform-label">어디에 연결할까요 <span>선택</span></label>
          {parentId ? (
            <div className="nform-tags">
              <span className="nform-tag">
                {nodes.find((n) => n.id === parentId)?.label || "고른 노드"}
                <button type="button" aria-label="연결 없이 두기" onClick={() => setParentId("")}>
                  <NavIcon name="close" size={11} color={TDS.textTertiary} />
                </button>
              </span>
            </div>
          ) : (
            <NodePicker
              nodes={nodes}
              placeholder="이을 노드 이름 (비워 두면 따로 둡니다)"
              onPick={(id) => setParentId(id)}
              onCancel={() => setParentId("")}
            />
          )}
        </div>
      )}

      {error && <p className="form-err" style={{ margin: 0 }}>{error}</p>}

      <div className="nform-act">
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
 *
 * **이을 만한 짝을 먼저 내민다.** 예전에는 목록에서 손으로 고르는 길뿐이었는데,
 * 노드가 백 개면 무엇과 이어야 할지는 그 목록을 봐도 안 나온다. 서버가 생기부
 * **같은 문장**에 함께 적혀 있던 짝을 찾아 준다 — 모델을 쓰지 않고 규칙만
 * 쓰므로, 왜 떴는지를 그 문장 하나로 다 말할 수 있다. 읽고 아니면 넘긴다.
 */
export function NodeConnections({ node, edges, nodes, onConnect, onDisconnect, busy }) {
  const [adding, setAdding] = useState(false);
  const [hints, setHints] = useState({ loading: true, items: [] });
  const [skipped, setSkipped] = useState(() => new Set());
  // 방금 이은 상대. 목록에서 그 줄만 잠깐 밝힌다 — 줄이 하나 늘었다는 것을
  // 눈으로 못 잡으면, 눌러 놓고도 무엇이 달라졌는지 알 수 없다.
  const [justAdded, setJustAdded] = useState(null);

  useEffect(() => {
    let alive = true;
    setSkipped(new Set());
    setJustAdded(null);
    setHints({ loading: true, items: [] });
    api.graph
      .suggestedLinks(6, node.id)
      .then((items) => alive && setHints({ loading: false, items }))
      // 추천이 없다고 화면이 죽으면 안 된다 — 연결 목록은 그대로 쓸 수 있어야 한다.
      .catch(() => alive && setHints({ loading: false, items: [] }));
    return () => { alive = false; };
  }, [node.id]);

  const linked = edges
    .filter((e) => e.from === node.id || e.to === node.id)
    .map((e) => ({
      edgeId: e.id,
      other: nodes.find((n) => n.id === (e.from === node.id ? e.to : e.from)),
    }))
    .filter((l) => l.other);

  const linkedIds = new Set(linked.map((l) => l.other.id));
  const candidates = nodes.filter((n) => n.id !== node.id && !linkedIds.has(n.id));

  /** 잇고 나서 그 줄을 잠깐 밝힌다. 3초면 눈이 따라가고도 남는다. */
  const connect = async (otherId) => {
    await onConnect(otherId);
    setJustAdded(otherId);
    setTimeout(() => setJustAdded((cur) => (cur === otherId ? null : cur)), 3000);
  };

  // 아직 잇지 않았고 「아니요」로 넘기지도 않은 제안. 구획을 세울지 말지가
  // 여기서 갈리므로 그리기 전에 미리 센다.
  const fresh = hints.loading
    ? []
    : hints.items.filter((h) => {
        const other = h.source_id === node.id ? h.target_id : h.source_id;
        return !linkedIds.has(other) && !skipped.has(other);
      });

  return (
    // 구획 껍데기를 이 컴포넌트가 직접 두른다. 「연결 추가」를 머리글 알약 옆에
    // 세우려면 `adding` 을 아는 쪽이 머리글도 그려야 한다 — 상태만 위로 올리면
    // 화면(S06)이 이 목록의 속사정(후보가 남았는지)까지 알아야 했다.
    //
    // 「이어 볼 만한 것」은 **따로 선 구획**이다. 예전에는 연결 목록 끝에
    // 작은 굵은 글씨로 붙어 있어서, 옆의 「출처」·「연결」·「다음 탐구」와 달리
    // 무엇의 시작인지 알약으로 표시되지 않았다 — 판 안에서 같은 무게의 것은
    // 같은 모양으로 서야 한다.
    <>
    <Section
      title="연결"
      action={
        !adding && candidates.length > 0 ? (
          <Btn v="secondary" s="sm" onClick={() => setAdding(true)} disabled={busy}>연결 추가</Btn>
        ) : null
      }
    >
      {adding && (
        <NodePicker
          nodes={candidates}
          placeholder="이을 노드 이름"
          onPick={(id) => { connect(id); setAdding(false); }}
          onCancel={() => setAdding(false)}
        />
      )}

      {!linked.length && !adding && (
        <p style={{ fontSize: 12, color: OVERLAY_TEXT.tertiary, margin: "0 0 8px", lineHeight: 1.5 }}>
          아직 아무 데도 이어져 있지 않습니다. 관련 있는 노드와 이으면 그래프가 하나로 읽힙니다.
        </p>
      )}


      {linked.map((l) => (
        <div key={l.edgeId}
          className={`nlink-row${justAdded === l.other.id ? " is-new" : ""}`}
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

    </Section>

    {/* 이을 만한 짝 — 생기부 같은 문장에 함께 적혀 있던 것.
        이미 이어진 짝은 서버가 빼고 준다.

        알약 아래 설명 줄은 걷었다. 근거는 카드마다 문장으로 그대로 실려 있어
        왜 떴는지는 그걸 읽으면 알고, 「잇기」가 무엇을 하는지는 눌렀을 때
        알림과 「연결」 목록의 강조가 말한다 — 미리 두 줄로 설명할 일이 아니다.
        개수도 알약에 붙이지 않는다(다른 구획이 다 이름만 단다). */}
    {fresh.length > 0 && (
      <Section title="이어 볼 만한 것">
        {fresh.map((h) => {
          const otherId = h.source_id === node.id ? h.target_id : h.source_id;
          const otherLabel = h.source_id === node.id ? h.target_label : h.source_label;
          return (
            <div key={otherId} className="nlink-hint">
              <div className="nlink-hint-head">
                <NavIcon name="link" size={12} color={TDS.primary} />
                <span className="nlink-hint-name">{otherLabel}</span>
                {h.count > 1 && <span className="nlink-hint-n">{h.count}번</span>}
              </div>
              {/* 근거 문장을 그대로 둔다. 왜 떴는지 못 읽으면 학생은
                  "그냥 AI 가 그랬대" 로 받아들이고 아무거나 잇게 된다. */}
              <p className="nlink-hint-why">{h.sentence}</p>
              <div className="nlink-hint-act">
                <Btn v="secondary" s="sm" disabled={busy} onClick={() => connect(otherId)}>잇기</Btn>
                <button
                  type="button" className="nlink-hint-skip"
                  onClick={() => setSkipped((prev) => new Set(prev).add(otherId))}
                >
                  아니요
                </button>
              </div>
            </div>
          );
        })}
      </Section>
    )}
    </>
  );
}
