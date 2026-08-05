/**
 * 이어 볼 만한 노드 짝.
 *
 * 지금 그래프의 선은 거의 전부 "이 노드가 생기부에 나왔다" 하나뿐이다. 60개
 * 선이 같은 뜻이라, 선을 아무리 진하게 그려도 읽을 것이 없다. 학생이 알고 싶은
 * 것은 문서와의 관계가 아니라 **개념끼리의 관계**다.
 *
 * 그래서 생기부 **같은 문장**에 함께 적혀 있던 짝을 찾아 보여준다. 근거는
 * 그 문장 하나뿐이고, 그 문장을 그대로 함께 보여준다 — 읽어 보고 이을지 말지는
 * 학생이 정한다. 자동으로 잇지 않는 이유: 근거가 약한 연결이 늘면 그래프가
 * 다시 못 읽는 그림이 된다.
 */

import TDS from "../../theme/tokens.js";
import { NavIcon } from "../NavIcon.jsx";
import { Btn } from "../ui.jsx";

export function LinkSuggestions({ state, onAccept, onSkip, onRetry, busyId }) {
  if (state?.loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12 }}>
        <div className="spinner" />
        <span style={{ fontSize: 13, color: TDS.textSecondary }}>생기부에서 함께 나온 낱말을 찾는 중…</span>
      </div>
    );
  }

  if (state?.error) {
    return (
      <div style={{ padding: 12 }}>
        <p style={{ fontSize: 13, color: TDS.danger, margin: "0 0 8px" }}>{state.error}</p>
        <Btn v="secondary" s="sm" onClick={onRetry}>다시 시도</Btn>
      </div>
    );
  }

  const items = state?.items || [];
  if (!items.length) {
    return (
      <p style={{ fontSize: 12.5, color: TDS.textTertiary, lineHeight: 1.6, wordBreak: "keep-all", margin: 0 }}>
        같은 문장에 함께 나온 짝을 더 찾지 못했습니다. 생기부를 더 채우거나, 노드를
        직접 이어 보세요.
      </p>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: TDS.textTertiary, lineHeight: 1.6, margin: "0 0 12px", wordBreak: "keep-all" }}>
        생기부 <strong style={{ color: TDS.textSecondary }}>같은 문장</strong>에 함께 적혀 있던 짝입니다.
        문장을 보고 이을지 정하세요.
      </p>

      {items.map((s) => (
        <div key={`${s.source_id}-${s.target_id}`} className="lnk-card">
          <div className="lnk-pair">
            <span className="lnk-name">{s.source_label}</span>
            <NavIcon name="link" size={13} color={TDS.textTertiary} />
            <span className="lnk-name">{s.target_label}</span>
          </div>
          <div className="lnk-where">
            {s.section_label}
            {s.count > 1 && <span className="lnk-count">{s.count}문장</span>}
          </div>
          {/* 근거 문장 — 출처 문장(NodeEvidence)과 같은 재질이라 뜻도 같게 읽힌다 */}
          <p className="lnk-quote">{s.sentence}</p>
          <div className="lnk-acts">
            <Btn v="primary" s="sm" disabled={!!busyId} onClick={() => onAccept(s)}>
              {busyId === `${s.source_id}-${s.target_id}` ? "잇는 중…" : "잇기"}
            </Btn>
            <Btn v="ghost" s="sm" disabled={!!busyId} onClick={() => onSkip(s)}>넘기기</Btn>
          </div>
        </div>
      ))}
    </div>
  );
}
