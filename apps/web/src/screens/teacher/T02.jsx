import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { Back, TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function T02({ onNav }) {
  const { state } = useStore();
  const v = state.teacherVerification;
  const status = v?.status || "미신청"; // "승인됨"|"반려됨"|"검토 중"|"미신청"
  const statusMap = {
    "검토 중": { color:TDS.warning, bg:TDS.warningBg, icon:"⏳" },
    "승인됨":  { color:TDS.success, bg:TDS.successBg, icon:"✅" },
    "반려됨":  { color:TDS.danger,  bg:TDS.dangerBg,  icon:"❌" },
    "미신청":  { color:TDS.textTertiary, bg:TDS.bgTertiary, icon:"📄" },
  };
  const s = statusMap[status];
  const submittedStr = v?.submittedAt ? new Date(v.submittedAt).toLocaleString("ko-KR") : "—";
  const approved = status==="승인됨";
  const rejected = status==="반려됨";
  return (
    <div className="content" style={{maxWidth:560,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <Back onClick={()=>onNav("T01")} label="신청" />
        <div style={{fontSize:20,fontWeight:700}}>자격 검증 상태</div>
      </div>
      {status==="미신청" ? (
        <div className="card card-p" style={{textAlign:"center",padding:"48px 24px"}}>
          <div style={{marginBottom:12,opacity:.4}}><TFI s={40} color={TDS.textTertiary}>📄</TFI></div>
          <div style={{fontSize:16,fontWeight:600,marginBottom:8}}>아직 신청 내역이 없습니다</div>
          <div style={{fontSize:13,color:TDS.textTertiary,marginBottom:20}}>교사 자격 검증을 신청하면 상태가 여기에 표시됩니다.</div>
          <Btn v="primary" s="md" onClick={()=>onNav("T01")}>자격 검증 신청하기</Btn>
        </div>
      ) : (
      <>
      <div className="card card-p" style={{marginBottom:16,textAlign:"center"}}>
        <div style={{width:80,height:80,borderRadius:"50%",background:s.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:40,margin:"0 auto 16px"}}><TFI s={40} color={s.color}>{s.icon}</TFI></div>
        <div style={{fontSize:22,fontWeight:700,color:s.color,marginBottom:8}}>{status}</div>
        <div style={{fontSize:14,color:TDS.textTertiary}}>신청일: {submittedStr}</div>
      </div>
      <div className="card card-p" style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>신청 정보</div>
        {[["소속 학교",v?.school||"—"],["교과목",v?.subject||"—"],["증빙 서류","재직증명서.pdf"]].map(([k,val])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${TDS.bgTertiary}`,fontSize:13}}>
            <span style={{color:TDS.textTertiary}}>{k}</span>
            <span style={{color:TDS.textPrimary,fontWeight:500}}>{val}</span>
          </div>
        ))}
      </div>
      <div className="card card-p">
        <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>처리 타임라인</div>
        {[
          {s:"완료",t:"신청 접수",d:submittedStr},
          {s:approved||rejected?"완료":"진행",t:"서류 검토",d:approved||rejected?"완료":"검토 중..."},
          {s:approved?"완료":rejected?"완료":"대기",t:approved?"승인 완료":rejected?"반려됨":"관리자 확인",d:approved||rejected?"완료":"대기"},
        ].map((item,i)=>(
          <div key={i} style={{display:"flex",gap:12,padding:"8px 0"}}>
            <div style={{width:20,height:20,borderRadius:"50%",background:item.s==="완료"?TDS.success:item.s==="진행"?TDS.warning:TDS.borderDefault,flexShrink:0,marginTop:2}} />
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:item.s==="대기"?TDS.textDisabled:TDS.textPrimary}}>{item.t}</div>
              <div style={{fontSize:11,color:TDS.textTertiary}}>{item.d}</div>
            </div>
          </div>
        ))}
      </div>
      </>
      )}
    </div>
  );
}

/* T04 학생 매핑 신청 */

