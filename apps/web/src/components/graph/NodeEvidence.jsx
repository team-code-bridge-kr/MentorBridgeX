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

/**
 * 문장을 못 찾았을 때 왜 없는지. 빈칸만 두면 고장으로 읽힌다.
 *
 * 두 줄로 나눈다 — 첫 줄은 **무슨 일이 있었나**, 둘째 줄은 **왜 그럴 수
 * 있나**. 한 문단으로 이으면 두 문장이 한 덩이로 읽혀서, 정작 알아야 할
 * "찾지 못했다" 가 뒤의 추측에 묻힌다.
 */
const EMPTY_TEXT = {
  student: ["직접 만든 노드라 생기부에서 온 문장이 없습니다."],
  branch: ["가지치기 추천으로 만들어진 노드입니다.", "생기부에는 아직 없는 내용입니다."],
  document: [
    "생기부에서 이 표현을 찾지 못했습니다.",
    "표현이 조금 다르거나, 생기부를 아직 올리지 않았을 수 있습니다.",
  ],
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

/** 접혀 있을 때 세우는 문장 수. 이만큼이면 "왜 이 노드가 있는지" 는 판단된다. */
const PREVIEW = 3;

export function NodeEvidence({ nodeId, label, sectionId = "", onOpen }) {
  const [state, setState] = useState({ loading: true });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;
    setExpanded(false);   // 다른 노드를 골랐으면 접힌 채로 다시 시작한다
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
  const shown = expanded ? quotes : quotes.slice(0, PREVIEW);
  // 접혀 있을 때 몇 개가 더 있는지. 서버가 30개까지만 주므로, 그보다 많으면
  // "받아 온 만큼" 이 아니라 **실제 개수**로 세어야 말이 맞는다.
  const hidden = Math.max(state.total || 0, quotes.length) - shown.length;

  // 「생기부에서 열기」가 데려갈 곳. 맨 앞 문장이 실린 구획이 우선이다 —
  // 화면에서 가장 먼저 읽는 문장이 거기 있으니, 원문을 펴도 같은 자리다.
  // 문장이 하나도 없으면 노드 자신이 곧 구획인 경우(뼈대 노드)로 떨어진다.
  const openTarget = quotes.find((q) => q.sectionId)?.sectionId || sectionId;

  return (
    <div>
      {/* "출처 문장" 과 "생기부 N곳" 을 걷었다. 바로 위에 「출처」 머리글이
          서 있어 같은 말을 두 번 했고, 개수는 인용문 아래 「+N건 더 보기」가
          이미 말한다 — 회색 글씨 두 줄이 정작 읽어야 할 인용문을 밀어냈다. */}
      {state.loading && (
        <p style={{ fontSize: 12, color: TDS.textDisabled, margin: 0 }}>생기부에서 찾는 중…</p>
      )}

      {!state.loading && state.error && (
        <p style={{ fontSize: 12, color: TDS.textTertiary, margin: 0 }}>
          출처를 불러오지 못했습니다.
        </p>
      )}

      {/* 「양식 올리기」 자리(.form-drop)와 같은 옷. 둘 다 "여기 아직 아무것도
          없다" 를 말하는 자리라 같은 모양이어야 한다. 다만 누르는 자리가
          아니므로 손 모양도 hover 도 없다. */}
      {!state.loading && !state.error && !quotes.length && (
        <div className="ev-empty">
          <span className="ev-empty-ic">
            <NavIcon name="record" size={20} color={TDS.primary} />
          </span>
          {(EMPTY_TEXT[state.origin] || EMPTY_TEXT.document).map((line, i) => (
            <p key={i} className={i === 0 ? "ev-empty-t" : "ev-empty-s"}>{line}</p>
          ))}
        </div>
      )}

      {shown.map((q, i) => (
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

      {/* "이 밖에 4곳에서 더 나옵니다." 는 알려만 주고 길이 없었다 — 더 있다는
          걸 아는데 볼 수가 없으면 알려 주지 않느니만 못하다. 눌러서 편다. */}
      {hidden > 0 && !expanded && (
        <button type="button" className="ev-more" onClick={() => setExpanded(true)}>
          +{hidden}건 더 보기
        </button>
      )}
      {expanded && quotes.length > PREVIEW && (
        <button type="button" className="ev-more" onClick={() => setExpanded(false)}>
          접기
        </button>
      )}
      {/* 서른을 넘으면 나머지는 못 받아 왔다. 없는 것처럼 두면 개수가 어긋난다. */}
      {expanded && (state.total || 0) > quotes.length && (
        <p style={{ fontSize: 11.5, color: TDS.textTertiary, margin: "6px 0 0" }}>
          너무 많아 {quotes.length}개까지만 보여드립니다 (모두 {state.total}곳).
        </p>
      )}

      {/* 원문으로 가는 길. 뼈대 노드든 낱말 노드든 **늘 같은 자리에 같은 말**로
          선다 — 예전에는 뼈대 노드에만 있어서, 어떤 노드는 나오고 어떤 노드는
          안 나오는 것처럼 보였다. */}
      {!state.loading && openTarget && onOpen && (
        <button type="button" className="node-open" onClick={() => onOpen(openTarget)}>
          생기부에서 열기 →
        </button>
      )}
    </div>
  );
}
