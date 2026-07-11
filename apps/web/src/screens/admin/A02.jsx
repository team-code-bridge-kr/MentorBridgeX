import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A02({ onNav }) {
  const { state, actions } = useStore();
  const users = state.adminUsers;
  const [ft, setFt] = useState("전체");
  const [q, setQ] = useState("");
  useEffect(()=>{ if(!users.length) actions.loadAdminUsers(); /* eslint-disable-next-line */ }, []);

  const stType={활성:"green",정지됨:"orange",삭제됨:"red"};
  const counts = {
    전체:users.length,
    학생:users.filter(u=>u.role==="학생").length,
    교사:users.filter(u=>u.role==="교사").length,
    정지됨:users.filter(u=>u.status==="정지됨").length,
    삭제됨:users.filter(u=>u.status==="삭제됨").length,
  };
  const filtered = users
    .filter(u=> ft==="전체" ? true : (ft==="학생"||ft==="교사") ? u.role===ft : u.status===ft)
    .filter(u=> !q.trim() || (u.name+u.email).toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="content">
      <div className="row-between mb16" style={{marginBottom:16}}><div className="sec-title">사용자 관리</div></div>
      <div className="row g-12 mb16" style={{gap:12,marginBottom:16}}>
        <div className="tab-pill-wrap">
          {[["전체",counts.전체],["학생",counts.학생],["교사",counts.교사],["정지됨",counts.정지됨],["삭제됨",counts.삭제됨]].map(([t,c])=>(
            <div key={t} className={`tab-pill${ft===t?" active":""}`} onClick={()=>setFt(t)}>{t} ({c})</div>
          ))}
        </div>
        <div style={{flex:1}} />
        <div className="search-wrap" style={{width:240}}><span>🔍</span><input placeholder="이름, 이메일 검색..." value={q} onChange={e=>setQ(e.target.value)} /></div>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>이름</th><th>이메일</th><th>역할</th><th>가입일</th><th>상태</th><th>마지막 로그인</th><th>처리</th></tr></thead>
          <tbody>
            {filtered.map(u=>(
              <tr key={u.id}>
                <td><div className="row g-8" style={{gap:8}}><Av name={u.name[0]} size="xs"/>{u.name}</div></td>
                <td style={{color:TDS.textTertiary}}>{u.email}</td>
                <td><Badge t={u.role==="교사"?"blue":"grey"}>{u.role}</Badge></td>
                <td style={{color:TDS.textTertiary}}>{u.joined}</td>
                <td><Badge t={stType[u.status]}>{u.status}</Badge></td>
                <td style={{color:TDS.textTertiary}}>{u.lastLogin}</td>
                <td>
                  {u.status==="삭제됨" ? (
                    <span style={{fontSize:12,color:TDS.textTertiary}}>—</span>
                  ) : (
                    <div className="row g-8" style={{gap:6}}>
                      {u.status==="정지됨"
                        ? <Btn v="secondary" s="sm" onClick={()=>actions.restoreUser(u.id)} style={{color:TDS.success}}>정지 해제</Btn>
                        : <Btn v="secondary" s="sm" onClick={()=>actions.suspendUser(u.id,"관리자 조치")} style={{color:TDS.warning}}>정지</Btn>}
                      <Btn v="secondary" s="sm" onClick={()=>actions.deleteUser(u.id)} style={{color:TDS.danger}}>삭제</Btn>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={7} style={{textAlign:"center",padding:"32px 0",color:TDS.textTertiary}}>조건에 맞는 사용자가 없습니다</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="row-between mt16" style={{marginTop:14}}>
        <span style={{fontSize:13,color:TDS.textTertiary}}>총 {filtered.length}명 표시</span>
      </div>
    </div>
  );
}

