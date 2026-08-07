/**
 * 둘러보기 — 그래프 **전체**에 대한 물음을 한자리에 모은다.
 *
 * 예전에는 "빈 곳"과 "관계 찾기"가 툴바의 서로 다른 단추였고 각자 패널을 세웠으며,
 * "확장 추천"은 아예 다른 화면(S23)이라 사이드바에서 닿지도 않았다. 셋 다 묻는
 * 것이 같다 — **이 그래프에서 다음에 무엇을 볼까.** 물음이 같으면 자리도 같아야 한다.
 *
 * 노드 하나에 대한 가지치기(`api.pruning.*`)는 여기가 아니라 노드 패널에 있다.
 * 범위가 다르면 자리도 다르다 — 그래프 전체와 노드 하나는 다른 물음이다.
 *
 * 각 구획은 **열 때 처음 불러온다.** 셋을 한꺼번에 부르면 둘러보기를 여는 것만으로
 * 요청이 셋 나가는데, 학생이 실제로 보는 것은 대개 하나다.
 */
import { useCallback, useEffect, useState } from "react";
import TDS from "../../theme/tokens.js";
import { Btn } from "../ui.jsx";
import api from "../../api/index.js";
import { Section } from "./GraphPanel.jsx";
import { GraphGaps } from "./GraphGaps.jsx";
import { LinkSuggestions } from "./LinkSuggestions.jsx";

/** 그래프 전체 확장 추천 — 채택하면 키워드 노드가 하나 생긴다. */
function ExpandSuggestions({ state, decisions, busyId, onAccept, onSkip, onRetry }) {
  if (state?.loading) {
    return <p style={{ fontSize: 12.5, color: TDS.textTertiary, margin: 0 }}>추천을 불러오는 중…</p>;
  }
  if (state?.error) {
    return (
      <div>
        <p style={{ fontSize: 12.5, color: TDS.textCaution, margin: "0 0 8px" }}>{state.error}</p>
        <Btn v="secondary" s="sm" onClick={onRetry}>다시 시도</Btn>
      </div>
    );
  }
  const items = state?.items ?? [];
  if (!items.length) {
    return (
      <p style={{ fontSize: 12.5, color: TDS.textTertiary, lineHeight: 1.6, margin: 0, wordBreak: "keep-all" }}>
        추천할 것이 없습니다. 시드 키워드를 더 넣거나 생기부를 올리면 뻗어 갈 곳이 생깁니다.
      </p>
    );
  }
  return (
    <>
      {items.map((r) => {
        const done = decisions[r.id];
        return (
          <div key={r.id} className="gsug" style={{ opacity: done ? 0.5 : 1 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: TDS.textPrimary, overflowWrap: "anywhere" }}>
                {r.label}
              </div>
              {r.reason && (
                <div style={{ fontSize: 11.5, color: TDS.textTertiary, lineHeight: 1.55, marginTop: 2, wordBreak: "keep-all" }}>
                  {r.reason}
                </div>
              )}
            </div>
            {done
              ? <span style={{ fontSize: 11.5, color: TDS.textTertiary, flexShrink: 0 }}>{done}</span>
              : (
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <Btn v="primary" s="sm" disabled={busyId === r.id} onClick={() => onAccept(r)}>
                    {busyId === r.id ? "추가 중…" : "추가"}
                  </Btn>
                  <Btn v="ghost" s="sm" onClick={() => onSkip(r)}>넘기기</Btn>
                </div>
              )}
          </div>
        );
      })}
    </>
  );
}

