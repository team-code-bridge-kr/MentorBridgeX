import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function S11({ onNav }) {
  const areas=[
    {id:"세특",t:"세부능력 및 특기사항",d:"교사가 작성하는 교과 세부능력 및 특기사항",chars:1240,st:"완료"},
    {id:"자율",t:"자율활동",d:"학교 자율활동 기록 영역",chars:856,st:"완료"},
    {id:"동아리",t:"동아리활동",d:"동아리 활동 기록",chars:932,st:"완료"},
    {id:"봉사",t:"봉사활동",d:"봉사활동 실적 및 특기사항",chars:0,st:"미작성"},
    {id:"진로",t:"진로활동",d:"진로 활동 기록 및 특기사항",chars:1108,st:"완료"},
    {id:"행특",t:"행동특성 및 종합의견",d:"담임교사의 행동특성 및 종합의견",chars:756,st:"완료"},
    {id:"독서",t:"독서활동",d:"독서 활동 상황",chars:0,st:"미작성"},
    {id:"수상",t:"수상경력",d:"수상 경력 기록",chars:324,st:"입력중"},
  ];
  const bType={완료:"green",미작성:"grey",입력중:"orange"};
  return (
    <div className="content">
      <div className="row-between mb24" style={{marginBottom:24}}>
        <div>
          <div className="sec-title">텍스트 영역</div>
          <div className="sec-sub">8가지 생기부 영역을 관리하세요</div>
        </div>
        <div className="row g-8" style={{gap:8}}>
          <Btn v="secondary" s="sm" onClick={()=>onNav("S13")}><TFI>📄</TFI> PDF 업로드</Btn>
          <Btn v="primary" s="sm">+ 직접 입력</Btn>
        </div>
      </div>
      <div className="grid3 g-16" style={{gap:16}}>
        {areas.map(a=>(
          <div key={a.id} className="area-card" onClick={()=>onNav("S12")}>
            <div className="row-between mb8" style={{marginBottom:8}}>
              <div className="area-card-title">{a.t}</div>
              <Badge t={bType[a.st]}>{a.st}</Badge>
            </div>
            <div className="area-card-desc">{a.d}</div>
            <Divider my={12} />
            <div className="row-between">
              <span style={{fontSize:13,color:TDS.textTertiary}}>{a.chars>0?`${a.chars.toLocaleString()}자`:"아직 입력 없음"}</span>
              <Btn v="secondary" s="sm" onClick={e=>{e.stopPropagation();onNav("S12");}}>편집</Btn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* S12 텍스트 편집 */

