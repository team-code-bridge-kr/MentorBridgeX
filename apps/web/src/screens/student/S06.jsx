import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { GRAPH_CANVAS, KIND_META, OVERLAY_SURFACE, OVERLAY_TEXT, Z, ZOOM } from "../../theme/graphMeta.js";
import { iconForNode, SUBJECT_LEGEND } from "../../theme/nodeIcons.js";
import { visualEdgesOf } from "../../theme/graphView.js";
import { childMapOf, descendantCount, strayIdsOf } from "../../lib/graphTree.js";
import {
  drillTargetOf, focusViewOf, parentOf, pathTo, rootIdOf,
} from "../../lib/graphFocus.js";
import { LABEL_FONT, LABEL_H, placeLabels } from "../../lib/graphLabels.js";
import { Btn, Badge } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";
import api from "../../api/index.js";
import { showLoading, showNote, withLoading } from "../../components/LoadingDock.jsx";
import { NodeConnections, NodeDeleteConfirm, NodeEditor } from "../../components/graph/NodeEditor.jsx";
import { NodeEvidence } from "../../components/graph/NodeEvidence.jsx";
import { GraphPanel, Section } from "../../components/graph/GraphPanel.jsx";
import { GraphExplore } from "../../components/graph/GraphExplore.jsx";
import { Popover } from "../../components/ui/Popover.jsx";

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

// 자동 포커싱 — 고른 노드로 데려갈 때의 최소 배율과 걸리는 시간.
// 1.35 는 "이름이 읽히기 시작하는" 배율이다. 더 키우면 고른 노드만 남고 둘레가
// 사라져서, 무엇 옆에 있던 노드인지 알 수 없게 된다.
const FOCUS_SCALE = 1.35;
const FLY_MS = 380;

/**
 * 보던 자리 기억하기 — 접힘·배율·끌어 옮긴 위치.
 *
 * **sessionStorage 다.** 이건 *설정*이 아니라 "내가 보고 있던 자리"라서, 탭을
 * 닫으면 사라지는 게 맞다. 예전에는 화면을 옮겼다가 돌아오기만 해도 다 풀리고
 * 배율이 100% 로 돌아가서, 노드 상세를 보러 생기부로 갔다 오면 처음부터 다시
 * 찾아야 했다.
 *
 * 위치를 **서버에 보내지는 않는다.** 좌표를 쓰는 엔드포인트가 없고, 배치는
 * `computeLayout` 이 불러올 때마다 다시 셈한다. 영속화하면 배치 규칙과 조용히
 * 싸우게 된다 — 끌어 옮기기는 이번 탭 안의 임시 조정이다.
 */
const VIEW_KEY = "mbx_graph_view";
const LEGEND_KEY = "mbx_graph_legend";

