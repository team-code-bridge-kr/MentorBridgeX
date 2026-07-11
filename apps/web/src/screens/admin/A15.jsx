import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A15({ onNav }) {
  const models=[
    {name:"text-embedding-3-large",provider:"OpenAI",dim:3072,status:"활성",latency:"45ms",deployed:"2026-01-01"},
    {name:"bge-m3",provider:"BAAI",dim:1024,status:"대기",latency:"28ms",deployed:"—"},
    {name:"text-embedding-ada-002",provider:"OpenAI",dim:1536,status:"아카이브",latency:"52ms",deployed:"2025-06-01"},
  ];
  return (
    <div className="content">
      <div className="row-between mb16" style={{marginBottom:16}}>
        <div className="sec-title">임베딩 모델 목록</div>
        <Btn v="primary" s="sm" onClick={()=>onNav("A16")}>모델 교체</Btn>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>모델명</th><th>제공사</th><th>차원</th><th>레이턴시</th><th>상태</th><th>배포일</th></tr></thead>
          <tbody>
            {models.map((m,i)=>(
              <tr key={i} style={{background:m.status==="활성"?TDS.blue50:"transparent"}}>
                <td><div style={{fontWeight:m.status==="활성"?700:400}}>{m.name}</div></td>
                <td style={{color:TDS.textTertiary}}>{m.provider}</td>
                <td style={{fontWeight:600}}>{m.dim.toLocaleString()}</td>
                <td style={{color:parseInt(m.latency)>50?TDS.warning:TDS.success}}>{m.latency}</td>
                <td><Badge t={m.status==="활성"?"blue":m.status==="대기"?"orange":"grey"}>{m.status}</Badge></td>
                <td style={{color:TDS.textTertiary}}>{m.deployed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* A16 임베딩 모델 교체 */

