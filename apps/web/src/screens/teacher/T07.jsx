import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function T07({ onNav }) {
  const { state } = useStore();
  const stu = state.selectedStudent || { name:"홍길동", grade:"3-2", id:"20301" };
  const [tab, setTab] = useState("그래프");
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div className="toolbar">
        <div className="row g-12" style={{flex:1,gap:12}}>
          <Av name={stu.name[0]} size="md" />
          <div><div style={{fontWeight:700,fontSize:15}}>{stu.name}</div><div style={{fontSize:12,color:TDS.textTertiary}}>{stu.grade?`${stu.grade.replace("-","학년 ")}반`:""} · 학번 {stu.id}</div></div>
          <Badge t="orange">읽기 전용</Badge>
        </div>
        <Btn v="primary" s="sm" onClick={()=>onNav("T10")}>코멘트 작성</Btn>
      </div>
      <div className="tab-bar" style={{padding:"0 24px",background:TDS.bgPrimary,margin:0}}>
        {["그래프","텍스트 영역","음성 보고서","코멘트"].map(t=>(
          <div key={t} className={`tab-item${tab===t?" active":""}`} onClick={()=>setTab(t)}>{t}</div>
        ))}
      </div>
      <div style={{flex:1,padding:24,overflow:"auto",background:TDS.bgSecondary}}>
        {tab==="그래프"&&(
          <>
            <Notice type="warning" className="mb16">이 그래프는 읽기 전용입니다. 코멘트 작성만 가능합니다.</Notice>
            <div style={{height:360,background:TDS.bgTertiary,borderRadius:16,position:"relative",border:`1px solid ${TDS.borderDefault}`}}>
              {[{x:"50%",y:"45%",l:"물리학",c:TDS.blue500,sz:60},{x:"28%",y:"26%",l:"양자역학",c:TDS.blue400,sz:44},{x:"72%",y:"24%",l:"고전역학",c:TDS.success,sz:44}].map(n=>(
                <div key={n.l} onClick={()=>onNav("T09")} style={{position:"absolute",left:n.x,top:n.y,transform:"translate(-50%,-50%)",width:n.sz,height:n.sz,borderRadius:"50%",background:n.c,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>{n.l}</div>
              ))}
            </div>
          </>
        )}
        {tab==="텍스트 영역"&&(
          <div className="grid3 g-14" style={{gap:14}}>
            {["세특","자율","동아리","봉사","진로","행특","독서","수상"].map(a=>(
              <div key={a} className="card card-p" style={{cursor:"pointer"}} onClick={()=>onNav("T09")}>
                <div style={{fontSize:15,fontWeight:700,marginBottom:6}}>{a}</div>
                <Badge t="grey">읽기 전용</Badge>
              </div>
            ))}
          </div>
        )}
        {tab==="음성 보고서"&&(
          <div style={{textAlign:"center",padding:"48px 0",color:TDS.textTertiary,fontSize:14}}>등록된 음성 보고서가 없습니다</div>
        )}
        {tab==="코멘트"&&(
          <div style={{textAlign:"center",padding:"48px 0"}}>
            <div style={{fontSize:14,color:TDS.textTertiary,marginBottom:16}}>이 학생에게 남긴 코멘트를 확인하거나 새로 작성하세요</div>
            <Btn v="primary" s="md" onClick={()=>onNav("T10")}>+ 코멘트 작성</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

