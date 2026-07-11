import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function S21({ onNav }) {
  const items=[
    {id:0,title:"화학과 지원 자기소개서",tpl:"자기소개서 A",created:"2026-01-20",status:"완료"},
    {id:1,title:"물리학 세특 보고서",tpl:"세특 요약",created:"2026-01-15",status:"완료"},
    {id:2,title:"대학원 진학 계획서",tpl:"진학 계획 A",created:"2026-01-10",status:"완료"},
  ];
  return (
    <div className="content" style={{maxWidth:700,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontSize:20,fontWeight:700}}>양식 결과물 목록</div>
        <Btn v="primary" s="sm" onClick={()=>onNav("S20")}>+ 새로 생성</Btn>
      </div>
      {items.length===0
        ? <div className="empty"><TFI s={48}>📄</TFI><div className="empty-title">생성한 양식이 없습니다</div><Btn v="primary" s="md" onClick={()=>onNav("S20")}>템플릿 선택</Btn></div>
        : <div className="card card-p">
          {items.map((it,i)=>(
            <div key={it.id} className="list-row" style={{cursor:"pointer",borderBottom:i<items.length-1?`1px solid ${TDS.bgTertiary}`:"none"}} onClick={()=>onNav("S22")}>
              <TFI s={24} color={TDS.blue500}>📝</TFI>
              <div className="list-row-left">
                <div className="list-row-title">{it.title}</div>
                <div className="list-row-sub">{it.tpl} · {it.created}</div>
              </div>
              <div style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:TDS.successBg,color:TDS.success}}>{it.status}</div>
              <span style={{color:TDS.textTertiary}}>›</span>
            </div>
          ))}
        </div>
      }
    </div>
  );
}

/* S22 양식 결과물 상세 */

