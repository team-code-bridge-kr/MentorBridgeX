import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function T06({ onNav }) {
  const { state, actions } = useStore();
  const students = state.students;
  useEffect(()=>{ if(!students.length) actions.loadStudents(state.session?.user?.id); /* eslint-disable-next-line */ }, []);
  const open = (s) => { actions.selectStudent(s); onNav("T07"); };
  return (
    <div className="content">
      <div className="row-between mb24" style={{marginBottom:24}}>
        <div className="sec-title">담당 학생 목록</div>
        <Btn v="primary" onClick={()=>onNav("T04")}>+ 학생 추가</Btn>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>이름</th><th>학번/학반</th><th>총 노드</th><th>마지막 활동</th><th>미처리</th><th>그래프 동기화</th><th></th></tr></thead>
          <tbody>
            {students.map(s=>(
              <tr key={s.id} style={{cursor:"pointer"}} onClick={()=>open(s)}>
                <td><div className="row g-8" style={{gap:8}}><Av name={s.name[0]} size="xs"/>{s.name}</div></td>
                <td style={{color:TDS.textTertiary}}>{s.grade} / {s.id}</td>
                <td>{s.nodes.toLocaleString()}개</td>
                <td style={{color:TDS.textTertiary}}>{s.last}</td>
                <td><span style={{color:s.cm>0?TDS.danger:TDS.textDisabled}}>{s.cm}개</span></td>
                <td><Badge t={s.sync==="동기화됨"?"green":"orange"}>{s.sync}</Badge></td>
                <td><Btn v="secondary" s="sm" onClick={(e)=>{e.stopPropagation();open(s);}}>상세</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

