import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A01({ onNav }) {
  const { state, actions } = useStore();
  useEffect(()=>{
    if(!state.adminUsers.length) actions.loadAdminUsers();
    if(!state.reports.length) actions.loadReports();
    /* eslint-disable-next-line */
  }, []);
  const services=[
    {n:"API 서버",st:"정상",uptime:"99.98%"},{n:"ML 파이프라인",st:"정상",uptime:"99.95%"},
    {n:"STT 서버",st:"정상",uptime:"99.90%"},{n:"Redis 캐시",st:"경고",uptime:"99.82%"},
    {n:"PostgreSQL",st:"정상",uptime:"100%"},{n:"임베딩 모델",st:"정상",uptime:"99.97%"},
  ];
  const totalUsers = state.adminUsers.length;
  const studentCount = state.adminUsers.filter(u=>u.role==="학생").length;
  const teacherCount = state.adminUsers.filter(u=>u.role==="교사").length;
  const pendingReports = state.reports.filter(r=>(r.status||"검토 중")!=="처리됨").length;
  const pendingTeacherApps = state.teacherApplications.filter(t=>t.status==="검토 중").length;
  return (
    <div className="content">
      <div className="grid4 g-20 mb24" style={{gap:20,marginBottom:24}}>
        <StatCard label="총 사용자" value={`${totalUsers}명`} sub={`학생 ${studentCount} / 교사 ${teacherCount}`} color={TDS.blue500} />
        <StatCard label="오늘 신규 가입" value="12명" sub="전일 대비 +3" color={TDS.success} />
        <StatCard label="신고 처리 대기" value={`${pendingReports}건`} sub={pendingReports?"즉시 처리 필요":"모두 처리됨"} color={TDS.danger} />
        <StatCard label="교사 검증 대기" value={`${pendingTeacherApps}건`} sub={pendingTeacherApps?"검토 필요":"대기 없음"} color={TDS.warning} />
      </div>
      <div className="grid2 g-20 mb24" style={{gap:20,marginBottom:24}}>
        <Card>
          <div className="card-hdr"><span className="card-title">시스템 헬스</span><Btn v="ghost" s="sm" onClick={()=>onNav("A13")}>상세 →</Btn></div>
          <div className="grid2 g-10" style={{gap:10}}>
            {services.map(sv=>(
              <div key={sv.n} style={{padding:"12px 14px",background:TDS.bgTertiary,borderRadius:10}}>
                <div className="row g-8 mb4" style={{gap:8,marginBottom:4}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:sv.st==="정상"?TDS.success:TDS.warning}} />
                  <span style={{fontSize:13,fontWeight:600,color:TDS.textPrimary}}>{sv.n}</span>
                </div>
                <div style={{fontSize:11,color:TDS.textTertiary}}>{sv.st} · {sv.uptime}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="card-title mb16" style={{marginBottom:16}}>주요 지표</div>
          <div className="grid2 g-14" style={{gap:14}}>
            {[["오늘 API 요청","48,291건"],["활성 세션","234개"],["평균 응답시간","142ms"],["에러율","0.03%"],["ML 작업 큐","12건 대기"],["STT 처리중","3건"]].map(([l,v])=>(
              <div key={l}><div style={{fontSize:11,color:TDS.textTertiary,marginBottom:3}}>{l}</div><div style={{fontSize:18,fontWeight:700}}>{v}</div></div>
            ))}
          </div>
        </Card>
      </div>
      <div className="grid2 g-20 mb24" style={{gap:20,marginBottom:24}}>
        <Card>
          <div className="card-hdr"><div className="row g-8" style={{gap:8}}><span className="card-title">신고 처리 큐</span><span className="badge-num">{pendingReports}</span></div><Btn v="ghost" s="sm" onClick={()=>onNav("A08")}>전체 보기</Btn></div>
          {state.reports.slice(0,3).map((r)=>(
            <div key={r.id} className="list-row" style={{cursor:"pointer"}} onClick={()=>onNav("A08")}>
              <div className="list-row-left"><div className="list-row-title">{r.reason||r.type||"신고"}</div><div className="list-row-sub">{r.author?`${r.author}의 코멘트`:r.target||"—"}</div></div>
              <Badge t={(r.status||"검토 중")==="처리됨"?"grey":"red"}>{r.status||"검토 중"}</Badge>
            </div>
          ))}
          {!state.reports.length && <div style={{padding:"20px 0",textAlign:"center",color:TDS.textTertiary,fontSize:13}}>대기 중인 신고가 없습니다</div>}
        </Card>
        <Card>
          <div className="card-hdr"><span className="card-title">교사 자격 검증 큐</span><Btn v="ghost" s="sm" onClick={()=>onNav("A06")}>전체 보기</Btn></div>
          {state.teacherApplications.length ? state.teacherApplications.slice(0,3).map((t)=>(
            <div key={t.id} className="list-row">
              <Av name={(t.name||"?")[0]} size="sm" />
              <div className="list-row-left"><div className="list-row-title">{t.name}</div><div className="list-row-sub">{t.school} {t.subject}</div></div>
              <Badge t={t.status==="승인됨"?"green":t.status==="반려됨"?"red":"orange"}>{t.status}</Badge>
            </div>
          )) : (
            [["김민준 교사","서울고등학교 수학"],["박재원 교사","대전고 과학"]].map(([n,school])=>(
              <div key={n} className="list-row">
                <Av name={n[0]} size="sm" />
                <div className="list-row-left"><div className="list-row-title">{n}</div><div className="list-row-sub">{school}</div></div>
                <Btn v="primary" s="sm" onClick={()=>onNav("A06")}>검토</Btn>
              </div>
            ))
          )}
        </Card>
      </div>
      <Card>
        <div style={{padding:"0 0 16px"}}><div className="card-title">시스템 로그</div></div>
        {[["INFO","API","GET /v1/students/me/graph — 142ms"],["WARN","Redis","메모리 사용량 75% 초과"],["INFO","ML","양자컴퓨팅 시드 처리 완료 (job_id: abc123)"],["ERROR","DB","Connection pool exhausted — retrying..."]].map(([lv,svc,msg],i)=>(
          <div key={i} className="log-item">
            <span className={`log-lv log-${lv==="INFO"?"info":lv==="WARN"?"warn":"error"}`}>{lv}</span>
            <span style={{color:TDS.blue500,fontWeight:600}}>[{svc}]</span>
            <span style={{color:TDS.textSecondary}}>{msg}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

