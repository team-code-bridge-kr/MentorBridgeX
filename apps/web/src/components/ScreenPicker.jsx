import { useState } from "react";
import TDS from "../theme/tokens.js";
import { TFI } from "./ui.jsx";
import { NavIcon, NAV_ICON_PATHS } from "./NavIcon.jsx";
import { S_NAV, T_NAV, A_NAV } from "../nav/menus.js";

const ALL_SCREENS=[
  ...S_NAV.map(n=>({...n,g:"학생"})),
  {id:"S02",icon:"🔐",label:"OAuth 콜백",g:"학생"},{id:"S03",icon:"🎉",label:"가입 환영",g:"학생"},
  {id:"S04",icon:"🌱",label:"시드 입력",g:"학생"},
  {id:"S09",icon:"➕",label:"시드 추가",g:"학생"},
  {id:"S12",icon:"✏️",label:"텍스트 편집",g:"학생"},
  {id:"S13",icon:"📎",label:"PDF 업로드",g:"학생"},{id:"S14",icon:"🔍",label:"파싱 결과",g:"학생"},
  {id:"S17",icon:"📋",label:"보고서 검토",g:"학생"},
  
  {id:"S21",icon:"📄",label:"결과물 목록",g:"학생"},{id:"S22",icon:"📖",label:"결과물 상세",g:"학생"},
  {id:"S23",icon:"✂️",label:"가지치기 추천",g:"학생"},
  {id:"S32",icon:"🗑️",label:"계정 삭제",g:"학생"},
  ...T_NAV.map(n=>({...n,g:"교사"})),
  {id:"T01",icon:"📋",label:"자격 검증 신청",g:"교사"},{id:"T02",icon:"⏳",label:"자격 검증 상태",g:"교사"},
  {id:"T04",icon:"➕",label:"매핑 신청",g:"교사"},{id:"T05",icon:"📊",label:"매핑 상태",g:"교사"},
  {id:"T07",icon:"👤",label:"학생 상세 R",g:"교사"},{id:"T08",icon:"🧠",label:"그래프 R",g:"교사"},
  {id:"T09",icon:"🔵",label:"노드 상세 R",g:"교사"},{id:"T10",icon:"✍️",label:"코멘트 작성",g:"교사"},
  {id:"T12",icon:"🎙️",label:"회의 녹음",g:"교사"},
  {id:"A00",icon:"🔐",label:"관리자 로그인",g:"관리자"},
  ...A_NAV.map(n=>({...n,g:"관리자"})),
  {id:"A03",icon:"👤",label:"사용자 상세",g:"관리자"},{id:"A04",icon:"🚫",label:"계정 정지",g:"관리자"},
  {id:"A05",icon:"🗑️",label:"강제 삭제 T2",g:"관리자"},{id:"A07",icon:"✅",label:"자격 상세",g:"관리자"},
  {id:"A09",icon:"📋",label:"신고 상세",g:"관리자"},{id:"A10",icon:"💬",label:"신고된 코멘트",g:"관리자"},
  {id:"A11",icon:"🗑️",label:"코멘트 삭제",g:"관리자"},{id:"A12",icon:"📸",label:"스냅샷 T2",g:"관리자"},
  {id:"A15",icon:"🤖",label:"임베딩 모델",g:"관리자"},{id:"A16",icon:"🔄",label:"모델 교체",g:"관리자"},
  {id:"A17",icon:"📢",label:"공지 목록",g:"관리자"},{id:"A18",icon:"✍️",label:"공지 발행",g:"관리자"},
  {id:"A19",icon:"🔑",label:"JWKS T2",g:"관리자"},{id:"A20",icon:"⚡",label:"Redis T2",g:"관리자"},
  {id:"A22",icon:"📋",label:"감사 상세",g:"관리자"},{id:"A23",icon:"📤",label:"감사 내보내기",g:"관리자"},
  {id:"A24",icon:"🔎",label:"Investigation T2",g:"관리자"},{id:"A26",icon:"📝",label:"템플릿 마스터",g:"관리자"},
  {id:"A27",icon:"🏷️",label:"Enum 마스터",g:"관리자"},{id:"A28",icon:"⚙️",label:"시스템 설정",g:"관리자"},
  {id:"A30",icon:"🎯",label:"Tier 변경 T2",g:"관리자"},{id:"A31",icon:"📜",label:"활동 이력",g:"관리자"},
  {id:"A32",icon:"🐛",label:"디버깅 신청",g:"관리자"},
];

export function ScreenPicker({ cur, onSel }) {
  const [q, setQ] = useState("");
  const gs=["학생","교사","관리자"];
  const seen=new Set();
  const filtered=ALL_SCREENS.filter(s=>!q||(s.label+s.id).toLowerCase().includes(q.toLowerCase())).filter(s=>{ if(seen.has(s.id))return false; seen.add(s.id); return true; });
  return (
    <div style={{position:"fixed",bottom:80,right:20,width:360,maxHeight:520,background:TDS.bgPrimary,borderRadius:16,boxShadow:"0 20px 60px rgba(0,0,0,.18)",border:`1px solid ${TDS.borderDefault}`,overflow:"hidden",display:"flex",flexDirection:"column",zIndex:9998}}>
      <div style={{padding:"14px 16px",borderBottom:`1px solid ${TDS.borderDefault}`}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:8,color:TDS.textPrimary}}>화면 목록 (76개)</div>
        <div className="search-wrap" style={{height:36}}><NavIcon name="search" size={15} color={TDS.textTertiary}/><input placeholder="화면 ID 또는 이름 검색..." value={q} onChange={e=>setQ(e.target.value)} autoFocus /></div>
      </div>
      <div style={{overflowY:"auto",flex:1,padding:"6px 0"}}>
        {gs.map(g=>{
          const items=filtered.filter(s=>s.g===g);
          if(!items.length)return null;
          return (
            <div key={g}>
              <div style={{padding:"6px 16px 4px",fontSize:10,fontWeight:700,color:TDS.textTertiary,letterSpacing:".5px"}}>
                <TFI s={12}>{g==="학생"?"🎓":g==="교사"?"👩‍🏫":"🛡️"}</TFI>{" "}{g==="학생"?"학생":g==="교사"?"교사":"관리자"}
              </div>
              {items.map(s=>(
                <div key={s.id} onClick={()=>onSel(s.id)} style={{padding:"8px 16px",display:"flex",alignItems:"center",gap:10,cursor:"pointer",background:cur===s.id?TDS.blue50:"transparent",transition:"background .1s"}}>
                  <span style={{width:40,fontSize:11,color:TDS.textTertiary,fontFamily:"monospace",fontWeight:600}}>{s.id}</span>
                  {NAV_ICON_PATHS[s.icon]
                    ? <NavIcon name={s.icon} size={16} color={cur===s.id?TDS.blue500:"#6b7a90"} />
                    : <TFI s={16}>{s.icon}</TFI>}
                  <span style={{fontSize:14,color:cur===s.id?TDS.blue500:TDS.textPrimary,fontWeight:cur===s.id?700:400}}>{s.label}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   ROOT APP
────────────────────────────────────────────────────────────── */
/* 로그인 없이 접근 가능한 화면 (인증 게이트 예외) */

