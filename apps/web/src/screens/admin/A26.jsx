import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A26({ onNav }) {
  const templates=[
    {id:"T-001",name:"자기소개서 A",category:"자소서",usages:234,active:true},
    {id:"T-002",name:"세특 요약",category:"세특",usages:189,active:true},
    {id:"T-003",name:"진학 계획 A",category:"진학",usages:87,active:true},
    {id:"T-004",name:"봉사 활동 보고서",category:"봉사",usages:45,active:false},
  ];
  return (
    <div className="content">
      <div className="row-between mb16" style={{marginBottom:16}}>
        <div className="sec-title">양식 템플릿 마스터</div>
        <Btn v="primary" s="sm">+ 새 템플릿</Btn>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>ID</th><th>템플릿명</th><th>카테고리</th><th>사용 횟수</th><th>활성</th><th>수정</th></tr></thead>
          <tbody>
            {templates.map((t,i)=>(
              <tr key={i}>
                <td><code style={{fontSize:11}}>{t.id}</code></td>
                <td style={{fontWeight:500}}>{t.name}</td>
                <td><Badge t="blue">{t.category}</Badge></td>
                <td style={{fontWeight:600}}>{t.usages.toLocaleString()}</td>
                <td><Badge t={t.active?"blue":"grey"}>{t.active?"활성":"비활성"}</Badge></td>
                <td><Btn v="ghost" s="sm">편집</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* A27 Enum 마스터 */

