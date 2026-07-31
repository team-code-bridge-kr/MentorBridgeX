import { useState, useEffect, useRef, useCallback } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { KIND_META } from "../../theme/graphMeta.js";
import { Btn, Badge, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";
import api from "../../api/index.js";

// 이 개수를 넘으면 라벨을 선택적으로만 표시한다 (전부 그리면 겹쳐서 못 읽음).
const DENSE_THRESHOLD = 30;
// 라벨 pill 이 지나치게 길어지지 않도록 자르는 기준 (전체 문구는 title 로 노출).
const LABEL_MAX = 14;

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
  // 노드 위치 로컬 상태 (드래그로 변경)
  const [positions, setPositions] = useState({});
  // 드래그 상태: { id, startCX, startCY, origXpct, origYpct, moved }
  const dragging = useRef(null);
  const canvasRef = useRef(null);

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
  const matched = q.trim() ? nodes.filter(n=>n.label.includes(q.trim())).map(n=>n.id) : null;
  const activeId = hover || sel?.id || null;
  const connectedIds = activeId ? new Set(edgesOf(activeId).flatMap(e=>[e.from,e.to])) : null;
  const getPos = useCallback((n) => positions[n.id] || {x:n.x, y:n.y}, [positions]);
  // 이 개수를 넘으면 라벨을 전부 그려도 겹쳐서 못 읽는다 → 선택적으로만 표시
  const dense = nodes.length > DENSE_THRESHOLD;

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
    const d = dragging.current;
    if (!d) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dx = e.clientX - d.startCX;
    const dy = e.clientY - d.startCY;
    if (!d.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    dragging.current.moved = true;
    const newX = Math.max(4, Math.min(96, d.origX + (dx / rect.width) * 100));
    const newY = Math.max(4, Math.min(96, d.origY + (dy / rect.height) * 100));
    setPositions(prev => ({...prev, [d.id]: {x:`${newX.toFixed(1)}%`, y:`${newY.toFixed(1)}%`}}));
  }, []);

  const onCanvasUp = useCallback((e) => {
    const d = dragging.current;
    dragging.current = null;
    if (!d) return;
    if (!d.moved) {
      const n = nodes.find(n=>n.id===d.id);
      if (n) setSel(s => s?.id===n.id ? null : n);
    }
  }, [nodes]);

  const handleDelete = async (id) => { await actions.deleteNode(id); };

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
        <Btn v="primary" s="sm" onClick={()=>onNav("S09")}><NavIcon name="plusSeed" size={15} color="#fff"/> 시드 추가</Btn>
        <Btn v="secondary" s="sm" onClick={()=>onNav("S10")}><NavIcon name="history" size={15} color={TDS.textSecondary}/> 변경 이력</Btn>
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
            onMouseMove={onCanvasMove}
            onMouseUp={onCanvasUp}
            onMouseLeave={onCanvasUp}
            style={{height:"100%",background:`radial-gradient(circle at 50% 40%, ${TDS.bgSecondary} 0%, ${TDS.bgTertiary} 100%)`,borderRadius:16,position:"relative",border:`1px solid ${TDS.borderDefault}`,overflow:"hidden",userSelect:"none"}}
          >
            {/* 도트 격자 배경 */}
            <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:.5,pointerEvents:"none"}}>
              <defs>
                <pattern id="gdots" width="26" height="26" patternUnits="userSpaceOnUse">
                  <circle cx="1.5" cy="1.5" r="1.5" fill={TDS.borderDefault} />
                </pattern>
                <linearGradient id="edgeGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={TDS.blue400} stopOpacity=".9"/>
                  <stop offset="100%" stopColor="#22c55e" stopOpacity=".7"/>
                </linearGradient>
              </defs>
              <rect width="100%" height="100%" fill="url(#gdots)" />
            </svg>

            {loading && (
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12,color:TDS.textTertiary,zIndex:5}}>
                <div className="spinner" /><div style={{fontSize:13}}>그래프 불러오는 중…</div>
              </div>
            )}
            {!loading && !nodes.length && (
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14,color:TDS.textTertiary}}>
                <NavIcon name="branch" size={44} color={TDS.borderStrong}/>
                <div style={{fontSize:14}}>아직 노드가 없습니다</div>
                <Btn v="primary" s="sm" onClick={()=>onNav("S09")}><NavIcon name="plusSeed" size={14} color="#fff"/> 첫 시드 추가하기</Btn>
              </div>
            )}

            {/* 엣지 — 곡선 + 활성 노드 연결선 강조 (viewBox % 좌표계) */}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}>
              {edges.map(e=>{
                const a=nodeById(e.from), b=nodeById(e.to);
                if(!a||!b) return null;
                const on = activeId && (e.from===activeId||e.to===activeId);
                const pa=getPos(a), pb=getPos(b);
                const ax=parseFloat(pa.x), ay=parseFloat(pa.y), bx=parseFloat(pb.x), by=parseFloat(pb.y);
                const mx=(ax+bx)/2, my=(ay+by)/2 - 4;
                return (
                  <path key={e.id}
                    d={`M ${ax} ${ay} Q ${mx} ${my} ${bx} ${by}`}
                    fill="none"
                    stroke={on?"url(#edgeGrad)":TDS.borderStrong}
                    strokeWidth={on?0.6:0.35}
                    vectorEffect="non-scaling-stroke"
                    strokeDasharray={on?"none":"1 1"}
                    opacity={activeId && !on ? .25 : (on?.95:.6)}
                    style={{transition:"opacity .2s, stroke-width .2s"}}
                  />
                );
              })}
            </svg>

            {/* 노드 — kind 아이콘 + 라벨 pill */}
            {nodes.map(n=>{
              const dimSearch = matched && !matched.includes(n.id);
              const dimActive = connectedIds && n.id!==activeId && !connectedIds.has(n.id);
              const dim = dimSearch || dimActive;
              const isActive = n.id===activeId;
              const isDraggingThis = dragging.current?.id === n.id;
              const meta = KIND_META[n.kind] || KIND_META.topic;
              const pos = getPos(n);
              // 노드가 많으면 라벨을 전부 그릴 때 서로 겹쳐 오히려 못 읽는다.
              // 밀집 상태에서는 핵심 노드와 지금 보고 있는 것만 라벨을 남긴다.
              const showLabel =
                !dense || n.kind==="root" || isActive ||
                (connectedIds?.has(n.id) ?? false) ||
                (matched?.includes(n.id) ?? false);
              const shortLabel =
                n.label.length > LABEL_MAX ? `${n.label.slice(0, LABEL_MAX)}…` : n.label;
              return (
                <div key={n.id}
                  onMouseDown={(e)=>onNodeDown(e,n)}
                  onMouseEnter={()=>setHover(n.id)} onMouseLeave={()=>setHover(null)}
                  style={{position:"absolute",left:pos.x,top:pos.y,transform:`translate(-50%,-50%) scale(${isActive?1.12:1})`,display:"flex",flexDirection:"column",alignItems:"center",gap:5,cursor:isDraggingThis?"grabbing":"grab",transition:isDraggingThis?"none":"transform .2s, opacity .2s",opacity:dim?.28:1,zIndex:isDraggingThis?10:isActive?4:2}}>
                  <div style={{width:n.size,height:n.size,borderRadius:"50%",background:`radial-gradient(circle at 35% 30%, ${n.color}, ${n.color}dd)`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",boxShadow:isActive?`0 0 0 4px ${TDS.bgPrimary}, 0 0 0 7px ${n.color}, 0 8px 24px ${meta.ring}`:`0 4px 14px rgba(0,0,0,.2)`,border:`2px solid rgba(255,255,255,.35)`}}>
                    <NavIcon name={meta.icon} size={n.size>50?24:n.size>40?19:15} color="#fff"/>
                  </div>
                  {showLabel && (
                    <span title={n.label} style={{fontSize:n.size>50?12:11,fontWeight:700,color:TDS.textPrimary,background:TDS.bgPrimary,padding:"2px 8px",borderRadius:10,boxShadow:"0 1px 4px rgba(0,0,0,.1)",whiteSpace:"nowrap",border:`1px solid ${TDS.borderDefault}`,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis"}}>{shortLabel}</span>
                  )}
                </div>
              );
            })}

            {/* 범례 (좌상단) */}
            {!!nodes.length && (
              <div style={{position:"absolute",top:16,left:16,background:TDS.bgPrimary,border:`1px solid ${TDS.borderDefault}`,borderRadius:12,padding:"12px 14px",boxShadow:"0 4px 16px rgba(0,0,0,.08)",minWidth:150}}>
                <div style={{fontSize:11,fontWeight:700,color:TDS.textTertiary,marginBottom:8,letterSpacing:".02em"}}>노드 유형</div>
                {["root","topic","leaf"].map(k=>{
                  const m=KIND_META[k]; const c={root:"#3182f6",topic:"#4593fc",leaf:"#22c55e"}[k];
                  return (
                    <div key={k} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                      <div style={{width:22,height:22,borderRadius:"50%",background:c,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        <NavIcon name={m.icon} size={13} color="#fff"/>
                      </div>
                      <span style={{fontSize:12,color:TDS.textSecondary,flex:1}}>{m.label}</span>
                      <span style={{fontSize:12,fontWeight:700,color:TDS.textPrimary}}>{kindCounts[k]||0}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 통계 배지 (우상단) */}
            {!!nodes.length && (
              <div style={{position:"absolute",top:16,right:16,display:"flex",gap:8}}>
                <div style={{background:TDS.bgPrimary,border:`1px solid ${TDS.borderDefault}`,borderRadius:10,padding:"8px 12px",display:"flex",alignItems:"center",gap:7,boxShadow:"0 2px 10px rgba(0,0,0,.06)"}}>
                  <NavIcon name="core" size={15} color={TDS.blue500}/>
                  <span style={{fontSize:13,fontWeight:700,color:TDS.textPrimary}}>{nodes.length}</span>
                  <span style={{fontSize:12,color:TDS.textTertiary}}>노드</span>
                </div>
                <div style={{background:TDS.bgPrimary,border:`1px solid ${TDS.borderDefault}`,borderRadius:10,padding:"8px 12px",display:"flex",alignItems:"center",gap:7,boxShadow:"0 2px 10px rgba(0,0,0,.06)"}}>
                  <NavIcon name="branch" size={15} color="#22c55e"/>
                  <span style={{fontSize:13,fontWeight:700,color:TDS.textPrimary}}>{edges.length}</span>
                  <span style={{fontSize:12,color:TDS.textTertiary}}>연결</span>
                </div>
              </div>
            )}

            {/* 줌 컨트롤 */}
            <div style={{position:"absolute",bottom:16,right:16,display:"flex",flexDirection:"column",gap:6}}>
              {["+","−"].map(z=>(
                <button key={z} style={{width:36,height:36,padding:0,display:"flex",alignItems:"center",justifyContent:"center",background:TDS.bgPrimary,border:`1px solid ${TDS.borderDefault}`,borderRadius:10,cursor:"pointer",fontSize:18,fontWeight:600,color:TDS.textSecondary,boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>{z}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Detail panel */}
        {sel&&(()=>{ const eList=edgesOf(sel.id); const meta=KIND_META[sel.kind]||KIND_META.topic; return (
          <div style={{width:360,background:TDS.bgPrimary,borderLeft:`1px solid ${TDS.borderDefault}`,padding:24,overflowY:"auto"}}>
            <div className="row-between mb16" style={{marginBottom:16}}>
              <span style={{fontSize:16,fontWeight:700,color:TDS.textPrimary}}>노드 상세</span>
              <button onClick={()=>setSel(null)} style={{background:TDS.bgTertiary,border:"none",width:28,height:28,borderRadius:8,cursor:"pointer",color:TDS.textSecondary}}>✕</button>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
              <div style={{width:56,height:56,borderRadius:"50%",background:`radial-gradient(circle at 35% 30%, ${sel.color}, ${sel.color}dd)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:`0 4px 14px ${meta.ring}`,border:"2px solid rgba(255,255,255,.35)"}}>
                <NavIcon name={meta.icon} size={26} color="#fff"/>
              </div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:20,fontWeight:800,color:TDS.textPrimary,marginBottom:4}}>{sel.label}</div>
                <Badge t="blue">{sel.cat}</Badge>
              </div>
            </div>
            <Divider my={16} />

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
            <p style={{fontSize:12,fontWeight:600,color:TDS.textTertiary,marginBottom:10}}>연결된 엣지 {eList.length}개</p>
            {eList.length ? eList.map((e,i)=>{
              const other = nodeById(e.from===sel.id?e.to:e.from);
              const om = KIND_META[other?.kind]||KIND_META.topic;
              return (
              <div key={e.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:TDS.bgTertiary,borderRadius:10,marginBottom:8}}>
                <div style={{width:30,height:30,borderRadius:"50%",background:other?.color||TDS.borderStrong,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <NavIcon name={om.icon} size={15} color="#fff"/>
                </div>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:TDS.textPrimary}}>{other?.label||"—"}</div>
                  <div style={{fontSize:12,color:TDS.textTertiary}}>{"하위 개념,연관 분야,선수 지식,응용 분야".split(",")[i%4]}</div>
                </div>
              </div>
              );
            }) : <div style={{fontSize:13,color:TDS.textDisabled}}>연결된 엣지가 없습니다</div>}
            <Divider my={16} />
            <p style={{fontSize:12,fontWeight:600,color:TDS.textTertiary,marginBottom:10}}>임베딩 미리보기</p>
            <div style={{background:TDS.bgTertiary,borderRadius:10,padding:12,fontSize:11,color:TDS.textSecondary,fontFamily:"monospace"}}>
              [0.234, 0.891, -0.123, 0.567, ...]
            </div>
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
              <Btn v="secondary" s="md" style={{width:"100%",color:TDS.danger}} onClick={()=>handleDelete(sel.id)}>노드 삭제</Btn>
            </div>
          </div>
        ); })()}
      </div>
    </div>
  );
}

/* S11 텍스트 영역 */

