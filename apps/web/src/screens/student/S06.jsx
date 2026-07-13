import { useState, useEffect, useRef, useCallback } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { KIND_META } from "../../theme/graphMeta.js";
import { Btn, Badge, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";
import api from "../../api/index.js";

export function S06({ onNav }) {
  const { state, actions } = useStore();
  const { nodes, edges, loading } = state.graph;
  const [sel, setSel] = useState(null);
  const [hover, setHover] = useState(null);
  const [q, setQ] = useState("");
  const [comments, setComments] = useState([]);
  // 노드 위치 로컬 상태 (드래그로 변경)
  const [positions, setPositions] = useState({});
  // 드래그 상태: { id, startCX, startCY, origXpct, origYpct, moved }
  const dragging = useRef(null);
  const canvasRef = useRef(null);

  // 최초 진입 시 그래프가 비어있으면 로드
  useEffect(()=>{ if(!nodes.length && !loading) actions.loadGraph(state.session?.user?.id); /* eslint-disable-next-line */ }, []);
  // 선택 노드가 삭제되면 패널 닫기
  useEffect(()=>{ if(sel && !nodes.find(n=>n.id===sel.id)) setSel(null); }, [nodes, sel]);
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
  const handlePrune = async () => {
    const sug = await api.graph.pruneSuggestions(state.session?.user?.id);
    if (sug.length) actions.toast("info", `가지치기 추천 ${sug.length}건 — 상세는 S23에서 확인`);
    onNav("S23");
  };

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
              return (
                <div key={n.id}
                  onMouseDown={(e)=>onNodeDown(e,n)}
                  onMouseEnter={()=>setHover(n.id)} onMouseLeave={()=>setHover(null)}
                  style={{position:"absolute",left:pos.x,top:pos.y,transform:`translate(-50%,-50%) scale(${isActive?1.12:1})`,display:"flex",flexDirection:"column",alignItems:"center",gap:5,cursor:isDraggingThis?"grabbing":"grab",transition:isDraggingThis?"none":"transform .2s, opacity .2s",opacity:dim?.28:1,zIndex:isDraggingThis?10:isActive?4:2}}>
                  <div style={{width:n.size,height:n.size,borderRadius:"50%",background:`radial-gradient(circle at 35% 30%, ${n.color}, ${n.color}dd)`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",boxShadow:isActive?`0 0 0 4px ${TDS.bgPrimary}, 0 0 0 7px ${n.color}, 0 8px 24px ${meta.ring}`:`0 4px 14px rgba(0,0,0,.2)`,border:`2px solid rgba(255,255,255,.35)`}}>
                    <NavIcon name={meta.icon} size={n.size>50?24:n.size>40?19:15} color="#fff"/>
                  </div>
                  <span style={{fontSize:n.size>50?12:11,fontWeight:700,color:TDS.textPrimary,background:TDS.bgPrimary,padding:"2px 8px",borderRadius:10,boxShadow:"0 1px 4px rgba(0,0,0,.1)",whiteSpace:"nowrap",border:`1px solid ${TDS.borderDefault}`}}>{n.label}</span>
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

