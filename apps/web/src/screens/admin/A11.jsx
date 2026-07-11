import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A11({ onNav }) {
  const [done,setDone]=useState(false);
  return (
    <div className="content" style={{maxWidth:540,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("A10")}>← 목록</button>
        <div style={{fontSize:20,fontWeight:700}}>코멘트 강제 삭제 확인</div>
      </div>
      {done
        ? <div className="card card-p" style={{textAlign:"center",padding:"40px"}}><TFI s={48}>✅</TFI><div style={{fontSize:18,fontWeight:700,marginTop:16}}>삭제 완료</div><div style={{fontSize:13,color:TDS.textTertiary,marginTop:8,marginBottom:24}}>감사 로그에 기록되었습니다</div><Btn v="primary" s="md" onClick={()=>onNav("A10")}>목록으로</Btn></div>
        : <>
          <div className="card card-p" style={{marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>삭제 대상 코멘트</div>
            <div style={{padding:"12px",background:TDS.dangerBg,borderRadius:8,fontSize:13,color:TDS.textPrimary,borderLeft:`4px solid ${TDS.danger}`,marginBottom:12}}>
              "이 정도 수준으로는 대학교도 못 가겠다. 공부 그만해."
            </div>
            {[["작성자","박교사"],["작성일","2026-01-19 10:23"],["신고 수","3건"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:13}}>
                <span style={{color:TDS.textTertiary}}>{k}</span><span>{v}</span>
              </div>
            ))}
          </div>
          <Notice type="danger" style={{marginBottom:16}}>삭제 후 작성자에게 알림이 전송됩니다. 삭제된 코멘트는 30일 후 완전히 제거됩니다.</Notice>
          <div style={{display:"flex",gap:8}}>
            <Btn v="secondary" s="md" fw onClick={()=>onNav("A10")}>취소</Btn>
            <Btn v="danger" s="md" fw onClick={()=>setDone(true)}>삭제 실행</Btn>
          </div>
        </>
      }
    </div>
  );
}

/* A12 데이터 스냅샷 [T2] */

