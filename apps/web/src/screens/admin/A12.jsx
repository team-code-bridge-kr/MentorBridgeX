import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A12({ onNav }) {
  const [step,setStep]=useState(0);
  const snaps=[
    {id:"SNAP-001",user:"홍길동",type:"전체",size:"12.4 MB",created:"2026-01-15",expires:"2026-02-14"},
    {id:"SNAP-002",user:"이수진",type:"그래프",size:"3.2 MB",created:"2026-01-10",expires:"2026-02-09"},
  ];
  return (
    <div className="content">
      <div className="row-between mb16" style={{marginBottom:16}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}><div className="sec-title">데이터 스냅샷</div><Badge t="red">[T2]</Badge></div>
        <Btn v="danger" s="sm" onClick={()=>setStep(step===0?1:0)}>{step===0?"신규 스냅샷":"취소"}</Btn>
      </div>
      {step===1&&(
        <div className="card card-p" style={{marginBottom:16,border:`1px solid ${TDS.danger}`}}>
          <Notice type="danger" style={{marginBottom:16}}>스냅샷 생성은 감사 로그에 기록됩니다. (admin.investigation 등급)</Notice>
          <div className="inp-group"><label className="inp-label">대상 사용자</label><input className="inp" placeholder="사용자 ID 또는 이메일..." /></div>
          <div className="inp-group"><label className="inp-label">스냅샷 범위</label>
            <select className="inp"><option>전체 데이터</option><option>그래프</option><option>문서</option><option>음성</option></select>
          </div>
          <div className="inp-group"><label className="inp-label">사유 (X-Investigation-Reason)</label><textarea className="inp" rows={2} placeholder="스냅샷 생성 사유..." /></div>
          <Btn v="danger" s="sm" fw onClick={()=>setStep(0)}>스냅샷 생성</Btn>
        </div>
      )}
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>스냅샷 ID</th><th>사용자</th><th>범위</th><th>크기</th><th>생성일</th><th>만료일</th><th>다운로드</th></tr></thead>
          <tbody>
            {snaps.map((s,i)=>(
              <tr key={i}>
                <td><code style={{fontSize:11}}>{s.id}</code></td>
                <td>{s.user}</td>
                <td><Badge t="blue">{s.type}</Badge></td>
                <td style={{color:TDS.textTertiary}}>{s.size}</td>
                <td style={{color:TDS.textTertiary}}>{s.created}</td>
                <td style={{color:TDS.warning}}>{s.expires}</td>
                <td><Btn v="primary" s="sm">다운로드</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* A14 운영 메트릭 */

