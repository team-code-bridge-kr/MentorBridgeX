import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { GRAPH_CANVAS, KIND_META, OVERLAY_SURFACE, OVERLAY_TEXT, Z, ZOOM } from "../../theme/graphMeta.js";
import { iconForNode, SUBJECT_LEGEND } from "../../theme/nodeIcons.js";
import { visualEdgesOf } from "../../theme/graphView.js";
import { Btn, Badge, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";
import api from "../../api/index.js";
import { NodeConnections, NodeDeleteConfirm, NodeEditor } from "../../components/graph/NodeEditor.jsx";
import { NodeEvidence } from "../../components/graph/NodeEvidence.jsx";
import { LinkSuggestions } from "../../components/graph/LinkSuggestions.jsx";
import { GraphGaps } from "../../components/graph/GraphGaps.jsx";

// 라벨 pill 이 지나치게 길어지지 않도록 자르는 기준 (전체 문구는 title 로 노출).
const LABEL_MAX = 14;

// 밝은 판 위의 연결선 색.
//
// 예전에는 rgba(15,23,42,.16) 에 굵기 0.3 이었다. non-scaling-stroke 라 굵기가
// 그대로 화면 픽셀이 되는데, 0.3px 는 화면에서 사실상 보이지 않는다 —
// 노드만 떠 있고 무엇과 무엇이 이어졌는지 알 수 없었다.
const GRAPH_EDGE = "rgba(15,23,42,.30)";
// 굵기(px). 활성(고른 노드에 걸린 선) > 가지 > 보통 순.
const EDGE_W = { on: 2.2, branch: 1.4, base: 1.1 };

// 선택 노드와 무관한 노드를 살짝만 내린다. 너무 흐리면 전체 지도를 못 읽는다.
const DIM_OPACITY = 0.34;
// 선택 라벨 카드가 캔버스 밖으로 나가지 않도록 남겨 두는 좌우 여백(px).
const LABEL_EDGE_PAD = 90;

/**
 * 라벨 배치.
 *
 * 라벨을 노드 안에 같이 그리면 두 가지가 망가진다. 확대할 때 글자까지 같이
 * 커져서 아무리 확대해도 빽빽함이 그대로고, 이웃 노드의 라벨끼리 겹쳐 무엇도
 * 읽히지 않는다(126개 노드에서 실제로 그랬다).
 *
 * 그래서 라벨은 **줌 바깥의 화면 좌표**에 그리고, 자리가 겹치면 덜 중요한 쪽을
 * 지운다. 확대하면 노드 사이가 벌어지므로 자연스럽게 더 많은 이름이 드러난다 —
 * "확대하면 글자가 나온다"는 게 따로 만든 기능이 아니라 이 규칙의 결과다.
 */
const LABEL_FONT = 11.5;   // 확대해도 이 크기 그대로다
const LABEL_H = 19;
const LABEL_GAP = 5;       // 노드 아래 띄우는 거리
const LABEL_MARGIN = 3;    // 라벨끼리 최소로 벌리는 거리

// 자동 포커싱 — 고른 노드로 데려갈 때의 최소 배율과 걸리는 시간.
// 1.35 는 "이름이 읽히기 시작하는" 배율이다. 더 키우면 고른 노드만 남고 둘레가
// 사라져서, 무엇 옆에 있던 노드인지 알 수 없게 된다.
const FOCUS_SCALE = 1.35;
const FLY_MS = 380;

const overlaps = (a, b) =>
  a.x1 < b.x2 + LABEL_MARGIN && a.x2 + LABEL_MARGIN > b.x1 &&
  a.y1 < b.y2 + LABEL_MARGIN && a.y2 + LABEL_MARGIN > b.y1;

// 가지치기 추천 유형별 표시 정보.
const BRANCH_META = {
  DEPTH:    { label: "심화", color: "#3182f6" },
  FUSION:   { label: "융합", color: "#8b5cf6" },
  ACTIVITY: { label: "활동", color: "#22c55e" },
};

export function S06({ onNav }) {
  const { state, actions } = useStore();
  const { nodes, edges, loading } = state.graph;
  const [sel, setSel] = useState(null);
  const [hover, setHover] = useState(null);
  const [q, setQ] = useState("");
  const [comments, setComments] = useState([]);
  // 가지치기 추천 1단계 — { nodeId, loading, error, items }
  const [prune, setPrune] = useState(null);
  // 2단계(관련 자료 찾기) — 추천 id 별 { loading, error, data }
  const [research, setResearch] = useState({});
  // '이 주제로 확장' 진행 중인 추천 id
  const [expanding, setExpanding] = useState(null);
  // 노드 직접 만들기·고치기·지우기.
  // AI 가 뽑아 준 결과가 늘 맞지는 않는다 — 학생이 그 자리에서 고칠 수 없으면
  // 그래프는 남의 것이 된다. 그래서 편집을 그래프 화면 안에 둔다.
  const [creating, setCreating] = useState(false);
  // 이어 볼 만한 짝 — { loading, error, items }
  const [links, setLinks] = useState(null);
  const [linkBusy, setLinkBusy] = useState(null);
  // 빈 곳 — { loading, error, empty_subjects, lonely_nodes, faded_topics }
  const [gaps, setGaps] = useState(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  // 노드 위치 로컬 상태 (드래그로 변경)
  const [positions, setPositions] = useState({});
  // 드래그 상태: { id, startCX, startCY, origXpct, origYpct, moved }
  const dragging = useRef(null);
  const canvasRef = useRef(null);
  // 줌·팬 상태. tx/ty 는 화면 픽셀 이동량, scale 은 배율.
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const [grabbing, setGrabbing] = useState(false);
  // 자동 포커싱으로 화면이 움직이는 동안만 true. 이때만 부드럽게 움직인다.
  const [flying, setFlying] = useState(false);
  const panning = useRef(null);
  // 콜백 안에서 최신 배율을 읽기 위한 거울. state 를 의존성에 넣으면
  // 드래그 핸들러가 매 프레임 새로 만들어진다.
  const viewRef = useRef(view);
  // 자동 포커싱은 "선택이 바뀔 때만" 돌아야 한다. positions 를 의존성에 넣으면
  // 노드를 끌 때마다 화면이 따라 움직인다.
  const positionsRef = useRef(positions);

  // 최초 진입 시 그래프가 비어있으면 로드
  useEffect(()=>{ if(!nodes.length && !loading) actions.loadGraph(state.session?.user?.id); /* eslint-disable-next-line */ }, []);
  // 선택 노드가 삭제되면 패널 닫기
  useEffect(()=>{ if(sel && !nodes.find(n=>n.id===sel.id)) setSel(null); }, [nodes, sel]);
  // 다른 노드를 고르면 이전 노드의 추천은 버린다 (엉뚱한 노드의 카드가 남지 않도록)
  useEffect(()=>{
    if (prune && prune.nodeId !== sel?.id) { setPrune(null); setResearch({}); }
  }, [sel, prune]);
  // 코멘트 초기 로드
  useEffect(()=>{ api.comments.list().then(setComments).catch(()=>{}); }, []);
  // 새 노드가 생기면 positions 에 추가 (이미 드래그로 옮긴 노드는 덮어쓰지 않음)
  useEffect(()=>{
    setPositions(prev=>{
      const next = {...prev};
      nodes.forEach(n=>{ if(!next[n.id]) next[n.id]={x:n.x,y:n.y}; });
      Object.keys(next).forEach(id=>{ if(!nodes.find(n=>n.id===id)) delete next[id]; });
      return next;
    });
  }, [nodes]);

  const nodeById = id => nodes.find(n=>n.id===id);
  const edgesOf = id => edges.filter(e=>e.from===id||e.to===id);

  // 화면에 그릴 선 — 규칙은 theme/graphView.js (대시보드 미리보기와 공유)
  const visualEdges = useMemo(() => visualEdgesOf(nodes, edges), [nodes, edges]);

  const matched = q.trim() ? nodes.filter(n=>n.label.includes(q.trim())).map(n=>n.id) : null;
  const activeId = hover || sel?.id || null;
  const activeNode = activeId ? nodes.find(n=>n.id===activeId) : null;
  const connectedIds = activeId
    ? new Set(visualEdges.filter(e=>e.from===activeId||e.to===activeId).flatMap(e=>[e.from,e.to]))
    : null;
  const getPos = useCallback((n) => positions[n.id] || {x:n.x, y:n.y}, [positions]);

  // 캔버스 실제 크기. 라벨을 화면 좌표에 놓으려면 픽셀 크기를 알아야 한다.
  const [canvasBox, setCanvasBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setCanvasBox((b) => (b.w === width && b.h === height ? b : { w: width, h: height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** 노드의 화면 좌표(px). 줌·팬을 그대로 반영한다. */
  const screenOf = useCallback((n) => {
    const pos = getPos(n);
    return {
      x: (parseFloat(pos.x) / 100) * canvasBox.w * view.scale + view.tx,
      y: (parseFloat(pos.y) / 100) * canvasBox.h * view.scale + view.ty,
      r: (n.size / 2) * view.scale,
    };
  }, [getPos, canvasBox, view]);

  /**
   * 이번 화면에서 이름을 보여줄 노드들. 중요한 것부터 자리를 잡고, 이미 놓인
   * 라벨이나 노드와 겹치면 건너뛴다. 노드 자체도 장애물로 둔다 — 남의 이름표가
   * 동그라미를 덮으면 그 노드가 없는 것처럼 보인다.
   */
  const shownLabels = useMemo(() => {
    if (!canvasBox.w || !nodes.length) return new Map();
    const rank = (n) => {
      if (n.id === activeId) return 0;
      if (matched?.includes(n.id)) return 1;
      if (connectedIds?.has(n.id)) return 2;
      if (n.kind === "root") return 3;
      if (n.kind === "topic") return 4;
      return 5;
    };
    const cands = nodes
      .map((n) => ({ n, s: screenOf(n), rank: rank(n) }))
      // 화면 밖은 계산에서 뺀다. 안 보이는 자리를 두고 다투게 두면 정작 보이는
      // 노드의 이름이 밀려난다.
      .filter(({ s }) => s.x > -80 && s.x < canvasBox.w + 80 && s.y > -40 && s.y < canvasBox.h + 40)
      // 다 축소한 상태에서는 말단 노드 이름까지 다투게 두지 않는다(지도가 흐려진다).
      .filter(({ n }) => view.scale >= 0.85 || n.kind !== "leaf" || rank(n) <= 2)
      .sort((a, b) => a.rank - b.rank || b.n.size - a.n.size);

    // 노드 동그라미부터 장애물로 깔아 둔다.
    const blocks = cands.map(({ s }) => ({ x1: s.x - s.r, x2: s.x + s.r, y1: s.y - s.r, y2: s.y + s.r }));
    const out = new Map();
    for (const { n, s, rank: r } of cands) {
      const text = n.label.length > LABEL_MAX ? `${n.label.slice(0, LABEL_MAX)}…` : n.label;
      const w = text.length * LABEL_FONT * 0.92 + 16;
      // 아래가 막혔으면 위·오른쪽·왼쪽 순으로 자리를 옮겨 본다. 한 자리만
      // 보고 포기하면 빽빽한 곳에서 이름이 통째로 사라진다.
      const spots = [
        { x: s.x, y: s.y + s.r + LABEL_GAP },
        { x: s.x, y: s.y - s.r - LABEL_GAP - LABEL_H },
        { x: s.x + s.r + LABEL_GAP + w / 2, y: s.y - LABEL_H / 2 },
        { x: s.x - s.r - LABEL_GAP - w / 2, y: s.y - LABEL_H / 2 },
      ];
      const boxAt = (p) => ({ x1: p.x - w / 2, x2: p.x + w / 2, y1: p.y, y2: p.y + LABEL_H });
      let box = spots.map(boxAt).find((b) => !blocks.some((o) => overlaps(b, o)));
      // 지금 보고 있는 노드와 검색에 걸린 노드는 자리가 없어도 반드시 보여준다.
      if (!box && r <= 1) box = boxAt(spots[0]);
      if (!box) continue;
      const top = box.y1;
      blocks.push(box);
      // 노드가 흐려졌으면 이름표도 같이 흐려져야 한다. 안 그러면 검색해서
      // 걸러 낸 노드의 이름만 또렷하게 떠 있는다.
      const dim =
        (matched && !matched.includes(n.id)) ||
        (connectedIds && n.id !== activeId && !connectedIds.has(n.id));
      out.set(n.id, { text, left: (box.x1 + box.x2) / 2, top, dim: !!dim });
    }
    return out;
  }, [nodes, canvasBox, screenOf, view.scale, activeId, matched, connectedIds]);

  // ── 드래그 핸들러 ────────────────────────────────────────
  const onNodeDown = useCallback((e, n) => {
    e.preventDefault();
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = getPos(n);
    dragging.current = {
      id: n.id,
      startCX: e.clientX,
      startCY: e.clientY,
      origX: parseFloat(pos.x),
      origY: parseFloat(pos.y),
      moved: false,
    };
  }, [getPos]);

  const onCanvasMove = useCallback((e) => {
    const pan = panning.current;
    if (pan) {
      setView(v => ({ ...v, tx: pan.tx0 + (e.clientX - pan.cx), ty: pan.ty0 + (e.clientY - pan.cy) }));
      return;
    }
    const d = dragging.current;
    if (!d) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dx = e.clientX - d.startCX;
    const dy = e.clientY - d.startCY;
    if (!d.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    dragging.current.moved = true;
    // 확대된 상태에서는 화면에서 1px 움직여도 그래프 좌표로는 1/scale 만 움직인다.
    const s = viewRef.current.scale;
    const newX = Math.max(4, Math.min(96, d.origX + (dx / rect.width) * 100 / s));
    const newY = Math.max(4, Math.min(96, d.origY + (dy / rect.height) * 100 / s));
    setPositions(prev => ({...prev, [d.id]: {x:`${newX.toFixed(1)}%`, y:`${newY.toFixed(1)}%`}}));
  }, []);

  const onCanvasUp = useCallback((e) => {
    if (panning.current) { panning.current = null; setGrabbing(false); return; }
    const d = dragging.current;
    dragging.current = null;
    if (!d) return;
    if (!d.moved) {
      const n = nodes.find(n=>n.id===d.id);
      if (n) { setLinks(null); setGaps(null); setSel(s => s?.id===n.id ? null : n); }
    }
  }, [nodes]);

  // ── 줌 · 팬 ─────────────────────────────────────────────
  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => { positionsRef.current = positions; }, [positions]);

  const clampScale = (s) => Math.min(ZOOM.max, Math.max(ZOOM.min, s));

  /** 화면의 한 점을 고정한 채 배율만 바꾼다 (커서 아래가 그대로 있게). */
  const zoomAt = useCallback((factor, px, py) => {
    setView(v => {
      const scale = clampScale(v.scale * factor);
      if (scale === v.scale) return v;
      // 화면좌표 = 그래프좌표 * scale + t  ->  t' = px - 그래프좌표 * scale'
      const gx = (px - v.tx) / v.scale;
      const gy = (py - v.ty) / v.scale;
      return { scale, tx: px - gx * scale, ty: py - gy * scale };
    });
  }, []);

  /** 버튼용 — 캔버스 한가운데를 기준으로 확대·축소한다. */
  const zoomByButton = useCallback((factor) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    zoomAt(factor, (rect?.width ?? 0) / 2, (rect?.height ?? 0) / 2);
  }, [zoomAt]);

  const resetView = useCallback(() => setView({ scale: 1, tx: 0, ty: 0 }), []);

  /**
   * 고른 노드를 화면 한가운데로 데려온다.
   *
   * 126개짜리 그래프에서는 어느 노드를 눌렀는지 눈으로 되짚기가 어렵다. 게다가
   * 오른쪽 상세 패널이 열리면서 캔버스가 좁아져, 방금 누른 노드가 패널 뒤로
   * 숨는 일까지 있었다. 패널이 열린 **뒤의** 크기를 재서 그 가운데로 옮긴다.
   */
  const focusNode = useCallback((node) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect?.width || !node) return;
    const pos = positionsRef.current[node.id] || { x: node.x, y: node.y };
    const gx = (parseFloat(pos.x) / 100) * rect.width;
    const gy = (parseFloat(pos.y) / 100) * rect.height;
    setFlying(true);
    setView((v) => {
      // 이미 충분히 확대돼 있으면 배율은 건드리지 않는다 — 볼 만큼 키워 둔
      // 화면을 마음대로 되돌리지 않기 위해서다.
      const scale = clampScale(Math.max(v.scale, FOCUS_SCALE));
      return { scale, tx: rect.width / 2 - gx * scale, ty: rect.height / 2 - gy * scale };
    });
  }, []);

  // 움직임이 끝나면 애니메이션을 끈다. 켜 둔 채로 두면 휠 줌·드래그가 끈적해진다.
  useEffect(() => {
    if (!flying) return undefined;
    const t = setTimeout(() => setFlying(false), FLY_MS + 40);
    return () => clearTimeout(t);
  }, [flying]);

  // 노드를 고르면 따라간다. sel 이 바뀔 때만 — 그 뒤 사용자가 화면을 끌어
  // 옮겨 놓은 것을 다시 가운데로 되돌리면 안 된다.
  useEffect(() => {
    if (!sel) return;
    const node = nodes.find((n) => n.id === sel.id);
    if (node) focusNode(node);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [sel?.id]);

  // 검색해서 걸린 것이 있으면 첫 노드로 데려간다. 찾았는데 화면 밖에 있으면
  // 찾은 것이 아니다.
  const firstMatch = matched?.[0] || null;
  useEffect(() => {
    if (!firstMatch) return;
    const node = nodes.find((n) => n.id === firstMatch);
    if (node) focusNode(node);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [firstMatch]);

  // 휠 줌. React 의 onWheel 은 passive 로 붙어 preventDefault 가 먹지 않으므로
  // 직접 non-passive 로 등록한다 (안 하면 페이지가 같이 스크롤된다).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const onWheel = (e) => {
      // 범례처럼 스스로 스크롤되는 패널 위에서는 줌을 가로채지 않는다.
      if (e.target instanceof Element && e.target.closest("[data-graph-panel]")) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  /** 빈 배경을 누르면 화면 끌기. 노드는 stopPropagation 해서 여기로 안 온다. */
  const onCanvasDown = useCallback((e) => {
    if (e.button !== 0) return;
    const v = viewRef.current;
    panning.current = { cx: e.clientX, cy: e.clientY, tx0: v.tx, ty0: v.ty };
    setGrabbing(true);
  }, []);

  /** 빈 곳 — 없는 과목 / 이어지지 않은 개념 / 요즘 안 보이는 주제. */
  const findGaps = useCallback(async () => {
    setSel(null);
    setCreating(false);
    setLinks(null);
    setGaps({ loading: true });
    try {
      setGaps({ loading: false, ...(await api.graph.gaps()) });
    } catch (e) {
      setGaps({ loading: false, error: e.message || "찾지 못했습니다." });
    }
  }, []);

  /** 생기부 같은 문장에 함께 나온 짝 찾기. */
  const findLinks = useCallback(async () => {
    setSel(null);
    setCreating(false);
    setGaps(null);
    setLinks({ loading: true });
    try {
      setLinks({ loading: false, items: await api.graph.suggestedLinks(30) });
    } catch (e) {
      setLinks({ loading: false, error: e.message || "찾지 못했습니다." });
    }
  }, []);

  const dropLink = (s) =>
    setLinks((cur) => (cur?.items
      ? { ...cur, items: cur.items.filter((x) => !(x.source_id === s.source_id && x.target_id === s.target_id)) }
      : cur));

  const acceptLink = useCallback(async (s) => {
    setLinkBusy(`${s.source_id}-${s.target_id}`);
    try {
      await actions.connectNodes(s.source_id, s.target_id);
      dropLink(s);
    } catch (e) {
      actions.toast("error", e.message || "잇지 못했습니다.");
    } finally {
      setLinkBusy(null);
    }
  }, [actions]);

  /** 노드 만들기. 연결할 곳을 골랐으면 만든 뒤 바로 잇는다. */
  const handleCreate = useCallback(async ({ label, section, description, aliases, parentId }) => {
    setBusy(true);
    try {
      const node = await actions.addNode({ label, section, description, aliases });
      if (parentId && node?.id) await actions.connectNodes(parentId, node.id);
      else await actions.loadGraph();
      setCreating(false);
    } catch (e) {
      actions.toast("error", e.message || "노드를 추가하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }, [actions]);

  /** 노드 고치기. 이름·과목·설명을 한 번에 저장한다. */
  const handleEdit = useCallback(async ({ label, section, description, aliases }) => {
    if (!sel) return;
    setBusy(true);
    try {
      await actions.updateNode(sel.id, { label, section, description, aliases });
      setSel((cur) => (cur ? { ...cur, label, section: section || "기타", description, aliases } : cur));
      setEditing(false);
    } catch (e) {
      actions.toast("error", e.message || "노드를 수정하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }, [sel, actions]);

  const handleDelete = useCallback(async () => {
    if (!sel) return;
    setBusy(true);
    try {
      await actions.deleteNode(sel.id);
      setConfirmDelete(false);
      setSel(null);
    } catch (e) {
      actions.toast("error", e.message || "노드를 삭제하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }, [sel, actions]);

  const handleConnect = useCallback(async (targetId) => {
    if (!sel) return;
    setBusy(true);
    try { await actions.connectNodes(sel.id, targetId); }
    catch (e) { actions.toast("error", e.message || "연결하지 못했습니다."); }
    finally { setBusy(false); }
  }, [sel, actions]);

  const handleDisconnect = useCallback(async (edgeId) => {
    setBusy(true);
    try { await actions.disconnectNodes(edgeId); }
    catch (e) { actions.toast("error", e.message || "연결을 끊지 못했습니다."); }
    finally { setBusy(false); }
  }, [actions]);

  // 다른 노드를 고르면 편집 상태는 닫는다
  useEffect(()=>{ setEditing(false); setConfirmDelete(false); }, [sel?.id]);

  // ── 가지치기 추천 ───────────────────────────────────────
  // 1단계: 웹 검색 없이 온톨로지 기반 추천 3개를 받아 상세 패널에 표시한다.
  const runPrune = useCallback(async (node) => {
    if (!node) return;
    setPrune({ nodeId: node.id, loading: true, error: "", items: [] });
    setResearch({});
    try {
      const data = await api.pruning.recommend(node.id);
      setPrune({
        nodeId: node.id,
        loading: false,
        error: "",
        items: data.recommendations ?? [],
      });
    } catch (e) {
      setPrune({ nodeId: node.id, loading: false, error: e.message, items: [] });
    }
  }, []);

  const handlePrune = () => {
    if (!sel) {
      actions.toast("info", "먼저 노드를 선택한 뒤 가지치기 추천을 눌러주세요.");
      return;
    }
    runPrune(sel);
  };

  // 2단계: 이 버튼을 눌렀을 때만 웹 검색이 실행된다.
  const handleResearch = useCallback(async (rec) => {
    if (!sel) return;
    setResearch((r) => ({ ...r, [rec.id]: { loading: true, error: "", data: null } }));
    try {
      const data = await api.pruning.research(rec.id, sel.id);
      setResearch((r) => ({ ...r, [rec.id]: { loading: false, error: "", data } }));
    } catch (e) {
      setResearch((r) => ({ ...r, [rec.id]: { loading: false, error: e.message, data: null } }));
    }
  }, [sel]);

  const handleExpand = useCallback(async (rec) => {
    if (!sel || expanding) return;
    setExpanding(rec.id);
    try {
      await api.pruning.expand(rec.id, sel.id);
      await actions.loadGraph(state.session?.user?.id);
      actions.toast("success", `"${rec.title}" 를 그래프에 추가했습니다.`);
    } catch (e) {
      actions.toast("error", e.message);
    } finally {
      setExpanding(null);
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [sel, expanding, actions, state.session?.user?.id]);

  // 카테고리별 개수 (범례용)
  const kindCounts = nodes.reduce((a,n)=>{ a[n.kind]=(a[n.kind]||0)+1; return a; }, {});

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div className="toolbar">
        <Btn v="primary" s="sm" onClick={()=>{ setCreating(true); setSel(null); }}><NavIcon name="plusSeed" size={15} color="#fff"/> 노드 추가</Btn>
        <Btn v="secondary" s="sm" onClick={()=>onNav("S09")}><NavIcon name="sparkle" size={15} color={TDS.textSecondary}/> 시드로 생성</Btn>
        <Btn v="secondary" s="sm" onClick={()=>onNav("S10")}><NavIcon name="history" size={15} color={TDS.textSecondary}/> 변경 이력</Btn>
        <Btn v="secondary" s="sm" onClick={findLinks}><NavIcon name="link" size={15} color={TDS.textSecondary}/> 관계 찾기</Btn>
        <Btn v="secondary" s="sm" onClick={findGaps}><NavIcon name="search" size={15} color={TDS.textSecondary}/> 빈 곳 보기</Btn>
        <Btn v="secondary" s="sm" onClick={handlePrune}><NavIcon name="sparkle" size={15} color={TDS.textSecondary}/> 가지치기 추천</Btn>
        <Btn v="secondary" s="sm" onClick={()=>onNav("S29")}><NavIcon name="exportIco" size={15} color={TDS.textSecondary}/> 내보내기</Btn>
        <div style={{flex:1}} />
        <div className="search-wrap" style={{width:220}}>
          <NavIcon name="graph" size={15} color={TDS.textTertiary}/><input placeholder="노드 검색..." value={q} onChange={e=>setQ(e.target.value)} />
        </div>
      </div>
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        {/* Canvas */}
        <div style={{flex:1,padding:20,overflow:"hidden",position:"relative"}}>
          <div
            ref={canvasRef}
            className="graph-canvas"
            onMouseDown={onCanvasDown}
            onMouseMove={onCanvasMove}
            onMouseUp={onCanvasUp}
            onMouseLeave={onCanvasUp}
            style={{
              height:"100%",borderRadius:16,position:"relative",overflow:"hidden",userSelect:"none",
              border:`1px solid ${GRAPH_CANVAS.border}`,
              cursor:grabbing?"grabbing":"grab",
              // 도트 격자는 CSS 배경으로 둔다. 크기·위치를 줌/팬에 그대로 물려
              // 격자가 그래프와 함께 움직여야 확대·축소가 눈에 들어온다.
              backgroundColor:GRAPH_CANVAS.bg,
              backgroundImage:
                `radial-gradient(circle at 50% 45%, ${GRAPH_CANVAS.bgCenter} 0%, ${GRAPH_CANVAS.bg} 62%),`+
                `radial-gradient(circle, ${GRAPH_CANVAS.dot} 1.1px, transparent 1.2px)`,
              backgroundSize:`100% 100%, ${26*view.scale}px ${26*view.scale}px`,
              backgroundPosition:`0 0, ${view.tx}px ${view.ty}px`,
            }}
          >
            <svg width="0" height="0" style={{position:"absolute"}} aria-hidden>
              <defs>
                <linearGradient id="edgeGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={TDS.blue400} stopOpacity=".95"/>
                  <stop offset="100%" stopColor="#22c55e" stopOpacity=".8"/>
                </linearGradient>
              </defs>
            </svg>

            {loading && (
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12,color:OVERLAY_TEXT.tertiary,zIndex:Z.loading}}>
                <div className="spinner" /><div style={{fontSize:13}}>그래프 불러오는 중…</div>
              </div>
            )}
            {!loading && !nodes.length && (
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14,color:OVERLAY_TEXT.tertiary}}>
                <NavIcon name="branch" size={44} color={OVERLAY_TEXT.tertiary}/>
                <div style={{fontSize:14}}>아직 노드가 없습니다</div>
                <Btn v="primary" s="sm" onClick={()=>onNav("S09")}><NavIcon name="plusSeed" size={14} color="#fff"/> 첫 시드 추가하기</Btn>
              </div>
            )}

            {/* 줌·팬 레이어 — 엣지와 노드만 이 안에 둔다.
                패널·라벨은 밖에 있어야 확대해도 화면에 고정된다. */}
            <div style={{position:"absolute",inset:0,transformOrigin:"0 0",
                         transform:`translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
                         transition:flying?`transform ${FLY_MS}ms cubic-bezier(.22,.8,.28,1)`:"none",
                         willChange:"transform"}}>

            {/* 엣지 — 곡선 + 활성 노드 연결선 강조 (viewBox % 좌표계) */}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}>
              {visualEdges.map(e=>{
                const a=nodeById(e.from), b=nodeById(e.to);
                if(!a||!b) return null;
                const on = activeId && (e.from===activeId||e.to===activeId);
                const pa=getPos(a), pb=getPos(b);
                const ax=parseFloat(pa.x), ay=parseFloat(pa.y), bx=parseFloat(pb.x), by=parseFloat(pb.y);
                // 선분에 수직으로 살짝 밀어 마인드맵처럼 부드럽게 휘게 한다.
                const dx=bx-ax, dy=by-ay;
                const len=Math.hypot(dx,dy)||1;
                const off=len*(e.branch?0.07:0.18);
                const mx=(ax+bx)/2 + (-dy/len)*off;
                const my=(ay+by)/2 + ( dx/len)*off;
                return (
                  <path key={e.id}
                    d={`M ${ax} ${ay} Q ${mx} ${my} ${bx} ${by}`}
                    fill="none"
                    stroke={on?"url(#edgeGrad)":GRAPH_EDGE}
                    strokeWidth={on?EDGE_W.on:(e.branch?EDGE_W.branch:EDGE_W.base)}
                    vectorEffect="non-scaling-stroke"
                    strokeLinecap="round"
                    opacity={activeId && !on ? .16 : (on?1:(e.branch?.8:.62))}
                    style={{transition:"opacity .2s, stroke-width .2s"}}
                  />
                );
              })}
            </svg>

            {/* 노드 — 색은 유형, 아이콘은 과목·분야 */}
            {nodes.map(n=>{
              const dimSearch = matched && !matched.includes(n.id);
              const dimActive = connectedIds && n.id!==activeId && !connectedIds.has(n.id);
              const dim = dimSearch || dimActive;
              const isActive = n.id===activeId;
              const isDraggingThis = dragging.current?.id === n.id;
              const meta = KIND_META[n.kind] || KIND_META.topic;
              const pos = getPos(n);
              return (
                <div key={n.id}
                  onMouseDown={(e)=>onNodeDown(e,n)}
                  onMouseEnter={()=>setHover(n.id)} onMouseLeave={()=>setHover(null)}
                  style={{position:"absolute",left:pos.x,top:pos.y,transform:`translate(-50%,-50%) scale(${isActive?1.12:1})`,display:"flex",flexDirection:"column",alignItems:"center",cursor:isDraggingThis?"grabbing":"grab",transition:isDraggingThis?"none":"transform .2s, opacity .2s",opacity:dim?DIM_OPACITY:1,zIndex:isDraggingThis?Z.nodeDragging:isActive?Z.nodeActive:Z.node}}>
                  <div style={{width:n.size,height:n.size,borderRadius:"50%",background:`radial-gradient(circle at 35% 30%, ${n.color}, ${n.color}dd)`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",boxShadow:isActive?`0 0 0 4px ${GRAPH_CANVAS.bg}, 0 0 0 7px ${n.color}, 0 8px 24px ${meta.ring}`:`0 4px 12px rgba(15,23,42,.18)`,border:`2px solid rgba(255,255,255,.55)`}}>
                    <NavIcon name={iconForNode(n)} size={n.size>50?24:n.size>40?19:15} color="#fff"/>
                  </div>
                </div>
              );
            })}
            </div>{/* 줌·팬 레이어 끝 */}

            {/* 이름표 — 줌 바깥이라 확대해도 글자 크기는 그대로다. 서로 겹치면
                덜 중요한 쪽이 빠진다(자리는 shownLabels 에서 정한다). */}
            <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:Z.label,overflow:"hidden"}}>
              {[...shownLabels].map(([id, l]) => (
                id === activeId ? null : (
                  /* 이름표도 눌러서 고를 수 있다. 동그라미보다 넓고 읽고 나서
                     누르는 자리라, 여기서 못 고르면 매번 작은 원을 조준해야 한다. */
                  <span key={id} title={l.text}
                    onMouseDown={(e)=>e.stopPropagation()}
                    onClick={()=>{ const n = nodes.find(x=>x.id===id); if(n) setSel(s=>s?.id===n.id?null:n); }}
                    onMouseEnter={()=>setHover(id)} onMouseLeave={()=>setHover(null)}
                    style={{position:"absolute",left:l.left,top:l.top,transform:"translateX(-50%)",
                            pointerEvents:"auto",cursor:"pointer",opacity:l.dim?DIM_OPACITY:1,
                            transition:"opacity .2s",
                            fontSize:LABEL_FONT,fontWeight:700,lineHeight:`${LABEL_H - 4}px`,
                            color:OVERLAY_TEXT.primary,background:"rgba(255,255,255,.90)",
                            padding:"1px 8px",borderRadius:9,whiteSpace:"nowrap",
                            border:"1px solid rgba(15,23,42,.07)",boxShadow:"0 1px 4px rgba(15,23,42,.10)"}}>
                    {l.text}
                  </span>
                )
              ))}
            </div>

            {/* 지금 보고 있는 노드 — 이름과 과목을 카드로 크게 보여준다. */}
            {activeNode && canvasBox.w > 0 && (() => {
              const s = screenOf(activeNode);
              const x = Math.max(LABEL_EDGE_PAD, Math.min(canvasBox.w - LABEL_EDGE_PAD, s.x));
              const below = s.y < canvasBox.h - 110;
              const gap = s.r + 12;
              const isPinned = sel?.id === activeNode.id;  // 클릭한 것은 패널보다 위로
              return (
                <div style={{position:"absolute",left:x,top:s.y,zIndex:isPinned?Z.labelPinned:Z.label,pointerEvents:"none",transform:`translate(-50%, ${below?"0":"-100%"})`,marginTop:below?gap:-gap}}>
                  <div style={{...OVERLAY_SURFACE,borderRadius:12,padding:"8px 12px",maxWidth:240,textAlign:"center"}}>
                    <div style={{fontSize:13,fontWeight:700,color:OVERLAY_TEXT.primary,lineHeight:1.35,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden",wordBreak:"break-word"}}>
                      {activeNode.label}
                    </div>
                    {activeNode.section && activeNode.section !== "기타" && (
                      <div style={{fontSize:11,color:OVERLAY_TEXT.tertiary,marginTop:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                        {activeNode.section}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* 범례 (좌상단) — 색은 유형, 아이콘은 과목 */}
            {!!nodes.length && (
              <div data-graph-panel style={{...OVERLAY_SURFACE,position:"absolute",top:16,left:16,zIndex:Z.panel,padding:"14px 16px",minWidth:172,maxHeight:"calc(100% - 32px)",overflowY:"auto"}}>
                <div style={{fontSize:11,fontWeight:700,color:OVERLAY_TEXT.tertiary,marginBottom:10,letterSpacing:".02em"}}>
                  색 = 노드 유형
                </div>
                {["root","topic","leaf"].map(k=>{
                  const m=KIND_META[k]; const c=m.color;
                  return (
                    <div key={k} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                      <span style={{width:12,height:12,borderRadius:"50%",background:c,flexShrink:0,boxShadow:`0 0 0 3px ${c}22`}} />
                      <span style={{fontSize:12,color:OVERLAY_TEXT.secondary,flex:1}}>{m.label}</span>
                      <span style={{fontSize:12,fontWeight:700,color:OVERLAY_TEXT.primary,fontVariantNumeric:"tabular-nums"}}>{kindCounts[k]||0}</span>
                    </div>
                  );
                })}
                <div style={{height:1,background:"rgba(15,23,42,.08)",margin:"10px -16px 10px"}} />
                <div style={{fontSize:11,fontWeight:700,color:TDS.textTertiary,marginBottom:8,letterSpacing:".02em"}}>
                  모양 = 과목·분야
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 10px"}}>
                  {SUBJECT_LEGEND.map(s=>(
                    <div key={s.icon} style={{display:"flex",alignItems:"center",gap:6,minWidth:0}}>
                      <NavIcon name={s.icon} size={14} color={OVERLAY_TEXT.secondary}/>
                      <span style={{fontSize:11,color:OVERLAY_TEXT.tertiary,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 통계 (우상단) — 범례와 같은 재질 */}
            {!!nodes.length && (
              <div data-graph-panel style={{position:"absolute",top:16,right:16,zIndex:Z.panel,display:"flex",gap:8}}>
                {[
                  { icon:"core",   color:TDS.blue500, value:nodes.length, label:"노드" },
                  { icon:"branch", color:"#22c55e",   value:edges.length, label:"연결" },
                ].map(s=>(
                  <div key={s.label} style={{...OVERLAY_SURFACE,borderRadius:12,padding:"9px 13px",display:"flex",alignItems:"center",gap:8}}>
                    <NavIcon name={s.icon} size={15} color={s.color}/>
                    <span style={{fontSize:15,fontWeight:800,color:OVERLAY_TEXT.primary,fontVariantNumeric:"tabular-nums",letterSpacing:"-.01em"}}>{s.value}</span>
                    <span style={{fontSize:12,color:OVERLAY_TEXT.tertiary}}>{s.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 줌 컨트롤 — 휠/드래그와 같은 상태를 쓴다 */}
            {/* 오른쪽 아래는 녹음 도크가 쓰는 자리다. 겹치지 않게 왼쪽에 둔다 —
                두 조작부가 같은 모서리에 있으면 어느 쪽을 누르는지 헷갈린다. */}
            <div data-graph-panel style={{position:"absolute",bottom:16,left:16,zIndex:Z.panel,display:"flex",flexDirection:"column",gap:6}}>
              {[
                { key:"in",    text:"+", title:"확대",       onClick:()=>zoomByButton(ZOOM.step) },
                { key:"out",   text:"−", title:"축소",       onClick:()=>zoomByButton(1/ZOOM.step) },
                { key:"reset", text:"⤾", title:"원래 크기로", onClick:resetView },
              ].map(b=>(
                <button key={b.key} title={b.title} onClick={b.onClick}
                  style={{...OVERLAY_SURFACE,borderRadius:12,width:36,height:36,padding:0,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:b.key==="reset"?15:18,fontWeight:600,color:OVERLAY_TEXT.secondary}}>
                  {b.text}
                </button>
              ))}
              <div style={{...OVERLAY_SURFACE,borderRadius:10,padding:"4px 0",textAlign:"center",fontSize:11,fontWeight:700,color:OVERLAY_TEXT.tertiary,fontVariantNumeric:"tabular-nums"}}>
                {Math.round(view.scale*100)}%
              </div>
            </div>
          </div>
        </div>

        {/* 노드 만들기 — 상세 패널과 같은 자리에 선다. 패널을 둘로 늘리면
            좁은 화면에서 캔버스가 사라진다. */}
        {creating && (
          <div style={{width:360,background:TDS.bgPrimary,borderLeft:`1px solid ${TDS.borderDefault}`,padding:24,overflowY:"auto"}}>
            <div className="row-between mb16" style={{marginBottom:16}}>
              <span style={{fontSize:16,fontWeight:700,color:TDS.textPrimary}}>노드 추가</span>
              <button onClick={()=>setCreating(false)} aria-label="닫기" style={{background:TDS.bgTertiary,border:"none",width:28,height:28,borderRadius:8,cursor:"pointer",color:TDS.textSecondary,display:"flex",alignItems:"center",justifyContent:"center"}}><NavIcon name="close" size={14} color={TDS.textSecondary}/></button>
            </div>
            <NodeEditor
              mode="create"
              nodes={nodes}
              defaultParentId={nodes.find(n=>n.kind==="root")?.id || ""}
              busy={busy}
              onSubmit={handleCreate}
              onCancel={()=>setCreating(false)}
            />
          </div>
        )}

        {/* 빈 곳 — 상세·만들기·관계와 같은 자리 */}
        {gaps && (
          <div style={{width:360,background:TDS.bgPrimary,borderLeft:`1px solid ${TDS.borderDefault}`,padding:24,overflowY:"auto"}}>
            <div className="row-between mb16" style={{marginBottom:16}}>
              <span style={{fontSize:16,fontWeight:700,color:TDS.textPrimary}}>빈 곳</span>
              <button onClick={()=>setGaps(null)} aria-label="닫기" style={{background:TDS.bgTertiary,border:"none",width:28,height:28,borderRadius:8,cursor:"pointer",color:TDS.textSecondary,display:"flex",alignItems:"center",justifyContent:"center"}}><NavIcon name="close" size={14} color={TDS.textSecondary}/></button>
            </div>
            <GraphGaps
              state={gaps}
              onRetry={findGaps}
              onOpenDoc={(s)=>{
                sessionStorage.setItem("mbx_doc_id", s.section_id);
                sessionStorage.setItem("mbx_doc_type", s.section_type || "");
                sessionStorage.setItem("mbx_doc_subject", "");
                onNav("S12");
              }}
              onPickNode={(id)=>{
                const n = nodes.find((x)=>x.id===id);
                if (n) { setGaps(null); setSel(n); }
              }}
            />
          </div>
        )}

        {/* 관계 찾기 — 상세·만들기와 같은 자리에 선다 */}
        {links && (
          <div style={{width:360,background:TDS.bgPrimary,borderLeft:`1px solid ${TDS.borderDefault}`,padding:24,overflowY:"auto"}}>
            <div className="row-between mb16" style={{marginBottom:16}}>
              <span style={{fontSize:16,fontWeight:700,color:TDS.textPrimary}}>관계 찾기</span>
              <button onClick={()=>setLinks(null)} aria-label="닫기" style={{background:TDS.bgTertiary,border:"none",width:28,height:28,borderRadius:8,cursor:"pointer",color:TDS.textSecondary,display:"flex",alignItems:"center",justifyContent:"center"}}><NavIcon name="close" size={14} color={TDS.textSecondary}/></button>
            </div>
            <LinkSuggestions
              state={links}
              busyId={linkBusy}
              onAccept={acceptLink}
              onSkip={dropLink}
              onRetry={findLinks}
            />
          </div>
        )}

        {/* Detail panel */}
        {sel&&(()=>{ const eList=edgesOf(sel.id); const meta=KIND_META[sel.kind]||KIND_META.topic; return (
          <div style={{width:360,background:TDS.bgPrimary,borderLeft:`1px solid ${TDS.borderDefault}`,padding:24,overflowY:"auto"}}>
            <div className="row-between mb16" style={{marginBottom:16}}>
              <span style={{fontSize:16,fontWeight:700,color:TDS.textPrimary}}>노드 상세</span>
              <button onClick={()=>setSel(null)} style={{background:TDS.bgTertiary,border:"none",width:28,height:28,borderRadius:8,cursor:"pointer",color:TDS.textSecondary,display:"flex",alignItems:"center",justifyContent:"center"}}><NavIcon name="close" size={14} color={TDS.textSecondary}/></button>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
              <div style={{width:56,height:56,borderRadius:"50%",background:`radial-gradient(circle at 35% 30%, ${sel.color}, ${sel.color}dd)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:`0 4px 14px ${meta.ring}`,border:"2px solid rgba(255,255,255,.35)"}}>
                <NavIcon name={iconForNode(sel)} size={26} color="#fff"/>
              </div>
              <div style={{minWidth:0,flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                  <div style={{fontSize:20,fontWeight:800,color:TDS.textPrimary,minWidth:0,overflowWrap:"anywhere"}}>{sel.label}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                  <Badge t="blue">{sel.cat}</Badge>
                  {sel.section && sel.section !== "기타" && <Badge t="grey">{sel.section}</Badge>}
                  {/* 다른 이름 — 생기부에 이렇게도 적혀 있다는 뜻 */}
                  {(sel.aliases || []).map((a) => (
                    <span key={a} className="node-alias" title="다른 이름(별칭)">{a}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* 고치기·지우기 — 다른 화면으로 보내지 않는다. AI 가 잘못 뽑은 것을
                보는 그 자리에서 바로 고칠 수 있어야 한다. */}
            {!editing && !confirmDelete && (
              <div style={{display:"flex",gap:8,marginBottom:4}}>
                <Btn v="secondary" s="sm" onClick={()=>setEditing(true)} style={{flex:1}}>
                  <NavIcon name="pen" size={14} color={TDS.textSecondary}/> 수정
                </Btn>
                <Btn v="ghost" s="sm" onClick={()=>setConfirmDelete(true)} style={{color:TDS.danger}}>
                  <NavIcon name="trash" size={14} color={TDS.danger}/> 삭제
                </Btn>
              </div>
            )}
            {editing && (
              <NodeEditor
                mode="edit"
                node={sel}
                nodes={nodes}
                busy={busy}
                onSubmit={handleEdit}
                onCancel={()=>setEditing(false)}
              />
            )}
            {confirmDelete && (
              <NodeDeleteConfirm
                node={sel}
                edgeCount={eList.length}
                busy={busy}
                onConfirm={handleDelete}
                onCancel={()=>setConfirmDelete(false)}
              />
            )}

            {sel.description && !editing && (
              <p style={{fontSize:13,color:TDS.textSecondary,lineHeight:1.65,margin:"14px 0 0",wordBreak:"keep-all"}}>{sel.description}</p>
            )}

            <Divider my={16} />

            {/* 출처 — 이 노드가 생기부 어느 문장에서 나왔는지. 고치거나 지우려는
                순간에는 판단할 근거가 필요하므로 연결·추천보다 위에 둔다. */}
            {!editing && !confirmDelete && (
              <>
                <NodeEvidence nodeId={sel.id} label={sel.label} />
                <Divider my={16} />
              </>
            )}

            {!editing && !confirmDelete && (
              <>
                <NodeConnections
                  node={sel}
                  edges={edges}
                  nodes={nodes}
                  busy={busy}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                />
                <Divider my={16} />
              </>
            )}

            {/* 가지치기 추천 — 상단 버튼을 누르면 여기에 카드 3개가 뜬다 */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <p style={{fontSize:12,fontWeight:600,color:TDS.textTertiary,margin:0}}>가지치기 추천</p>
              <Btn v="secondary" s="sm" disabled={!!prune?.loading} onClick={()=>runPrune(sel)}>
                {prune?.loading ? "생성 중…" : prune?.items?.length ? "다시 추천" : "추천 받기"}
              </Btn>
            </div>

            {prune?.loading && (
              <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px",background:TDS.bgTertiary,borderRadius:10,marginBottom:12}}>
                <div className="spinner" />
                <span style={{fontSize:13,color:TDS.textSecondary}}>탐구 방향을 찾는 중…</span>
              </div>
            )}

            {prune?.error && (
              <div style={{padding:"12px",background:TDS.bgTertiary,borderRadius:10,marginBottom:12}}>
                <div style={{fontSize:13,color:TDS.danger,marginBottom:8}}>{prune.error}</div>
                <Btn v="secondary" s="sm" onClick={()=>runPrune(sel)}>다시 시도</Btn>
              </div>
            )}

            {!prune && (
              <div style={{fontSize:13,color:TDS.textDisabled,marginBottom:12}}>
                상단의 “가지치기 추천”을 누르면 다음 탐구 방향 3개를 제안합니다.
              </div>
            )}

            {prune?.items?.map((rec) => {
              const meta = BRANCH_META[rec.type] || BRANCH_META.DEPTH;
              const res = research[rec.id];
              return (
                <div key={rec.id} style={{border:`1px solid ${TDS.borderDefault}`,borderRadius:12,padding:14,marginBottom:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <span style={{padding:"2px 8px",borderRadius:10,fontSize:11,fontWeight:700,color:"#fff",background:meta.color}}>
                      {meta.label}
                    </span>
                    <span style={{fontSize:14,fontWeight:700,color:TDS.textPrimary}}>{rec.title}</span>
                  </div>
                  <div style={{fontSize:12,color:TDS.textSecondary,marginBottom:6}}>{rec.reason}</div>
                  <div style={{fontSize:12,color:TDS.textPrimary,background:TDS.bgTertiary,borderRadius:8,padding:"8px 10px",marginBottom:6}}>
                    {rec.activity}
                  </div>
                  {rec.expectedOutput && (
                    <div style={{fontSize:12,color:TDS.textTertiary,marginBottom:6}}>
                      결과물 · {rec.expectedOutput}
                    </div>
                  )}
                  {!!rec.relatedNodes?.length && (
                    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
                      {rec.relatedNodes.map((label) => (
                        <span key={label} style={{fontSize:11,color:TDS.textSecondary,background:TDS.bgTertiary,borderRadius:8,padding:"2px 8px"}}>
                          {label}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{display:"flex",gap:6}}>
                    <Btn v="primary" s="sm" disabled={expanding===rec.id} onClick={()=>handleExpand(rec)}>
                      {expanding===rec.id ? "추가 중…" : "이 주제로 확장"}
                    </Btn>
                    <Btn v="secondary" s="sm" disabled={!!res?.loading} onClick={()=>handleResearch(rec)}>
                      {res?.loading ? "찾는 중…" : "관련 자료 찾기"}
                    </Btn>
                  </div>

                  {res?.error && (
                    <div style={{marginTop:10}}>
                      <div style={{fontSize:12,color:TDS.danger,marginBottom:6}}>{res.error}</div>
                      <Btn v="secondary" s="sm" onClick={()=>handleResearch(rec)}>다시 시도</Btn>
                    </div>
                  )}

                  {res?.data && (
                    <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${TDS.borderDefault}`}}>
                      <div style={{fontSize:12,fontWeight:700,color:TDS.textPrimary,marginBottom:6}}>
                        {res.data.refinedTopic}
                      </div>
                      {!!res.data.researchQuestions?.length && (
                        <ul style={{margin:"0 0 8px",paddingLeft:16}}>
                          {res.data.researchQuestions.map((q,i)=>(
                            <li key={i} style={{fontSize:12,color:TDS.textSecondary,marginBottom:3}}>{q}</li>
                          ))}
                        </ul>
                      )}
                      {res.data.method && (
                        <div style={{fontSize:12,color:TDS.textSecondary,marginBottom:8}}>{res.data.method}</div>
                      )}
                      {res.data.sources?.length ? res.data.sources.map((s)=>(
                        <div key={s.url} style={{marginBottom:8}}>
                          <a href={s.url} target="_blank" rel="noreferrer"
                             style={{fontSize:12,fontWeight:600,color:TDS.blue500,textDecoration:"none"}}>
                            {s.title}
                          </a>
                          <div style={{fontSize:11,color:TDS.textTertiary}}>{s.reason}</div>
                        </div>
                      )) : (
                        <div style={{fontSize:12,color:TDS.textDisabled}}>참고자료를 찾지 못했습니다.</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <Divider my={16} />
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <p style={{fontSize:12,fontWeight:600,color:TDS.textTertiary,margin:0}}>코멘트 {comments.length}개</p>
            </div>
            {!comments.length ? (
              <div style={{fontSize:13,color:TDS.textDisabled,padding:"8px 0"}}>아직 코멘트가 없습니다</div>
            ) : comments.slice(0,3).map((c,i)=>(
              <div key={c.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 12px",background:TDS.bgTertiary,borderRadius:10,marginBottom:8}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:TDS.blue50,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:12,fontWeight:700,color:TDS.blue500}}>
                  {c.author?.[0]??"?"}
                </div>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{fontSize:12,fontWeight:700,color:TDS.textPrimary,marginBottom:2}}>{c.author}</div>
                  <div style={{fontSize:12,color:TDS.textSecondary,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.content}</div>
                </div>
              </div>
            ))}
            <div style={{marginTop:20,display:"flex",flexDirection:"column",gap:10}}>
              <Btn v="primary" s="md" style={{width:"100%"}} onClick={()=>onNav("S07")}>노드 상세 보기</Btn>
              <Btn v="primary" s="md" style={{width:"100%"}} onClick={()=>onNav("S24")}>코멘트 작성</Btn>
            </div>
          </div>
        ); })()}
      </div>
    </div>
  );
}

/* S11 텍스트 영역 */

