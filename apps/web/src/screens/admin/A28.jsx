import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A28({ onNav }) {
  const settings=[
    {section:"보안",items:[
      {key:"session_ttl_hours",label:"세션 유효 시간 (시간)",value:"4",type:"number"},
      {key:"mfa_required",label:"MFA 필수",value:true,type:"bool"},
      {key:"max_login_attempts",label:"최대 로그인 시도",value:"5",type:"number"},
    ]},
    {section:"자원 한도",items:[
      {key:"node_limit",label:"사용자당 최대 노드",value:"10000",type:"number"},
      {key:"storage_limit_gb",label:"사용자당 스토리지 (GB)",value:"10",type:"number"},
      {key:"voice_session_max_min",label:"음성 세션 최대 (분)",value:"240",type:"number"},
    ]},
    {section:"ML",items:[
      {key:"ml_confidence_threshold",label:"ML 신뢰도 임계값",value:"0.75",type:"number"},
      {key:"pruning_auto",label:"자동 가지치기",value:false,type:"bool"},
    ]},
  ];
  return (
    <div className="content" style={{maxWidth:700,margin:"0 auto"}}>
      <div style={{fontSize:20,fontWeight:700,marginBottom:20}}>시스템 설정</div>
      {settings.map((s,si)=>(
        <div key={si} className="card card-p" style={{marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:700,marginBottom:14,color:TDS.textPrimary}}>{s.section}</div>
          {s.items.map((item,ii)=>(
            <div key={ii} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:ii<s.items.length-1?`1px solid ${TDS.bgTertiary}`:"none"}}>
              <div>
                <div style={{fontSize:13,fontWeight:500,color:TDS.textPrimary}}>{item.label}</div>
                <code style={{fontSize:10,color:TDS.textTertiary}}>{item.key}</code>
              </div>
              {item.type==="bool"
                ? <div style={{width:44,height:26,borderRadius:13,background:item.value?TDS.blue500:TDS.bgTertiary,position:"relative",cursor:"pointer"}} onClick={()=>{}}>
                    <div style={{width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:item.value?21:3,boxShadow:"0 1px 4px rgba(0,0,0,.2)"}} />
                  </div>
                : <input className="inp" type="number" defaultValue={item.value} style={{width:100,textAlign:"right"}} />
              }
            </div>
          ))}
        </div>
      ))}
      <Btn v="primary" s="lg" fw>모든 설정 저장</Btn>
    </div>
  );
}

/* A29 관리자 목록 */

