import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function S20({ onNav }) {
  const templates=[
    {id:1,t:"대학 자기소개서",cat:"입시",d:"학업 역량, 전공 선택 이유, 발전 가능성을 중심으로 작성",uses:1204},
    {id:2,t:"세특 요약 보고서",cat:"세특",d:"교과 학습 내용과 탐구 활동을 체계적으로 정리",uses:892},
    {id:3,t:"동아리 활동 보고서",cat:"동아리",d:"동아리 활동 내용과 본인의 역할을 서술",uses:567},
    {id:4,t:"진로 포트폴리오",cat:"진로",d:"진로 탐색 과정과 준비 현황을 종합",uses:423},
    {id:5,t:"독서 감상문",cat:"독서",d:"읽은 책의 핵심 내용과 본인의 생각을 연결",uses:345},
    {id:6,t:"봉사활동 에세이",cat:"봉사",d:"봉사 경험을 통한 성장을 서술",uses:289},
  ];
  return (
    <div className="content">
      <div className="row-between mb24" style={{marginBottom:24}}>
        <div><div className="sec-title">양식 템플릿</div><div className="sec-sub">나의 그래프 데이터를 기반으로 양식을 자동 생성합니다</div></div>
        <Btn v="secondary" s="sm" onClick={()=>onNav("S21")}>생성 이력 보기</Btn>
      </div>
      <div className="grid3 g-16" style={{gap:16}}>
        {templates.map(tmpl=>(
          <Card key={tmpl.id} style={{cursor:"pointer"}} onClick={()=>onNav("S22")}>
            <div className="row-between mb8" style={{marginBottom:10}}>
              <Badge t="blue" pill>{tmpl.cat}</Badge>
              <span style={{fontSize:12,color:TDS.textTertiary}}>사용 {tmpl.uses.toLocaleString()}회</span>
            </div>
            <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>{tmpl.t}</div>
            <div style={{fontSize:13,color:TDS.textTertiary,marginBottom:18,lineHeight:1.6}}>{tmpl.d}</div>
            <Btn v="primary" s="sm" style={{width:"100%"}}>이 템플릿으로 생성</Btn>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* S24 코멘트 */
/* 상대 시간 표시 (ms 타임스탬프 → "10분 전") */