export function GraphExplore({ onOpenDoc, onPickNode, onConnect, onGraphChanged, onError }) {
  // 어떤 구획이 열려 있는가. 빈 곳이 기본으로 열린다 — 둘러보기를 누르는 까닭이
  // 대개 "내가 뭘 빠뜨렸지"이기 때문이다.
  const [open, setOpen] = useState({ gaps: true, links: false, expand: false });
  const [gaps, setGaps] = useState(null);
  const [links, setLinks] = useState(null);
  const [linkBusy, setLinkBusy] = useState(null);
  const [sugg, setSugg] = useState(null);
  const [suggBusy, setSuggBusy] = useState(null);
  const [decisions, setDecisions] = useState({});

  const loadGaps = useCallback(async () => {
    setGaps({ loading: true });
    try { setGaps({ loading: false, ...(await api.graph.gaps()) }); }
    catch (e) { setGaps({ loading: false, error: e.message || "찾지 못했습니다." }); }
  }, []);

  const loadLinks = useCallback(async () => {
    setLinks({ loading: true });
    try { setLinks({ loading: false, items: await api.graph.suggestedLinks(30) }); }
    catch (e) { setLinks({ loading: false, error: e.message || "찾지 못했습니다." }); }
  }, []);

  const loadSugg = useCallback(async () => {
    setSugg({ loading: true });
    try { setSugg({ loading: false, items: await api.graph.pruneSuggestions() }); }
    catch (e) { setSugg({ loading: false, error: e.message || "찾지 못했습니다." }); }
  }, []);

  // 기본으로 열려 있는 구획만 처음에 부른다.
  useEffect(() => { loadGaps(); }, [loadGaps]);

  // 불러오기는 setState 바깥에서 한다. 갱신 함수 안에 부수효과를 두면 React 가
  // 개발 모드에서 그 함수를 두 번 부르면서 요청도 두 번 나간다.
  const toggle = (key, load, state) => {
    if (!open[key] && !state) load();   // 처음 열 때만 부른다
    setOpen((o) => ({ ...o, [key]: !o[key] }));
  };

  const dropLink = (s) =>
    setLinks((cur) => (cur?.items
      ? { ...cur, items: cur.items.filter((x) => !(x.source_id === s.source_id && x.target_id === s.target_id)) }
      : cur));

  const acceptLink = async (s) => {
    setLinkBusy(`${s.source_id}-${s.target_id}`);
    try { await onConnect(s.source_id, s.target_id); dropLink(s); }
    catch (e) { onError(e.message || "잇지 못했습니다."); }
    finally { setLinkBusy(null); }
  };

  const acceptSugg = async (r) => {
    setSuggBusy(r.id);
    try {
      await api.graph.acceptSuggestion(r.label);
      setDecisions((d) => ({ ...d, [r.id]: "추가됨" }));
      await onGraphChanged();
    } catch (e) {
      onError(e.message || "추가하지 못했습니다.");
    } finally {
      setSuggBusy(null);
    }
  };

  const gapCount = gaps && !gaps.loading && !gaps.error
    ? (gaps.empty_subjects?.length ?? 0) + (gaps.lonely_nodes?.length ?? 0) + (gaps.faded_topics?.length ?? 0)
    : null;

  return (
    <>
      <Section
        title="빈 곳"
        count={gapCount}
        open={open.gaps}
        onToggle={() => toggle("gaps", loadGaps, gaps)}
      >
        <GraphGaps state={gaps} onRetry={loadGaps} onOpenDoc={onOpenDoc} onPickNode={onPickNode} />
      </Section>

      <Section
        title="이어 볼 만한 짝"
        count={links && !links.loading && !links.error ? (links.items?.length ?? 0) : null}
        open={open.links}
        onToggle={() => toggle("links", loadLinks, links)}
      >
        <LinkSuggestions
          state={links}
          busyId={linkBusy}
          onAccept={acceptLink}
          onSkip={dropLink}
          onRetry={loadLinks}
        />
      </Section>

      <Section
        title="넓혀 볼 만한 주제"
        count={sugg && !sugg.loading && !sugg.error ? (sugg.items?.length ?? 0) : null}
        open={open.expand}
        onToggle={() => toggle("expand", loadSugg, sugg)}
      >
        <ExpandSuggestions
          state={sugg}
          decisions={decisions}
          busyId={suggBusy}
          onAccept={acceptSugg}
          onSkip={(r) => setDecisions((d) => ({ ...d, [r.id]: "넘김" }))}
          onRetry={loadSugg}
        />
      </Section>
    </>
  );
}
