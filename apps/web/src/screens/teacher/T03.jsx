import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";
import { timeAgo } from "../../utils/time.js";

export function T03({ onNav }) {
  const { state, actions } = useStore();
  const students = state.students;
  useEffect(()=>{ if(!students.length) actions.loadStudents(state.session?.user?.id); /* eslint-disable-next-line */ }, []);
  const stType={활발:"green",보통:"grey",낮음:"orange"};
  const open = (s) => { actions.selectStudent(s); onNav("T07"); };
  const pendingComments = state.comments.filter(c=>!c.replied).length;
  return (
    <div className="content">
      <div className="grid4 g-20 mb24" style={{gap:20,marginBottom:24}}>
        <StatCard label="담당 학생" value={`${students.length}명`} sub="매핑 완료" color={TDS.blue500} />
        <StatCard label="미처리 코멘트" value={`${pendingComments}개`} sub="빠른 피드백 필요" color={TDS.danger} />
        <StatCard label="이번 달 코멘트" value={`${state.comments.length}개`} sub="누적" color={TDS.success} />
        <StatCard label="매핑 대기" value="2건" sub="승인 대기 중" color={TDS.warning} />
      </div>
      <div className="grid2 g-20 mb24" style={{gap:20,marginBottom:24}}>
        <Card>
          <div className="card-hdr"><span className="card-title">담당 학생 목록</span><Btn v="ghost" s="sm" onClick={()=>onNav("T06")}>전체 보기</Btn></div>
          {students.map(s=>(
            <div key={s.id} className="list-row" style={{cursor:"pointer"}} onClick={()=>open(s)}>
              <Av name={s.name[0]} size="sm" />
              <div className="list-row-left">
                <div className="list-row-title">{s.name}</div>
                <div className="list-row-sub">{s.grade}반 · 노드 {s.nodes.toLocaleString()}개</div>
              </div>
              <Badge t={stType[s.activity]}>{s.activity}</Badge>
            </div>
          ))}
          {!students.length && <div style={{padding:"24px 0",textAlign:"center",color:TDS.textTertiary,fontSize:13}}>불러오는 중…</div>}
        </Card>
        <Card>
          <div className="card-hdr">
            <div className="row g-8" style={{gap:8}}><span className="card-title">미처리 코멘트 큐</span><span className="badge-num">{pendingComments}</span></div>
          </div>
          {state.comments.filter(c=>!c.replied).slice(0,3).map((c)=>(
            <div key={c.id} className="list-row" style={{cursor:"pointer"}} onClick={()=>onNav("T10")}>
              <Av name={(c.author||"?")[0]} size="sm" />
              <div className="list-row-left"><div className="list-row-title">{c.author}</div><div className="list-row-sub">{c.type} · {c.target}</div></div>
              <span style={{fontSize:12,color:TDS.textTertiary}}>{timeAgo(c.createdAt)}</span>
            </div>
          ))}
          {!pendingComments && <div style={{padding:"24px 0",textAlign:"center",color:TDS.textTertiary,fontSize:13}}>미처리 코멘트가 없습니다</div>}
        </Card>
      </div>
      <Card>
        <div className="card-hdr"><span className="card-title">학생 매핑 신청 대기</span><Btn v="ghost" s="sm" onClick={()=>onNav("T04")}>신청하기</Btn></div>
        <div className="grid2 g-12" style={{gap:12}}>
          {[{n:"김민수",c:"3학년 4반"},{n:"이수진",c:"3학년 4반"}].map(s=>(
            <div key={s.n} className="card row g-12" style={{padding:"14px 16px",gap:12}}>
              <Av name={s.n[0]} size="sm" /><div style={{flex:1}}><div style={{fontSize:14,fontWeight:600}}>{s.n}</div><div style={{fontSize:12,color:TDS.textTertiary}}>{s.c}</div></div>
              <Btn v="primary" s="sm">수락</Btn><Btn v="secondary" s="sm">거절</Btn>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

