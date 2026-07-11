import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function A27({ onNav }) {
  const enums=[
    {key:"node_type",values:["개념","사건","인물","장소","기관","수식","기타"],count:7},
    {key:"edge_type",values:["하위 개념","상위 개념","관련","참조","대립","인과"],count:6},
    {key:"report_status",values:["대기","처리 중","완료","거부"],count:4},
    {key:"user_role",values:["학생","교사","관리자"],count:3},
  ];
  const [open,setOpen]=useState(null);
  return (
    <div className="content" style={{maxWidth:700,margin:"0 auto"}}>
      <div style={{fontSize:20,fontWeight:700,marginBottom:20}}>Enum 마스터</div>
      {enums.map((e,i)=>(
        <div key={i} className="card card-p" style={{marginBottom:12,cursor:"pointer"}} onClick={()=>setOpen(open===i?null:i)}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <code style={{fontSize:13,fontWeight:700,color:TDS.blue500}}>{e.key}</code>
              <span style={{fontSize:12,color:TDS.textTertiary,marginLeft:8}}>{e.count}개 값</span>
            </div>
            <span style={{color:TDS.textTertiary,fontSize:18}}>{open===i?"∧":"∨"}</span>
          </div>
          {open===i&&(
            <div style={{marginTop:12,display:"flex",flexWrap:"wrap",gap:8}}>
              {e.values.map(v=>(
                <div key={v} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 12px",background:TDS.bgSecondary,borderRadius:20,border:`1px solid ${TDS.borderDefault}`,fontSize:13}}>
                  {v}<span style={{cursor:"pointer",color:TDS.textTertiary,fontSize:12}}>✕</span>
                </div>
              ))}
              <div style={{padding:"4px 12px",borderRadius:20,border:`2px dashed ${TDS.borderDefault}`,fontSize:13,color:TDS.textTertiary,cursor:"pointer"}}>+ 추가</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* A28 시스템 설정 */

