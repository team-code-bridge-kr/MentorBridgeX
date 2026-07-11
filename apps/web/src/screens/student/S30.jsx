import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function S30({ onNav }) {
  const [notifs, setNotifs] = useState({ comment:true, system:true, weekly:false, push:true });
  const [activeTab, setActiveTab] = useState("계정");
  const tabs = ["계정","알림","보안","데이터"];
  const toggle = k => setNotifs(p=>({...p,[k]:!p[k]}));

  const Toggle = ({on, onClick}) => (
    <div onClick={onClick} style={{width:44,height:26,borderRadius:13,background:on?TDS.blue500:TDS.bgTertiary,position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0}}>
      <div style={{width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:on?21:3,transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.2)"}} />
    </div>
  );

  return (
    <div className="content">
      <div className="content-wide">
        {/* 헤더 — 프로필 요약 */}
        <div className="card card-p" style={{marginBottom:20,display:"flex",alignItems:"center",gap:20}}>
          <div style={{width:72,height:72,borderRadius:"50%",background:TDS.blue500,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:30,fontWeight:700,flexShrink:0}}>홍</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:20,fontWeight:700,color:TDS.textPrimary}}>홍길동</div>
            <div style={{fontSize:14,color:TDS.textTertiary,marginTop:2}}>hong@school.ac.kr</div>
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <div style={{padding:"3px 10px",borderRadius:20,background:TDS.blue50,color:TDS.blue500,fontSize:11,fontWeight:600}}>학생</div>
              <div style={{padding:"3px 10px",borderRadius:20,background:TDS.successBg,color:TDS.success,fontSize:11,fontWeight:600}}>활성</div>
            </div>
          </div>
          <Btn v="secondary" s="sm" onClick={()=>onNav("S31")}>프로필 편집</Btn>
        </div>

        {/* 탭 바 */}
        <div className="tab-pill-wrap" style={{marginBottom:20}}>
          {tabs.map(t=><div key={t} className={`tab-pill${activeTab===t?" active":""}`} onClick={()=>setActiveTab(t)}>{t}</div>)}
        </div>

        {/* 계정 탭 */}
        {activeTab==="계정" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {/* 내 정보 */}
            <div className="card card-p">
              <div style={{fontSize:14,fontWeight:700,color:TDS.textPrimary,marginBottom:16}}>기본 정보</div>
              {[
                ["이름","홍길동"],["이메일","hong@school.ac.kr"],
                ["역할","학생"],["가입일","2026-01-01"],
                ["OAuth 제공자","Google"],["마지막 로그인","2026-01-20 14:32"],
              ].map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:`1px solid ${TDS.bgTertiary}`}}>
                  <span style={{fontSize:14,color:TDS.textTertiary,minWidth:120}}>{k}</span>
                  <span style={{fontSize:14,color:TDS.textPrimary,fontWeight:500}}>{v}</span>
                </div>
              ))}
            </div>

            {/* 빠른 메뉴 */}
            <div className="card card-p">
              <div style={{fontSize:14,fontWeight:700,marginBottom:12}}>빠른 이동</div>
              <div className="grid2" style={{gap:8}}>
                {[
                  {ic:"📊",t:"활동 통계",s:"S28"},{ic:"📤",t:"데이터 내보내기",s:"S29"},
                  {ic:"💬",t:"코멘트 목록",s:"S24"},{ic:"🔔",t:"알림 목록",s:"S25"},
                ].map(item=>(
                  <div key={item.t} onClick={()=>onNav(item.s)} style={{display:"flex",alignItems:"center",gap:10,padding:"12px",borderRadius:10,background:TDS.bgSecondary,cursor:"pointer",border:`1px solid ${TDS.borderDefault}`,transition:"all .14s"}}>
                    <TFI s={18} color={TDS.textSecondary}>{item.ic}</TFI>
                    <span style={{fontSize:13,fontWeight:600,color:TDS.textSecondary}}>{item.t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 알림 탭 */}
        {activeTab==="알림" && (
          <div className="card card-p">
            <div style={{fontSize:14,fontWeight:700,marginBottom:16}}>알림 설정</div>
            {[
              {k:"comment",label:"코멘트 알림",desc:"교사가 코멘트를 남겼을 때"},
              {k:"system",label:"시스템 공지",desc:"서비스 공지 및 점검 안내"},
              {k:"weekly",label:"주간 리포트",desc:"매주 월요일 활동 요약 이메일"},
              {k:"push",label:"푸시 알림",desc:"브라우저 푸시 알림 허용"},
            ].map(n=>(
              <div key={n.k} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 0",borderBottom:`1px solid ${TDS.bgTertiary}`}}>
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:TDS.textPrimary,marginBottom:2}}>{n.label}</div>
                  <div style={{fontSize:12,color:TDS.textTertiary}}>{n.desc}</div>
                </div>
                <Toggle on={notifs[n.k]} onClick={()=>toggle(n.k)} />
              </div>
            ))}
            <Notice type="info" style={{marginTop:16}}>알림 설정은 즉시 적용됩니다.</Notice>
          </div>
        )}

        {/* 보안 탭 */}
        {activeTab==="보안" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div className="card card-p">
              <div style={{fontSize:14,fontWeight:700,marginBottom:16}}>로그인 기기</div>
              {[
                {os:"macOS Chrome",ip:"211.xxx.xxx.xxx",time:"현재 세션",cur:true},
                {os:"iOS Safari",ip:"211.xxx.xxx.xxx",time:"2일 전",cur:false},
                {os:"Windows Edge",ip:"61.xxx.xxx.xxx",time:"7일 전",cur:false},
              ].map((d,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:i<2?`1px solid ${TDS.bgTertiary}`:"none"}}>
                  <div style={{width:38,height:38,borderRadius:10,background:TDS.bgSecondary,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}><TFI s={18} color={TDS.textSecondary}>{d.os.includes("iOS")?"📱":"💻"}</TFI></div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600,display:"flex",alignItems:"center",gap:6}}>{d.os}{d.cur&&<span style={{padding:"2px 8px",borderRadius:10,background:TDS.successBg,color:TDS.success,fontSize:10,fontWeight:700}}>현재</span>}</div>
                    <div style={{fontSize:12,color:TDS.textTertiary}}>{d.ip} · {d.time}</div>
                  </div>
                  {!d.cur&&<Btn v="ghost" s="sm" style={{color:TDS.danger}}>로그아웃</Btn>}
                </div>
              ))}
            </div>
            <div className="card card-p">
              <div style={{fontSize:14,fontWeight:700,marginBottom:12}}>세션 관리</div>
              <div style={{fontSize:13,color:TDS.textTertiary,marginBottom:16}}>다른 모든 기기에서 로그아웃됩니다.</div>
              <Btn v="secondary" s="sm">다른 기기 모두 로그아웃</Btn>
            </div>
          </div>
        )}

        {/* 데이터 탭 */}
        {activeTab==="데이터" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div className="card card-p">
              <div style={{fontSize:14,fontWeight:700,marginBottom:16}}>데이터 관리</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <div onClick={()=>onNav("S29")} style={{display:"flex",alignItems:"center",gap:12,padding:"14px",borderRadius:10,border:`1px solid ${TDS.borderDefault}`,cursor:"pointer",background:TDS.bgSecondary}}>
                  <TFI s={22} color={TDS.textSecondary}>📤</TFI>
                  <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14}}>데이터 내보내기</div><div style={{fontSize:12,color:TDS.textTertiary}}>그래프·텍스트·음성 전체 다운로드</div></div>
                  <span style={{color:TDS.textTertiary}}>›</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px",borderRadius:10,border:`1px solid ${TDS.borderDefault}`,cursor:"pointer",background:TDS.bgSecondary}}>
                  <TFI s={22} color={TDS.textSecondary}>📊</TFI>
                  <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14}}>저장 공간 사용량</div><div style={{fontSize:12,color:TDS.textTertiary}}>2.4 GB / 10 GB 사용 중</div></div>
                  <div style={{width:80,height:6,background:TDS.bgTertiary,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:"24%",background:TDS.blue500,borderRadius:3}} /></div>
                </div>
              </div>
            </div>
            {/* 위험 구역 */}
            <div className="card card-p" style={{border:`1px solid ${TDS.danger}30`}}>
              <div style={{fontSize:14,fontWeight:700,color:TDS.danger,marginBottom:12}}>위험 구역</div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px",background:TDS.dangerBg,borderRadius:10}}>
                <div>
                  <div style={{fontWeight:600,fontSize:14,color:TDS.textPrimary}}>계정 삭제</div>
                  <div style={{fontSize:12,color:TDS.textTertiary}}>30일 유예 후 모든 데이터 완전 삭제</div>
                </div>
                <Btn v="danger" s="sm" onClick={()=>onNav("S32")}>계정 삭제</Btn>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   ── STUDENT SCREENS (미구현 분) ──
────────────────────────────────────────────────────────────── */

/* S07 노드 상세 */

