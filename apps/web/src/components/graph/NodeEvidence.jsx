/**
 * 노드의 출처 문장.
 *
 * 그래프에는 낱말만 남는다. 그러다 보니 학생은 "이게 왜 내 그래프에 있지?" 를
 * 알 수 없고, 잘못 뽑힌 노드인지 아닌지도 판단할 수 없다. 그래서 **그 낱말이
 * 실제로 적혀 있던 생기부 문장**을 함께 보여준다.
 *
 * 원문을 다 옮기지 않는다. 코드 변경분을 볼 때처럼 **바뀐 자리 둘레만** 잘라
 * 보여주고, 노드 이름에 해당하는 부분을 강조한다. 나머지는 개수로만 알린다 —
 * 여기는 문서를 읽는 자리가 아니라 노드를 판단하는 자리다.
 */

import { useEffect, useState } from "react";
import TDS from "../../theme/tokens.js";
import { NavIcon } from "../NavIcon.jsx";
import api from "../../api/index.js";

// 문장을 못 찾았을 때 왜 없는지. 빈칸만 두면 고장으로 읽힌다.
const EMPTY_TEXT = {
  student: "직접 만든 노드라 생기부에서 온 문장이 없습니다.",
  branch: "가지치기 추천으로 만들어진 노드입니다. 생기부에는 아직 없는 내용입니다.",
  document: "생기부에서 이 표현을 찾지 못했습니다. 표현이 조금 다르거나, 생기부를 아직 올리지 않았을 수 있습니다.",
};

/** 문장에서 노드 이름 부분만 강조해 그린다. */
function Quoted({ text, start, end }) {
  const safe = start >= 0 && end > start && end <= text.length;
  if (!safe) return <>{text}</>;
  return (
    <>
      {text.slice(0, start)}
      <mark
        style={{
          background: TDS.blue50,
          color: TDS.primary,
          fontWeight: 700,
          borderRadius: 4,
          padding: "1px 2px",
        }}
      >
        {text.slice(start, end)}
      </mark>
      {text.slice(end)}
    </>
  );
}

export function NodeEvidence({ nodeId, label }) {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let alive = true;
    setState({ loading: true });
    api.graph
      .nodeEvidence(nodeId)
      .then((data) => alive && setState({ loading: false, ...data }))
      .catch(() => alive && setState({ loading: false, error: true }));
    return () => {
      alive = false;
    };
  }, [nodeId, label]); // 이름을 고치면 찾을 낱말도 달라진다.

  const quotes = state.quotes || [];
  const more = (state.total || 0) - quotes.length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: TDS.textTertiary, margin: 0 }}>출처 문장</p>
        {state.total > 0 && (
          <span style={{ fontSize: 11, color: TDS.textTertiary }}>생기부 {state.total}곳</span>
        )}
      </div>

      {state.loading && (
        <p style={{ fontSize: 12, color: TDS.textDisabled, margin: 0 }}>생기부에서 찾는 중…</p>
      )}

      {!state.loading && state.error && (
        <p style={{ fontSize: 12, color: TDS.textTertiary, margin: 0 }}>
          출처를 불러오지 못했습니다.
        </p>
      )}

      {!state.loading && !state.error && !quotes.length && (
        <p style={{ fontSize: 12, color: TDS.textTertiary, margin: 0, lineHeight: 1.6, wordBreak: "keep-all" }}>
          {EMPTY_TEXT[state.origin] || EMPTY_TEXT.document}
        </p>
      )}

      {quotes.map((q, i) => (
        <div
          key={i}
          style={{
            borderLeft: `3px solid ${TDS.blue200}`,
            background: TDS.surfaceZebra,
            borderRadius: "0 8px 8px 0",
            padding: "9px 11px",
            marginBottom: 7,
          }}
        >
          {q.sectionLabel && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
              <NavIcon name="record" size={11} color={TDS.textTertiary} />
              <span style={{ fontSize: 11, fontWeight: 700, color: TDS.textTertiary }}>
                {q.sectionLabel}
              </span>
            </div>
          )}
          <p style={{ fontSize: 12.5, color: TDS.textSecondary, margin: 0, lineHeight: 1.7, wordBreak: "keep-all" }}>
            <Quoted text={q.text} start={q.start} end={q.end} />
          </p>
        </div>
      ))}

      {more > 0 && (
        <p style={{ fontSize: 11.5, color: TDS.textTertiary, margin: "2px 0 0" }}>
          이 밖에 {more}곳에서 더 나옵니다.
        </p>
      )}
    </div>
  );
}
