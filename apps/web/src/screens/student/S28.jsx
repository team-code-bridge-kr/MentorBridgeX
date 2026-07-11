import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";

export function S28() {
  return (
    <div className="content">
      <div className="sec-title mb6" style={{marginBottom:6}}>나의 활동 통계</div>
      <div className="sec-sub">지난 30일간의 활동을 요약했어요</div>
      <div className="grid4 g-20 mb24" style={{gap:20,marginBottom:24}}>
        <StatCard label="총 노드" value="2,847개" sub="전월 대비 +12%" color={TDS.blue500} />
        <StatCard label="활동일" value="47일" sub="최근 30일 중" color={TDS.success} />
        <StatCard label="코멘트 수신" value="38개" sub="교사 3명" color={TDS.warning} />
        <StatCard label="양식 생성" value="6개" sub="자소서 3, 보고서 3" color={TDS.textPrimary} />
      </div>
      <div className="grid2 g-20" style={{gap:20}}>
        <Card>
          <div className="card-title mb16" style={{marginBottom:16}}>영역별 완성도</div>
          {[["세특",95],["자율",80],["동아리",88],["봉사",0],["진로",92],["행특",75],["독서",0],["수상",45]].map(([nm,pct])=>(
            <div key={nm} style={{marginBottom:12}}>
              <div className="row-between mb4" style={{marginBottom:4,fontSize:13}}>
                <span style={{color:TDS.textSecondary}}>{nm}</span>
                <span style={{fontWeight:600,color:pct>0?TDS.blue500:TDS.textDisabled}}>{pct}%</span>
              </div>
              <div className="prog-wrap">
                <div className="prog-fill" style={{width:`${pct}%`,background:pct>0?TDS.blue500:TDS.bgTertiary}} />
              </div>
            </div>
          ))}
        </Card>
        <Card>
          <div className="card-title mb16" style={{marginBottom:16}}>노드 분포</div>
          {[["물리학",420],["화학",380],["수학",310],["영어",280],["인공지능",240],["기타",1217]].map(([nm,cnt])=>(
            <div key={nm} className="row g-12 mb12" style={{gap:12,marginBottom:12,alignItems:"center"}}>
              <span style={{fontSize:13,width:70,color:TDS.textSecondary}}>{nm}</span>
              <div style={{flex:1,height:8,background:TDS.bgTertiary,borderRadius:4,overflow:"hidden"}}>
                <div style={{height:8,background:TDS.blue500,borderRadius:4,width:`${(cnt/1217)*100}%`,opacity:.85}} />
              </div>
              <span style={{fontSize:12,color:TDS.textTertiary,width:44,textAlign:"right"}}>{cnt.toLocaleString()}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

/* S30 설정 */