function readSaved() {
  try {
    const raw = sessionStorage.getItem(VIEW_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// 가지치기 추천 유형별 표시 정보.
const BRANCH_META = {
  DEPTH:    { label: "심화", color: "#3182f6" },
  FUSION:   { label: "융합", color: "#8b5cf6" },
  ACTIVITY: { label: "활동", color: "#22c55e" },
};

/**
 * 선과 노드는 **줌·팬을 모르는 채로** 그린다.
 *
 * 둘 다 감싸는 레이어의 `transform` 안에 있어서 확대·이동은 그 문자열 하나만
 * 바뀌면 된다. 그런데 예전에는 이 JSX 가 S06 본문에 있어서, 팬 한 프레임마다
 * 선 250개와 노드 200개가 통째로 다시 만들어졌다. 밖으로 빼고 `view` 를 넘기지
 * 않으면 React 가 건너뛴다 — 이번 작업에서 가장 큰 이득이다.
 *
 * 그러므로 **여기에 `view` 를 넘기지 말 것.** 넘기는 순간 효과가 사라진다.
 */
const GraphEdges = memo(function GraphEdges({ visualEdges, byId, getPos, activeId }) {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}>
      {visualEdges.map(e=>{
        const a=byId.get(e.from), b=byId.get(e.to);
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
  );
});

/** 노드 — 색은 유형(KIND_META), 아이콘은 과목·분야. `view` 를 받지 않는다. */
const GraphNodes = memo(function GraphNodes({ nodes, getPos, matchedSet, connectedIds, activeId, draggingId, onNodeDown, onHover, drillableIds, onDrill }) {
  return (
    <>
      {nodes.map(n=>{
        const dimSearch = matchedSet && !matchedSet.has(n.id);
        const dimActive = connectedIds && n.id!==activeId && !connectedIds.has(n.id);
        const dim = dimSearch || dimActive;
        const isActive = n.id===activeId;
        const isDraggingThis = draggingId === n.id;
        const meta = KIND_META[n.kind] || KIND_META.topic;
        const pos = getPos(n);
        return (
          // 한 번 누르면 고르면서 **그 노드로 들어간다**(자식이 있으면).
          // 더블클릭도 같은 일을 한다 — 익숙한 손짓이라 남겨 둔다.
          <div key={n.id}
            onMouseDown={(e)=>onNodeDown(e,n)}
            onDoubleClick={drillableIds.has(n.id) ? (e)=>{ e.stopPropagation(); onDrill(n); } : undefined}
            onMouseEnter={()=>onHover(n.id)} onMouseLeave={()=>onHover(null)}
            style={{position:"absolute",left:pos.x,top:pos.y,transform:`translate(-50%,-50%) scale(${isActive?1.12:1})`,display:"flex",flexDirection:"column",alignItems:"center",cursor:isDraggingThis?"grabbing":"grab",transition:isDraggingThis?"none":"transform .2s, opacity .2s",opacity:dim?DIM_OPACITY:1,zIndex:isDraggingThis?Z.nodeDragging:isActive?Z.nodeActive:Z.node}}>
            <div style={{width:n.size,height:n.size,borderRadius:"50%",background:`radial-gradient(circle at 35% 30%, ${meta.color}, ${meta.color}dd)`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",boxShadow:isActive?`0 0 0 4px ${GRAPH_CANVAS.bg}, 0 0 0 7px ${meta.color}, 0 8px 24px ${meta.ring}`:`0 4px 12px rgba(15,23,42,.18)`,border:`2px solid rgba(255,255,255,.55)`}}>
              <NavIcon name={iconForNode(n)} size={n.size>50?24:n.size>40?19:15} color="#fff"/>
            </div>
          </div>
        );
      })}
    </>
  );
});

export function S06({ onNav }) {
  const { state, actions } = useStore();
  const { nodes: allNodes, edges: allEdges, loading } = state.graph;
  // 뼈대 다시 세우기 — { busy, msg }
  const [restruct, setRestruct] = useState({ busy: false, msg: "" });

  /**
   * 지금 들여다보고 있는 노드. **무엇이 보이는지를 정하는 유일한 값이다.**
   *
   * 화면에는 이 노드와 그 자식들만 선다. 층을 옮기는 일은 `focusId` 를 바꾸는
   * 것 하나뿐이라, 상태가 서로 다투지 않는다.
   *
   * 예전에는 가지별 접기였다. 자리를 안 바꾸는 것이 장점이었는데 **써 보니
   * 시야가 안 걷혔다** — 한 가지를 접어도 나머지 190개가 그대로 남는다.
   * 지도 감각을 지킬 값어치는 지도가 읽힐 때 생기는데, 197개가 깔린 그림은
   * 애초에 지도가 아니라 얼룩이라 지킬 것이 없었다.
   */
  const [focusId, setFocusId] = useState(() => readSaved()?.focusId ?? null);

  const childMap = useMemo(() => childMapOf(allNodes), [allNodes]);
  /** 들어갈 수 있는 노드 = 자식이 있는 노드. */
  const drillableIds = useMemo(() => new Set(childMap.keys()), [childMap]);
  const rootId = useMemo(() => rootIdOf(allNodes, childMap), [allNodes, childMap]);

  /**
   * 층이 아예 없는 그래프인가 — 개념이 전부 문서에 바로 매달린 **별 모양**.
   *
   * 「층 다시 세우기」를 한 번도 안 누른 계정이 여기 해당한다. 이때는 들어갈
   * 곳이 없어서 화면이 아무 반응을 안 하는데, 그걸 말해 주지 않으면 고장으로
   * 읽힌다. 실측: 계정 165개 중 층이 있는 것은 17개뿐이다.
   */
  const noLayers = useMemo(() => {
    if (!allNodes.length || !rootId) return false;
    const kids = childMap.get(rootId) || [];
    if (!kids.length) return false;
    return kids.every((id) => !(childMap.get(id)?.length));
  }, [allNodes, rootId, childMap]);
  // 그래프가 새로 오면 초점이 없어졌을 수 있다. 그때는 뿌리로 돌아간다.
  const activeFocus = useMemo(
    () => (focusId && allNodes.some((n) => n.id === focusId) ? focusId : rootId),
    [focusId, allNodes, rootId],
  );

  const view0 = useMemo(
    () => focusViewOf(allNodes, childMap, activeFocus),
    [allNodes, childMap, activeFocus],
  );
  /** 뿌리 → 지금 초점까지의 길. 경로표시가 이걸 그린다. */
  const trail = useMemo(() => pathTo(activeFocus, allNodes), [activeFocus, allNodes]);

  /**
   * 이번 화면의 노드 — 초점과 그 자식들뿐.
   *
   * 자리는 `graphFocus` 가 새로 셈한다. 전역 방사 배치(`api/index.js`)는 층마다
   * 화면을 새로 쓰는 지금은 뜻이 없다.
   */
  const nodes = useMemo(() => {
    if (!view0.focus) return [];
    const pos = view0.positions;
    return [view0.focus, ...view0.children].map((n) => {
      const p = pos.get(n.id);
      return p ? { ...n, x: p.x, y: p.y } : n;
    });
  }, [view0]);

  const edges = useMemo(() => {
    const alive = new Set(nodes.map((n) => n.id));
    return allEdges.filter((e) => alive.has(e.from) && alive.has(e.to));
  }, [allEdges, nodes]);

  /** 이 노드로 들어간다. 자식이 없으면 들어갈 데가 없어 아무 일도 안 한다. */
  const drillInto = useCallback((node) => {
    const target = drillTargetOf(node, childMap);
    if (target) setFocusId(target);
    return !!target;
  }, [childMap]);

  /** 한 층 위로. 뿌리면 더 갈 곳이 없다. */
  const goUp = useCallback(() => {
    const up = parentOf(activeFocus, allNodes);
    if (up) setFocusId(up);
    return !!up;
  }, [activeFocus, allNodes]);

  /** 이 노드가 보이도록 초점을 옮긴다 — 검색·빈 곳에서 고른 노드가 딴 층일 때. */
  const focusToShow = useCallback((id) => {
    const n = allNodes.find((x) => x.id === id);
    if (!n) return;
    // 자식이 있으면 그 노드로 들어가고, 말단이면 그 부모 층에서 보여준다.
    const target = (childMap.get(id)?.length ?? 0) > 0 ? id : (n.parentId || rootId);
    if (target) setFocusId(target);
  }, [allNodes, childMap, rootId]);

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
  /**
   * 옆 패널에 무엇을 세울지 — `null | "create" | "explore"`.
   *
   * 노드를 고르면(`sel`) 그것이 **언제나 이깁니다**. 그래서 패널 자리를 다투는
   * 상태가 사실상 하나뿐이고, 둘이 나란히 설 방법이 없다.
   *
   * 예전에는 만들기·빈 곳·관계·상세가 저마다 독립된 boolean 이었고 서로
   * 배타적이라는 것을 "각 핸들러가 나머지를 꺼 준다"는 관례로만 지켰다. 관례를
   * 안 지키는 경로(라벨 클릭, 노드 추가)로 들어가면 패널이 둘 서서 720px 를 먹고
   * 좁은 화면에서 캔버스가 사라졌다.
   *
   * 노드 만들기·고치기·지우기를 그래프 화면 안에 두는 까닭: AI 가 뽑아 준 결과가
   * 늘 맞지는 않는데 그 자리에서 고칠 수 없으면 그래프는 남의 것이 된다.
   */
  const [panel, setPanel] = useState(null);
  // 툴바의 「더보기」 — 자주 안 쓰는 것들을 여기로 넣었다.
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  /**
   * 노드 패널에서 펴 둔 구획.
   *
   * **노드별이 아니라 구획별로** 기억한다. 코멘트를 안 쓰는 학생은 한 번 접으면
   * 노드를 옮겨 다녀도 계속 접혀 있어야 한다 — 노드마다 따로 기억하면 새 노드를
   * 고를 때마다 접었던 것이 되살아난다.
   */
  const [openSections, setOpenSections] = useState(
    () => new Set(readSaved()?.sections ?? ["evidence", "links"]),
  );
  const toggleSection = useCallback((key) => {
    setOpenSections((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  // 노드 위치 로컬 상태 (드래그로 변경)
  const [positions, setPositions] = useState(() => readSaved()?.positions ?? {});
  // 드래그 상태: { id, startCX, startCY, origXpct, origYpct, moved }
  const dragging = useRef(null);
  const canvasRef = useRef(null);
  // 줌·팬 상태. tx/ty 는 화면 픽셀 이동량, scale 은 배율.
  const [view, setView] = useState(() => readSaved()?.view ?? { scale: 1, tx: 0, ty: 0 });
  const [grabbing, setGrabbing] = useState(false);
  // 자동 포커싱으로 화면이 움직이는 동안만 true. 이때만 부드럽게 움직인다.
  const [flying, setFlying] = useState(false);
  const panning = useRef(null);
  // 콜백 안에서 최신 배율을 읽기 위한 거울. state 를 의존성에 넣으면
  // 드래그 핸들러가 매 프레임 새로 만들어진다.
  const viewRef = useRef(view);
  const focusRef = useRef(null);
  /* 범례를 폈는지. 세션이 아니라 브라우저에 남긴다 — 한 번 접어 둔 사람이
     다음에 들어와서 또 접어야 하면 접는 뜻이 없다. */
  const [legendOpen, setLegendOpen] = useState(() => {
    try { return localStorage.getItem(LEGEND_KEY) === "open"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(LEGEND_KEY, legendOpen ? "open" : "closed"); } catch { /* 사생활 보호 모드 */ }
  }, [legendOpen]);
  // 자동 포커싱은 "선택이 바뀔 때만" 돌아야 한다. positions 를 의존성에 넣으면
  // 노드를 끌 때마다 화면이 따라 움직인다.
  const positionsRef = useRef(positions);

  /**
   * 노드 고르기 — **한 번 누르면 고르면서 그 노드로 들어간다.**
   *
   * 손짓 하나에 두 가지가 일어나지만 뜻은 하나다: "이걸 본다." 패널에 그 노드가
   * 서고, 화면은 그 노드의 둘레로 바뀐다. 자식이 없는 개념 노드는 들어갈 데가
   * 없으므로 고르기만 한다 — 빈 화면으로 데려가면 길을 잃는다.
   *
   * 같은 노드를 다시 누르면 패널만 닫는다. 초점은 그대로 둔다 — 들어온 것을
   * 되돌리는 길은 경로표시이지 같은 노드를 또 누르는 것이 아니다.
   */
  const selectNode = useCallback((n) => {
    setPanel(null);
    drillInto(n);
    setSel((cur) => (cur?.id === n.id ? null : n));
  }, [drillInto]);

  /** 옆 패널을 만들기/둘러보기로 세운다. 고른 노드는 놓는다 — 자리는 하나다. */
  const openPanel = useCallback((which) => {
    setSel(null);
    setPanel((cur) => (cur === which ? null : which));
  }, []);

  const closePanel = useCallback(() => { setSel(null); setPanel(null); }, []);

  // 최초 진입 시 그래프가 비어있으면 로드
  useEffect(()=>{ if(!allNodes.length && !loading) actions.loadGraph(state.session?.user?.id); /* eslint-disable-next-line */ }, []);
  // 고른 노드가 화면에서 사라지면 패널도 닫는다 — 지웠거나, 그 위 가지를 접었거나.
  // 감춘 것을 패널만 붙들고 있으면 캔버스와 패널이 서로 다른 말을 한다.
  // (고르는 순간의 펴기는 `selectNode` 가 함께 하므로 여기에 걸리지 않는다.)
  useEffect(()=>{ if(sel && !nodes.find(n=>n.id===sel.id)) setSel(null); }, [nodes, sel]);
  // 다른 노드를 고르면 이전 노드의 추천은 버린다 (엉뚱한 노드의 카드가 남지 않도록)
  useEffect(()=>{
    if (prune && prune.nodeId !== sel?.id) { setPrune(null); setResearch({}); }
  }, [sel, prune]);
  // 코멘트 초기 로드
  useEffect(()=>{ api.comments.list().then(setComments).catch(()=>{}); }, []);
  /* `positions` 는 **손으로 옮긴 것만** 담는다.
   *
   * 예전에는 노드를 처음 볼 때마다 여기에 전역 배치 좌표(api/index.js 가 그래프
   * 전체를 놓고 셈한 값)를 미리 채워 넣었다. 그런데 화면이 그리는 자리는
   * graphFocus 가 층마다 새로 셈한 **고리**다. 미리 채운 값이 늘 이겨서, 고리를
   * 셈해 놓고 그대로 버리고 있었다.
   *
   * 뿌리 층에서는 두 배치가 우연히 비슷해 티가 안 났다. 깊이 들어갈수록
   * 어긋난다 — 전역 배치에서 어느 과목의 자식 넷은 그 과목 언저리에 모여 있는
   * 작은 덩이라, 그 층만 띄우면 서로 겹쳐 붙어 버린다.
   *
   * 이제 안 채운다. 안 옮긴 노드는 `getPos` 가 고리 자리(n.x/n.y)를 쓴다.
   *
   * 없어진 노드의 자리만 치운다 — 안 치우면 지운 노드의 좌표가 계속 쌓인다. */
  useEffect(()=>{
    setPositions(prev=>{
      const live = new Set(allNodes.map((n) => n.id));
      const stale = Object.keys(prev).filter((key) => !live.has(key.split("@")[1] ?? key));
      if (!stale.length) return prev;
      const next = {...prev};
      stale.forEach((key) => delete next[key]);
      return next;
    });
  }, [allNodes]);
  // 보고 있던 층의 노드가 사라졌으면(지웠거나 다시 세웠거나) 뿌리로 돌아간다.
  // `activeFocus` 가 이미 뿌리로 떨어뜨려 주지만, 저장된 값도 함께 치워야
  // 다음에 들어올 때 없는 층을 다시 찾지 않는다.
  useEffect(()=>{
    if (!allNodes.length || !focusId) return;
    if (!allNodes.some((n) => n.id === focusId)) setFocusId(null);
  }, [allNodes, focusId]);

  // 보던 자리를 기억한다. 자주 바뀌는 값(팬·줌)이라 조금 미뤄 두고 한 번에 쓴다.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(VIEW_KEY, JSON.stringify({
          focusId: activeFocus, view, positions, sections: [...openSections],
        }));
      } catch { /* 저장 공간이 없으면 기억하지 않을 뿐, 화면은 그대로 돈다 */ }
    }, 300);
    return () => clearTimeout(t);
  }, [activeFocus, view, positions, openSections]);

  // 선이 하나도 없는 노드. 예전 화면은 가지를 지어내 이어진 것처럼 보였는데,
  // 이제 진짜 선만 그리니 드러난다. 감추지 말고 세어서 알려 준다 — 한 번
  // 누르면 대부분 제자리를 찾는다.
  const strayIds = useMemo(() => strayIdsOf(allNodes, allEdges), [allNodes, allEdges]);
  const strayCount = strayIds.size;

  // 그래프를 불러오는 동안. 노드 200개면 눈에 띄게 걸린다.
  useEffect(() => {
    if (!loading) return undefined;
    return showLoading("지식 그래프를 불러오는 중이에요…");
  }, [loading]);

  // id → 노드. 선을 그릴 때 양 끝을 찾는데, 이게 배열 훑기면 선 하나마다 노드를
  // 전부 훑게 된다(200노드 × 250선 × 2 = 프레임당 10만 회).
  const byId = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  const edgesOf = id => edges.filter(e=>e.from===id||e.to===id);

  // 화면에 그릴 선 — 규칙은 theme/graphView.js (대시보드 미리보기와 공유)
  const visualEdges = useMemo(() => visualEdgesOf(nodes, edges), [nodes, edges]);

  // 아래 셋은 **반드시 메모이제이션되어야 한다.** 매 렌더 새로 만들면
  // `shownLabels` 의 의존성이 늘 바뀌어서 useMemo 가 한 번도 걸리지 않고,
  // 이름표 자리잡기(O(후보×장애물))가 렌더마다 통째로 다시 돈다.
  // 검색은 **그래프 전체**를 뒤진다. 지금 층만 뒤지면 다른 층의 노드는 이름을
  // 정확히 알아도 찾을 수 없어서, 초점이 검색을 망가뜨린 꼴이 된다.
  // 걸린 노드가 보이도록 초점을 옮겨 준다(focusToShow).
  const matched = useMemo(() => {
    const t = q.trim();
    if (!t) return null;
    return allNodes.filter(n => n.label.includes(t)).map(n => n.id);
  }, [q, allNodes]);
  const matchedSet = useMemo(() => (matched ? new Set(matched) : null), [matched]);
  const activeId = hover || sel?.id || null;
  const activeNode = activeId ? byId.get(activeId) : null;
  const connectedIds = useMemo(() => (
    activeId
      ? new Set(visualEdges.filter(e=>e.from===activeId||e.to===activeId).flatMap(e=>[e.from,e.to]))
      : null
  ), [visualEdges, activeId]);
  /* 옮긴 자리는 **층마다** 따로 기억한다. 같은 노드가 어느 층에서는 자식이고
     다른 층에서는 한가운데 초점이라, id 하나로 기억하면 자식일 때 옮겨 둔
     자리가 초점일 때까지 따라와 가운데를 비운다. */
  const posKey = useCallback((id) => `${activeFocus}@${id}`, [activeFocus]);
  const getPos = useCallback(
    (n) => positions[posKey(n.id)] || { x: n.x, y: n.y },
    [positions, posKey],
  );

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
   * 이번 화면에서 이름을 보여줄 노드들.
   *
   * 규칙(순위·네 자리·장애물·포기)은 `lib/graphLabels.js` 에 있다. 화면 코드에
   * 묻혀 있는 동안에는 한 줄도 시험해 볼 수 없었다.
   */
  const shownLabels = useMemo(
    () => placeLabels({
      nodes, screenOf, canvas: canvasBox, scale: view.scale,
      activeId, matchedSet, connectedIds,
    }),
    [nodes, canvasBox, screenOf, view.scale, activeId, matchedSet, connectedIds],
  );

  /**
   * "안에 N개 더 있음" 배지.
   *
   * 자식이 있는 노드에만 붙는다. 눌러서 들어가는 것이 아니라 **얼마나 들어 있는지**
   * 를 미리 알려 주는 표시다 — 들어가는 것은 노드를 누르면 된다. 숫자가 없으면
   * 어느 가지가 깊은지 모른 채 하나씩 들어가 봐야 한다.
   */
  const drillChips = useMemo(() => {
    if (!canvasBox.w) return [];
    const out = [];
    for (const n of nodes) {
      if (n.id === activeFocus) continue;               // 가운데 노드는 이미 여기다
      const kids = childMap.get(n.id)?.length ?? 0;
      if (!kids) continue;                              // 말단은 들어갈 데가 없다
      const s = screenOf(n);
      const x = s.x + s.r * 0.72;
      const y = s.y - s.r * 0.72;
      if (x < -40 || x > canvasBox.w + 40 || y < -20 || y > canvasBox.h + 20) continue;
      out.push({ id: n.id, label: n.label, x, y, count: descendantCount(n.id, childMap) });
    }
    return out;
  }, [nodes, childMap, activeFocus, screenOf, canvasBox]);

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
    setPositions(prev => ({
      ...prev,
      [`${focusRef.current}@${d.id}`]: { x:`${newX.toFixed(1)}%`, y:`${newY.toFixed(1)}%` },
    }));
  }, []);

  const onCanvasUp = useCallback((e) => {
    if (panning.current) {
      const p = panning.current;
      panning.current = null;
      setGrabbing(false);
      // 빈 배경을 **끌지 않고 누르기만** 하면 한 층 위로. 끌었으면 화면을 옮긴
      // 것이므로 아무 일도 하지 않는다(4px 는 노드 클릭과 같은 기준).
      const moved = Math.abs(e.clientX - p.cx) > 4 || Math.abs(e.clientY - p.cy) > 4;
      if (!moved) {
        // 무언가 고른 상태면 그것부터 놓는다 — 보던 것을 놓기도 전에 층이
        // 바뀌면 어디로 갔는지 알 수 없다.
        if (sel || panel) { setSel(null); setPanel(null); } else goUp();
      }
      return;
    }
    const d = dragging.current;
    dragging.current = null;
    if (!d) return;
    if (!d.moved) {
      const n = nodes.find(n=>n.id===d.id);
      if (n) selectNode(n);
    }
  }, [nodes, selectNode, sel, panel, goUp]);

  // ── 줌 · 팬 ─────────────────────────────────────────────
  useEffect(() => { viewRef.current = view; }, [view]);
  // 끌기 처리기는 한 번만 만들어지므로(deps []) 지금 층을 ref 로 읽는다.
  useEffect(() => { focusRef.current = activeFocus; }, [activeFocus]);
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

  /**
   * 보이는 것에 맞춘다.
   *
   * 예전에는 "원래 크기(100%)"로만 돌아갔는데, 접기를 쓰기 시작하면 그게 원하는
   * 일이 아니다 — 가지 하나만 펴 두면 그 가지가 화면 한구석에 작게 남는다.
   * 지금 **보이는 노드 전부**가 들어오도록 맞춘다. 접기와 짝을 이루는 동작이다.
   */
  const fitView = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect?.width || !nodes.length) { setView({ scale: 1, tx: 0, ty: 0 }); return; }
    const pos = positionsRef.current;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of nodes) {
      const p = pos[n.id] || { x: n.x, y: n.y };
      const px = (parseFloat(p.x) / 100) * rect.width;
      const py = (parseFloat(p.y) / 100) * rect.height;
      const r = n.size / 2 + 26;   // 동그라미 + 이름표가 설 자리
      if (px - r < minX) minX = px - r;
      if (px + r > maxX) maxX = px + r;
      if (py - r < minY) minY = py - r;
      if (py + r > maxY) maxY = py + r;
    }
    const w = Math.max(maxX - minX, 1), h = Math.max(maxY - minY, 1);
    const scale = clampScale(Math.min(rect.width / w, rect.height / h));
    setFlying(true);
    setView({
      scale,
      tx: rect.width / 2 - ((minX + maxX) / 2) * scale,
      ty: rect.height / 2 - ((minY + maxY) / 2) * scale,
    });
  }, [nodes]);

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
  // (펴기는 `selectNode` 가 이미 했다.)
  useEffect(() => {
    if (!sel) return;
    const node = allNodes.find((n) => n.id === sel.id);
    if (!node) return;
    /* 파고들어 이 노드가 이번 층의 한가운데가 됐다면, 확대하지 말고 **층에
       맞춘다.**
       `focusNode` 의 135% 확대는 126개가 한 화면에 깔려 있던 시절, 어느 것을
       눌렀는지 되짚기 어려워 만든 동작이다. 층마다 한 화면을 쓰는 지금 그
       확대는 방금 들어온 층의 형제들을 화면 밖으로 밀어낸다 — 들어가서 보려던
       것이 바로 그 형제들인데.
       같은 층 안에서 옆 노드를 고르는 것은 그대로 둔다. 그건 확대해 볼 만하다. */
    if (node.id === activeFocus) fitView();
    else focusNode(node);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [sel?.id, activeFocus]);

  /**
   * 검색 결과 사이를 오간다.
   *
   * 예전에는 **첫 번째 것으로만** 날아갔다. "탐구"로 12개가 걸려도 나머지 11개에
   * 갈 방법이 없어서, 찾긴 찾았는데 못 보는 일이 생겼다. 이제 몇 번째인지 세어
   * 보여주고(3/12) 위아래로 넘긴다.
   */
  const [searchIdx, setSearchIdx] = useState(0);
  // 검색어가 바뀌면 처음부터.
  useEffect(() => { setSearchIdx(0); }, [q]);
  const matchCount = matched?.length ?? 0;
  const curMatch = matchCount ? matched[Math.min(searchIdx, matchCount - 1)] : null;
  useEffect(() => {
    if (!curMatch) return;
    focusToShow(curMatch);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [curMatch]);
  const stepMatch = (d) => {
    if (!matchCount) return;
    setSearchIdx((i) => (i + d + matchCount) % matchCount);
  };

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

  // 빈 곳·이어 볼 만한 짝·넓혀 볼 만한 주제는 전부 "이 그래프에서 다음에 무엇을
  // 볼까"라는 한 물음이라 `components/graph/GraphExplore.jsx` 한자리에 모았다.
  // 불러오기와 그 상태도 거기에 있다 — 여기서 들고 있을 까닭이 없다.

  /** 노드 만들기. 연결할 곳을 골랐으면 만든 뒤 바로 잇는다. */
  const handleCreate = useCallback(async ({ label, section, description, aliases, parentId }) => {
    setBusy(true);
    try {
      const node = await actions.addNode({ label, section, description, aliases });
      if (parentId && node?.id) await actions.connectNodes(parentId, node.id);
      else await actions.loadGraph();
      setPanel(null);
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

  /**
   * 이 노드에 달린 코멘트.
   *
   * 백엔드 코멘트에는 노드 id 가 없다 — `target` 이 자유 문자열이라 이름으로
   * 잇는 수밖에 없다. **취약하다**(이름이 같은 노드가 둘이면 섞이고, 이름을
   * 고치면 끊긴다). 그래도 모든 노드에 같은 코멘트를 뿌리던 것보다는 낫다.
   * 백엔드에 node_id 가 생기면 여기와 `submitComment` 두 곳만 고치면 된다.
   */
  const nodeComments = useMemo(
    () => (sel ? comments.filter((c) => c.target === sel.label) : []),
    [comments, sel],
  );

  // 노드를 옮기면 쓰던 초안은 버린다 — 남겨 두면 엉뚱한 노드에 달린다.
  useEffect(() => { setCommentDraft(""); }, [sel?.id]);

  const submitComment = useCallback(async () => {
    const content = commentDraft.trim();
    if (!sel || !content) return;
    setCommentBusy(true);
    try {
      const created = await api.comments.create({ content, type: "그래프", target: sel.label });
      setComments((cur) => [created, ...cur]);
      setCommentDraft("");
    } catch (e) {
      actions.toast("error", e.message || "코멘트를 남기지 못했습니다.");
    } finally {
      setCommentBusy(false);
    }
  }, [commentDraft, sel, actions]);

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
      const data = await withLoading(
        `'${node.label}' 에서 뻗어 갈 주제를 찾는 중이에요…`,
        () => api.pruning.recommend(node.id),
      );
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

  // 툴바에 있던 「가지치기 추천」 단추는 걷어냈다. 노드를 안 고른 채로 누르면
  // "먼저 노드를 선택하세요"라고 **꾸짖기만** 했는데, 꾸짖는 단추는 기능이 아니라
  // 결함이다. 이 기능은 노드를 고른 뒤에만 뜻이 있으므로 노드 패널 안에만 둔다.

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

  /** 생기부 구획으로 학년·과목 층을 다시 세운다. 여러 번 눌러도 안전하다. */
  const rebuildLayers = useCallback(async () => {
    setMoreOpen(false);
    setRestruct({ busy: true, msg: "" });
    try {
      const r = await withLoading("그래프 층을 다시 세우는 중이에요…", () => api.graph.rebuild());
      await actions.loadGraph(state.session?.user?.id);
      setRestruct({ busy: false, msg: "" });
      // 진행을 알리던 그 자리에서 결과도 알린다.
      showNote(
        r.changed
          ? `층을 다시 세웠습니다 — 교과 ${r.families}개, 구획 ${r.sections}개, 선 ${r.edges_added}개 새로 이음.`
          : "이미 생기부와 같은 모양입니다.",
      );
    } catch (e) {
      setRestruct({ busy: false, msg: "" });
      showNote(e.message);
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [actions, state.session?.user?.id]);

  // 카테고리별 개수 (범례용)
  const kindCounts = nodes.reduce((a,n)=>{ a[n.kind]=(a[n.kind]||0)+1; return a; }, {});

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* 결과 한 줄("층을 다시 세웠습니다 …")은 아래 알림이 맡는다. 진행은
          아래에서 알리고 결과는 위에서 알리면 눈이 두 군데를 오간다.
          여기 남는 것은 **누를 것이 있는 안내**뿐이다. */}
      {noLayers ? (
          // 층이 없으면 들어갈 곳도 없다. 화면이 그 사실을 말해 주지 않으면
          // 학생은 "기능이 고장 났다"고 읽는다 — 실제로 그렇게 읽혔다.
          // 실측: 계정 165개 중 층이 있는 것은 17개뿐이다.
          <div className="graph-note">
            아직 <strong>층이 없습니다</strong> — 개념이 전부 문서에 바로 매달려 있어 들어갈 곳이 없어요.
            <button type="button" className="graph-note-act" disabled={restruct.busy} onClick={rebuildLayers}>
              {restruct.busy ? "세우는 중…" : "층 세우기"}
            </button>
          </div>
      ) : strayCount > 0 && (
          <div className="graph-note">
            이어지지 않은 노드 <strong>{strayCount}개</strong> — 어느 층에도 안 붙어 있어 여기서는 안 보입니다.
            <button type="button" className="graph-note-act" disabled={restruct.busy} onClick={rebuildLayers}>
              {restruct.busy ? "세우는 중…" : "층 다시 세우기"}
            </button>
          </div>
      )}
      {/* 툴바 — 늘 쓰는 것만 밖에 두고 나머지는 「더보기」 안으로.
          예전에는 열 개가 한 줄에 늘어서서 무엇이 중요한지 알 수 없었고,
          좁은 화면에서는 그대로 넘쳐 흘렀다. 으뜸 단추(primary)는 하나뿐이다. */}
      <div className="toolbar toolbar-graph">
        <Btn v="primary" s="sm" onClick={()=>openPanel("create")}><NavIcon name="plusSeed" size={15} color="#fff"/> 노드 추가</Btn>
        {/* 경로표시 — 어디에 있는지와 어떻게 나가는지가 같은 줄에 있다.
            재배치는 **모드**를 만들고, 모드에는 나가는 길이 반드시 있어야 한다.
            깊이 알약(교과/과목/개념)은 없앴다 — 층을 오가는 길이 둘이면 어느 쪽이
            진짜인지 알 수 없고, 이제 층은 초점 하나로 정해진다. */}
        <nav className="gcrumb" aria-label="현재 위치">
          {trail.map((n, i) => (
            <span key={n.id}>
              {i > 0 && <span className="gcrumb-sep" aria-hidden>›</span>}
              <button
                type="button"
                className={`gcrumb-item${i === trail.length - 1 ? " is-here" : ""}`}
                aria-current={i === trail.length - 1 ? "true" : undefined}
                onClick={() => { setFocusId(n.id); setSel(null); }}
              >
                {n.label}
              </button>
            </span>
          ))}
        </nav>
        <Btn v="secondary" s="sm" onClick={()=>openPanel("explore")}>
          <NavIcon name="search" size={15} color={TDS.textSecondary}/> 둘러보기
        </Btn>
        <div style={{flex:1}} />
        {/* ref 는 감싸는 div 가 든다 — `Btn` 은 ref 를 넘겨주지 않는 함수 컴포넌트다.
            Popover 는 앵커 **안쪽** 클릭만 걸러 내면 되므로 감싼 것으로 충분하다. */}
        <div style={{position:"relative"}} ref={moreRef}>
          <Btn v="secondary" s="sm" aria-expanded={moreOpen} onClick={()=>setMoreOpen(o=>!o)}>
            더보기
          </Btn>
          <Popover open={moreOpen} onClose={()=>setMoreOpen(false)} anchorRef={moreRef} label="그래프 도구" align="right">
            <div className="pop-list">
              <button type="button" className="pop-item gpop-item" onClick={()=>{ setMoreOpen(false); onNav("S09"); }}>
                <span className="gpop-ic"><NavIcon name="plusSeed" size={17} color={TDS.primary}/></span>
                <span className="gpop-body">
                  <span className="gpop-t">시드로 생성</span>
                  <span className="gpop-hint">키워드를 넣어 그래프를 시작합니다.</span>
                </span>
              </button>
              {/* 생기부 구획으로 층을 다시 세운다. 예전에 만든 그래프는 별 모양이라
                  이걸 한 번 눌러야 학년·과목이 생긴다. 여러 번 눌러도 안전하다.
                  설명을 hint 로 올렸다 — title 은 마우스를 올려야만 보여서, 정작
                  이 단추를 눌러도 되는지 망설이는 사람에게 닿지 않았다. */}
              <button type="button" className="pop-item gpop-item" disabled={restruct.busy} onClick={rebuildLayers}>
                <span className="gpop-ic"><NavIcon name="graph" size={17} color={TDS.primary}/></span>
                <span className="gpop-body">
                  <span className="gpop-t">{restruct.busy ? "세우는 중…" : "층 다시 세우기"}</span>
                  <span className="gpop-hint">
                    생기부 구획으로 학년·과목 층을 다시 세웁니다. 직접 만든 노드와 손으로 이은 선은 그대로 둡니다.
                  </span>
                </span>
              </button>
              {/* "내보내기" 를 뺐다. 누르면 가던 화면(S29)은 값을 코드에 박아 둔
                  시안이었고 — "전체 데이터 내보내기 2.4 MB · 완료" 가 아무것도
                  하지 않고 떠 있었다 — 서버에 내보내기 자체가 없다. 없는 기능을
                  차림표에 세워 두면, 누른 사람은 자기가 뭘 잘못한 줄 안다. */}
            </div>
          </Popover>
        </div>
        <div className="search-wrap" style={{width:240}}>
          <NavIcon name="graph" size={15} color={TDS.textTertiary}/>
          <input
            placeholder="노드 검색..."
            value={q}
            onChange={e=>setQ(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); stepMatch(e.shiftKey?-1:1); } }}
          />
          {q.trim() && (
            <span className="gsearch-nav">
              <span className="gsearch-count">{matchCount ? `${Math.min(searchIdx, matchCount-1)+1}/${matchCount}` : "0"}</span>
              <button type="button" onClick={()=>stepMatch(-1)} disabled={!matchCount} aria-label="이전 결과">↑</button>
              <button type="button" onClick={()=>stepMatch(1)} disabled={!matchCount} aria-label="다음 결과">↓</button>
            </span>
          )}
        </div>
      </div>
      {/* 캔버스 + 패널. 좁은 화면에서 세로로 나뉘어야 하므로 인라인이 아니라
          클래스로 둔다 — 인라인 스타일에는 @media 를 걸 수 없다. */}
      <div className="gbody">
        {/* Canvas */}
        <div className="gstage">
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
                {/* 문구는 아래 알림이 맡는다. 여기까지 적으면 같은 말이 두 번이다. */}
                <div className="spinner" />
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

            {/* 엣지·노드는 `view` 를 모른다 — 위 레이어의 transform 이 대신한다.
                (자세한 까닭은 GraphEdges 위 주석) */}
            <GraphEdges visualEdges={visualEdges} byId={byId} getPos={getPos} activeId={activeId} />
            <GraphNodes
              nodes={nodes} getPos={getPos}
              matchedSet={matchedSet} connectedIds={connectedIds} activeId={activeId}
              draggingId={dragging.current?.id ?? null}
              onNodeDown={onNodeDown} onHover={setHover}
              drillableIds={drillableIds} onDrill={selectNode}
            />
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
                    onClick={()=>{ const n = nodes.find(x=>x.id===id); if(n) selectNode(n); }}
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

            {/* 접기 손잡이 — 이름표와 **같은 층**(화면 좌표)에 그린다.
                줌 레이어 안에 두면 축소했을 때 같이 작아져서 누를 수 없다.
                자식이 있는 노드에만 붙고, 접혀 있으면 자손 수를 달아 준다 —
                "무엇이 접혀 있는지" 를 숫자로라도 남기지 않으면 사라진 걸로 읽힌다. */}
            <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:Z.label,overflow:"hidden"}}>
              {drillChips.map((c) => (
                <span key={c.id} className="g-fold"
                  title={`안에 ${c.count}개 더 있습니다 — 눌러서 들어가기`}
                  aria-hidden
                  style={{left:c.x, top:c.y}}>
                  {c.count}
                </span>
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

            {/* 범례 (좌상단) — 색은 유형, 아이콘은 과목.
                평소에는 접어 둔다. 한 번 읽으면 그만인 표인데 늘 펴 두면
                캔버스 왼쪽 위 한 뼘을 계속 차지하고, 노드가 그 아래로 들어가면
                가려진다. 궁금할 때만 편다. */}
            {!!nodes.length && (
              <div
                data-graph-panel
                className={`glegend${legendOpen ? " is-open" : ""}`}
                style={{...OVERLAY_SURFACE, zIndex:Z.panel}}
              >
                <button
                  type="button"
                  className="glegend-toggle"
                  aria-expanded={legendOpen}
                  onClick={()=>setLegendOpen(o=>!o)}
                >
                  <NavIcon name="idea" size={14} color={OVERLAY_TEXT.secondary}/>
                  <span className="glegend-toggle-t">범례</span>
                  <NavIcon name="chevronDown" size={13} color={OVERLAY_TEXT.tertiary}/>
                </button>
                {/* 읽기만 하는 판이라 손을 막으면 안 된다. 그대로 두면 아래
                    노드를 누를 수 없어 좌상단 구획이 통째로 죽는다(실제로 그랬다). */}
                {legendOpen && (
                  <div className="glegend-body">
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
                    <div style={{height:1,background:"rgba(15,23,42,.08)",margin:"10px -14px 10px"}} />
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
              </div>
            )}

            {/* 개수 (우상단).
                판 두 개가 나란히 서서 자리를 넓게 먹고, 아이콘 둘이 서로 다른
                색이라 캔버스 위에서 유난히 튀었다. 알약 하나에 모으고 색은
                걷는다 — 이건 지금 몇 개가 떠 있는지 알려 주는 값이지 눌러야 할
                것이 아니다. */}
            {!!nodes.length && (
              <div data-graph-panel className="gcount" style={{zIndex:Z.panel}}>
                <span className="gcount-n">{nodes.length}</span>
                <span className="gcount-l">노드</span>
                <span className="gcount-sep" aria-hidden />
                <span className="gcount-n">{edges.length}</span>
                <span className="gcount-l">연결</span>
              </div>
            )}

            {/* 줌 컨트롤 — 휠/드래그와 같은 상태를 쓴다 */}
            {/* 오른쪽 아래는 녹음 도크가 쓰는 자리다. 겹치지 않게 왼쪽에 둔다 —
                두 조작부가 같은 모서리에 있으면 어느 쪽을 누르는지 헷갈린다. */}
            <div data-graph-panel style={{position:"absolute",bottom:16,left:16,zIndex:Z.panel,display:"flex",flexDirection:"column",gap:6}}>
              {[
                { key:"in",    text:"+", title:"확대",       onClick:()=>zoomByButton(ZOOM.step) },
                { key:"out",   text:"−", title:"축소",       onClick:()=>zoomByButton(1/ZOOM.step) },
                { key:"reset", text:"⤾", title:"보이는 것에 맞추기", onClick:fitView },
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

        {/* ── 옆 패널 — 자리는 하나다 ────────────────────────────
            고른 노드가 언제나 이긴다. 만들기·둘러보기는 노드를 고르는 순간
            비켜난다(§14: 패널을 둘로 늘리면 좁은 화면에서 캔버스가 사라진다). */}

        {!sel && panel === "create" && (
          <GraphPanel title="노드 추가" onClose={closePanel}>
            <NodeEditor
              mode="create"
              nodes={nodes}
              defaultParentId={nodes.find(n=>n.kind==="root")?.id || ""}
              busy={busy}
              onSubmit={handleCreate}
              onCancel={closePanel}
            />
          </GraphPanel>
        )}

        {!sel && panel === "explore" && (
          <GraphPanel title="둘러보기" onClose={closePanel}>
            <GraphExplore
              onOpenDoc={(s)=>{
                sessionStorage.setItem("mbx_doc_id", s.section_id);
                sessionStorage.setItem("mbx_doc_type", s.section_type || "");
                sessionStorage.setItem("mbx_doc_subject", "");
                onNav("S12");
              }}
              // 접혀서 지금 안 보이는 노드도 고를 수 있어야 한다. 빈 곳·관계는
              // 그래프 **전체**를 뒤져 알려 주는데, 골랐을 때 아무 일도 안 일어나면
              // 알려 준 쪽이 거짓말한 꼴이 된다. selectNode 가 그 위를 펴 준다.
              onPickNode={(id)=>{
                const n = allNodes.find((x)=>x.id===id);
                if (n) selectNode(n);
              }}
              onConnect={(from, to)=>actions.connectNodes(from, to)}
              onGraphChanged={()=>actions.loadGraph(state.session?.user?.id)}
              onError={(m)=>actions.toast("error", m)}
            />
          </GraphPanel>
        )}

        {/* Detail panel */}
        {sel&&(()=>{ const eList=edgesOf(sel.id); const meta=KIND_META[sel.kind]||KIND_META.topic; return (
          <GraphPanel
            title="노드"
            onClose={closePanel}
            /* 뿌리 층에서는 나갈 데가 없다 — 없는 길을 단추로 세우지 않는다. */
            onBack={trail.length > 1 ? () => { setSel(null); goUp(); } : undefined}
            backLabel={trail.length > 1 ? trail[trail.length - 2].label : ""}
          >
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
              <div style={{width:56,height:56,borderRadius:"50%",background:`radial-gradient(circle at 35% 30%, ${meta.color}, ${meta.color}dd)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:`0 4px 14px ${meta.ring}`,border:"2px solid rgba(255,255,255,.35)"}}>
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
            {/* 캔버스에서 이름표를 누르면 바로 들어가지만, 패널에서 읽다가
                "들어가 볼까" 싶어질 때의 자리도 있어야 한다. */}
            {!editing && !confirmDelete && drillableIds.has(sel.id) && sel.id !== activeFocus && (
              <Btn v="ghost" s="sm" style={{marginTop:8,width:"100%"}} onClick={()=>setFocusId(sel.id)}>
                여기서부터 보기
              </Btn>
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

            {/* ── 구획들 ──────────────────────────────────────────
                예전에는 출처·연결·추천·코멘트가 끊김 없이 230줄 이어져서, 「수정」을
                누르려고 끝까지 내려가는 일이 생겼다. 탭이 아니라 디스클로저를 쓰는
                까닭은 접혀 있어도 제목과 개수가 남기 때문이다 — 탭은 그것이 있다는
                사실 자체를 감춘다(폐지한 S07 의 4탭이 정확히 그 실패였다). */}
            {!editing && !confirmDelete && (
              <div style={{marginTop:16}}>
                {/* 출처가 맨 위인 까닭: 고치거나 지우려는 순간에는 판단할 근거가
                    먼저 필요하다. */}
                <Section
                  title="출처"
                  open={openSections.has("evidence")}
                  onToggle={()=>toggleSection("evidence")}
                >
                  {/* 노드가 무엇이든 **같은 모양**으로 보여준다. 예전에는 구획
                      노드일 때 출처 칸을 통째로 비우고 "이 글 열기" 만 세웠는데,
                      노드마다 이 칸의 생김새가 달라져서 무엇을 보는 자리인지 매번
                      다시 읽어야 했다. 구획 노드는 자기 자신이 출처이므로 서버가
                      그 구획의 문장을 돌려준다. 원문으로 가는 길은 그 아래에. */}
                  <NodeEvidence nodeId={sel.id} label={sel.label} />
                  {sel.sectionId && (
                    <button
                      type="button"
                      className="node-open"
                      onClick={() => {
                        sessionStorage.setItem("mbx_doc_id", sel.sectionId);
                        sessionStorage.setItem("mbx_doc_type", "");
                        sessionStorage.setItem("mbx_doc_subject", "");
                        onNav("S12");
                      }}
                    >
                      생기부에서 이 글 열기 →
                    </button>
                  )}
                </Section>

                <Section
                  title="연결"
                  open={openSections.has("links")}
                  onToggle={()=>toggleSection("links")}
                >
                  <NodeConnections
                    node={sel}
                    edges={edges}
                    nodes={nodes}
                    busy={busy}
                    onConnect={handleConnect}
                    onDisconnect={handleDisconnect}
                  />
                </Section>

                <Section
                  title="다음 탐구"
                  open={openSections.has("prune")}
                  onToggle={()=>toggleSection("prune")}
                >
            {/* 안내문을 지웠다. 칸 이름이 이미 "다음 탐구" 이고 단추에 "추천
                받기" 라고 적혀 있어서, 그 사이의 한 줄은 같은 말을 세 번째로
                하고 있었다. 단추는 칸을 가득 채운다 — 이 칸에서 할 일이 그것
                하나뿐이라 구석에 작게 둘 이유가 없다. */}
            <button
              type="button"
              className="prune-go"
              disabled={!!prune?.loading}
              onClick={()=>runPrune(sel)}
            >
              {prune?.loading ? "생성 중…" : prune?.items?.length ? "다시 추천 받기" : "추천 받기"}
            </button>

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

                </Section>

                {/* 코멘트 — 이 노드에 달린 것만.
                    예전에는 `api.comments.list()` 를 전역으로 불러 **모든 노드에 같은
                    코멘트**가 떴다. 백엔드 코멘트에는 노드 id 가 없고 `target` 이
                    자유 문자열이라, 지금 이을 수 있는 고리는 이름뿐이다 —
                    이름이 같은 노드가 둘이면 섞이고 이름을 고치면 끊긴다.
                    백엔드에 node_id 가 생기면 이 두 줄만 바꾸면 된다. */}
                <Section
                  title="코멘트"
                  open={openSections.has("comments")}
                  onToggle={()=>toggleSection("comments")}
                >
                  {/* "코멘트가 없습니다" 를 지웠다. 바로 아래 빈 칸이 이미
                      그 말을 하고 있어서, 없다는 사실을 두 번 알리고 있었다. */}
                  {nodeComments.slice(0,5).map((c)=>(
                    <div key={c.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 12px",background:TDS.bgTertiary,borderRadius:10,marginBottom:8}}>
                      <div style={{width:28,height:28,borderRadius:"50%",background:TDS.blue50,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:12,fontWeight:700,color:TDS.blue500}}>
                        {c.author?.[0]??"?"}
                      </div>
                      <div style={{minWidth:0,flex:1}}>
                        <div style={{fontSize:12,fontWeight:700,color:TDS.textPrimary,marginBottom:2}}>{c.author}</div>
                        <div style={{fontSize:12,color:TDS.textSecondary,lineHeight:1.55,wordBreak:"keep-all"}}>{c.content}</div>
                      </div>
                    </div>
                  ))}
                  {/* 쓰는 자리도 여기다. 다른 화면(S24)으로 보내면 방금 보던 노드와
                      쓰는 자리가 떨어져서, 무엇에 대해 쓰는 중인지 잊는다. */}
                  {/* `.inp` 은 height:40px 인 한 줄 입력이다. 함께 걸면 그 높이가
                      이겨서 여러 줄 칸이 한 줄로 눌린다 — 보고서·녹음 화면에서
                      났던 것과 같은 자리다. `.textarea` 만 쓴다.
                      따옴표로 이름을 감싸던 것도 걷었다. 이름에 따옴표가 들어
                      있으면 어긋나고, 굳이 감싸지 않아도 무엇에 쓰는지는 이 칸이
                      노드 상세 안에 있다는 것으로 이미 말한다. */}
                  <textarea
                    className="textarea gcomment-write"
                    placeholder={`${sel.label}에 남길 말…`}
                    value={commentDraft}
                    onChange={(e)=>setCommentDraft(e.target.value)}
                  />
                  <Btn
                    v="primary" s="sm" style={{marginTop:8,width:"100%"}}
                    disabled={commentBusy || !commentDraft.trim()}
                    onClick={submitComment}
                  >
                    {commentBusy ? "남기는 중…" : "코멘트 남기기"}
                  </Btn>
                </Section>
              </div>
            )}
          </GraphPanel>
        ); })()}
      </div>
    </div>
  );
}

/* S11 텍스트 영역 */

