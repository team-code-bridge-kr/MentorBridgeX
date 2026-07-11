import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function S25() {
  const seed=[
    {id:"n1",ic:"comment",t:"새 코멘트",d:"김선생님이 양자컴퓨팅 노드에 코멘트를 남겼습니다.",time:"10분 전",read:false},
    {id:"n2",ic:"text",t:"PDF 파싱 완료",d:"생기부 PDF 분석이 완료되었습니다. 결과를 확인하세요.",time:"1시간 전",read:false},
    {id:"n3",ic:"graph",t:"가지치기 추천",d:"8개의 새로운 노드 가지치기 추천이 있습니다.",time:"3시간 전",read:false},
    {id:"n4",ic:"form",t:"양식 생성 완료",d:"화학과 지원용 자소서가 생성되었습니다.",time:"어제",read:true},
    {id:"n5",ic:"bell",t:"시스템 공지",d:"2026년 2학기 생기부 제출 마감일 안내",time:"3일 전",read:true},
  ];
  const [items,setItems]=useState(seed);
  const [tab,setTab]=useState("전체");
  const unread=items.filter(n=>!n.read).length;
  const markAll=()=>setItems(p=>p.map(n=>({...n,read:true})));
  const markOne=id=>setItems(p=>p.map(n=>n.id===id?{...n,read:true}:n));
  const shown=items.filter(n=>tab==="전체"?true:tab==="안 읽음"?!n.read:n.read);

  return (
    <div className="content"><div className="content-narrow">
      <div className="row-between mb16" style={{marginBottom:16}}>
        <div className="row" style={{gap:10,alignItems:"center"}}>
          <div className="sec-title" style={{marginBottom:0}}>알림</div>
          {unread>0 && <span className="badge-num">{unread}</span>}
        </div>
        <Btn v="secondary" s="sm" onClick={markAll} disabled={!unread}>모두 읽음 처리</Btn>
      </div>

      <div className="tab-pill-wrap" style={{marginBottom:16}}>
        {[["전체",items.length],["안 읽음",unread],["읽음",items.length-unread]].map(([t,c])=>(
          <div key={t} className={`tab-pill${tab===t?" active":""}`} onClick={()=>setTab(t)}>{t} ({c})</div>
        ))}
      </div>

      {!shown.length && <div style={{textAlign:"center",padding:"48px 0",color:TDS.textTertiary,fontSize:14}}>알림이 없습니다</div>}

      {shown.map(n=>(
        <div key={n.id} onClick={()=>markOne(n.id)} style={{padding:"16px 18px",borderRadius:14,marginBottom:10,background:n.read?TDS.bgPrimary:TDS.blue50,border:`1px solid ${n.read?TDS.borderDefault:TDS.blue100}`,display:"flex",gap:14,cursor:"pointer",alignItems:"flex-start",transition:"background .15s",position:"relative"}}>
          {!n.read && <div style={{position:"absolute",left:6,top:22,width:7,height:7,borderRadius:"50%",background:TDS.blue500}} />}
          <div style={{width:38,height:38,borderRadius:10,background:n.read?TDS.bgTertiary:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginLeft:n.read?0:6}}>
            <NavIcon name={n.ic} size={20} color={n.read?TDS.textTertiary:TDS.blue500} />
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:15,fontWeight:n.read?500:700,color:TDS.textPrimary}}>{n.t}</div>
            <div style={{fontSize:13,color:TDS.textSecondary,marginTop:3,lineHeight:1.5}}>{n.d}</div>
          </div>
          <div style={{fontSize:12,color:TDS.textTertiary,flexShrink:0,whiteSpace:"nowrap"}}>{n.time}</div>
        </div>
      ))}
    </div></div>
  );
}

/* S27 통합 검색 */

