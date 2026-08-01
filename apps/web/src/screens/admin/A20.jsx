import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A20({ onNav }) {
  const [isFailClose, setIsFailClose] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <div className="content" style={{maxWidth:540,margin:"0 auto"}}>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:20}}>
        <div style={{fontSize:20,fontWeight:700}}>Redis fail-close 토글</div><Badge t="red">[T2]</Badge>
      </div>
      <Notice type={isFailClose?"danger":"warning"} style={{marginBottom:20}}>
        {isFailClose
          ? "fail-close 활성화 상태: Redis 장애 시 모든 W 작업이 차단됩니다."
          : "현재 fail-open 상태: Redis 장애 시 캐시 없이 DB에 직접 접근합니다."
        }
      </Notice>
      {done
        ? <div className="card card-p" style={{textAlign:"center",padding:"40px"}}><TFI s={48}>{isFailClose?"🔓":"🔒"}</TFI><div style={{fontSize:18,fontWeight:700,marginTop:16}}>{isFailClose?"fail-open으로 전환됨":"fail-close로 전환됨"}</div><div style={{fontSize:13,color:TDS.textTertiary,marginTop:8,marginBottom:24}}>보안팀에 통보됨 · 감사 로그 기록됨</div><Btn v="primary" s="md" onClick={()=>onNav("A13")}>시스템 헬스로</Btn></div>
        : <div className="card card-p">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 0"}}>
            <div><div style={{fontWeight:700}}>Redis fail-close</div><div style={{fontSize:12,color:TDS.textTertiary}}>Redis 장애 시 W 작업 차단</div></div>
            <div onClick={()=>setIsFailClose(!isFailClose)} style={{width:48,height:28,borderRadius:14,background:isFailClose?TDS.danger:TDS.bgTertiary,position:"relative",cursor:"pointer",transition:"background .2s"}}>
              <div style={{width:22,height:22,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:isFailClose?23:3,transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.2)"}} />
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,padding:"12px",background:TDS.dangerBg,borderRadius:8}}>
            <input type="checkbox" id="redis-confirm" checked={confirm} onChange={e=>setConfirm(e.target.checked)} />
            <label htmlFor="redis-confirm" style={{fontSize:13,color:TDS.danger}}>이 작업이 서비스에 미치는 영향을 이해했습니다</label>
          </div>
          <Btn v="danger" s="md" fw disabled={!confirm} onClick={()=>setDone(true)}>설정 변경 적용</Btn>
        </div>
      }
    </div>
  );
}

/* A22 감사 로그 상세 */

