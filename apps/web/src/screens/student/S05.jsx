import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";
import { DonutChart } from "../../components/ui.jsx";

export function S05({ onNav }) {
  const [period, setPeriod] = useState("일별");

  // 30개 데이터 포인트 (피그마 DAU 차트와 동일)
  const pts = [42,68,55,82,71,90,78,95,83,110,98,115,88,102,119,105,125,108,118,112,98,115,107,120,113,119,125,118,122,119];
  const maxV = 130, nPts = pts.length;
  const W = 800, H = 200, padX = 40, padY = 12;
  const tx = i => padX + (i / (nPts - 1)) * (W - padX - 8);
  const ty = v => padY + (1 - v / maxV) * (H - padY * 2);
  const linePath = pts.map((v, i) => `${i === 0 ? "M" : "L"} ${tx(i)} ${ty(v)}`).join(" ");
  const areaPath = linePath + ` L ${tx(nPts-1)} ${H} L ${tx(0)} ${H} Z`;

  // stat 카드 데이터 (피그마와 동일)
  const stats = [
    { label:"총 노드 수", value:"2,847개", sub:"전월 대비 +12%", color:TDS.blue500, icon:"🧠", iconBg:TDS.blue50, trend:"+12%", trendUp:true },
    { label:"텍스트 영역", value:"8 / 8",  sub:"모든 영역 입력됨", color:TDS.success, icon:"📄", iconBg:TDS.successBg, trend:"완료", trendUp:true },
    { label:"음성 세션",  value:"23회",    sub:"총 18시간 37분", color:TDS.textPrimary, icon:"🎙️", iconBg:TDS.bgTertiary, trend:"+3", trendUp:true },
    { label:"양식 생성",  value:"6개",     sub:"이번 달 3개 생성", color:TDS.warning, icon:"📝", iconBg:TDS.warningBg, trend:"+2", trendUp:true },
  ];

  // 활동 항목 (dot 색상 피그마와 동일)
  const acts = [
    { title:"텍스트 편집", desc:"세특 영역 내용 수정",      time:"5분 전",   dot:TDS.blue500 },
    { title:"노드 추가",   desc:'"양자컴퓨팅" 노드 생성',   time:"1시간 전", dot:TDS.success },
    { title:"음성 녹음",   desc:"화학 세특 토론 기록",       time:"2시간 전", dot:TDS.warning },
    { title:"양식 생성",   desc:"화학과 지원용 자소서 생성", time:"어제",     dot:TDS.blue500 },
  ];

  // 코멘트 항목
  const comments = [
    { from:"김선생님", txt:"세특 내용 중 실험 결과 부분을 더 구체적으로 서술해 주세요.", time:"10분 전", unread:true },
    { from:"박선생님", txt:"동아리 활동에서 리더십이 잘 드러나고 있어요.",               time:"1시간 전", unread:false },
    { from:"이선생님", txt:"양자컴퓨팅 노드에 관련 논문 링크도 추가해 보세요.",           time:"어제",    unread:false },
  ];

  // X축 날짜 레이블
  const xLabels = ["01.19","01.22","01.25","01.28","01.31","02.03","02.06","02.09","02.12","02.15"];

  return (
    <div className="content">

      {/* ── Stat 카드 4개 (피그마: 아이콘배지 + 트렌드배지 + 하단 컬러라인) ── */}
      <div className="grid4" style={{gap:20,marginBottom:24}}>
        {stats.map((s,i) => (
          <div key={i} className="card" style={{padding:"22px 24px",position:"relative",overflow:"hidden"}}>
            {/* 아이콘 배경 */}
            <div style={{width:44,height:44,borderRadius:12,background:s.iconBg,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:10}}>
              <TFI s={22} color={s.color}>{s.icon}</TFI>
            </div>
            {/* 레이블 */}
            <div style={{fontSize:13,color:TDS.textTertiary,fontWeight:500,marginBottom:6}}>{s.label}</div>
            {/* 값 */}
            <div style={{fontSize:26,fontWeight:700,color:s.color,lineHeight:1.15,marginBottom:8}}>{s.value}</div>
            {/* 서브텍스트 */}
            <div style={{fontSize:12,color:TDS.textDisabled}}>{s.sub}</div>
            {/* 트렌드 배지 */}
            <div style={{position:"absolute",top:20,right:20,padding:"3px 8px",borderRadius:4,background:s.trendUp?TDS.successBg:TDS.dangerBg,color:s.trendUp?TDS.success:TDS.danger,fontSize:11,fontWeight:700}}>{s.trend}</div>
            {/* 하단 컬러 액센트 라인 */}
            <div style={{position:"absolute",bottom:0,left:0,right:0,height:3,background:s.color,borderRadius:"0 0 16px 16px"}} />
          </div>
        ))}
      </div>

      {/* ── DAU 라인 차트 (피그마: 30pt, 면채움, dot 6개, Y축 그리드) ── */}
      <div className="card card-p mb24" style={{marginBottom:24}}>
        <div className="card-hdr">
          <div className="row" style={{gap:8,alignItems:"center"}}>
            <span className="card-title">DAU (일별 활성 사용자)</span>
            <div style={{width:18,height:18,borderRadius:"50%",background:TDS.bgTertiary,color:TDS.textTertiary,fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>?</div>
          </div>
          <div className="row" style={{gap:12,alignItems:"center"}}>
            <div className="tab-pill-wrap">
              {["일별","주별","월별"].map(p=>(
                <div key={p} className={`tab-pill${period===p?" active":""}`} onClick={()=>setPeriod(p)}>{p}</div>
              ))}
            </div>
            <div className="date-range"><TFI>📅</TFI>&nbsp;2025.12.28 ~ 2026.01.28</div>
            <Btn v="secondary" s="sm">다운로드</Btn>
          </div>
        </div>

        {/* SVG 차트 — 완전 반응형: viewBox 유지, height auto */}
        <div style={{background:TDS.bgSecondary,borderRadius:10,padding:"16px 16px 0",overflow:"hidden"}}>
          <div style={{position:"relative",width:"100%",paddingBottom:"27%",minHeight:120}}>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="xMidYMid meet"
              style={{position:"absolute",inset:0,width:"100%",height:"100%",display:"block"}}
            >
              <defs>
                <linearGradient id="dauGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TDS.blue500} stopOpacity="0.18" />
                  <stop offset="100%" stopColor={TDS.blue500} stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Y축 그리드 라인 + 레이블 */}
              {[0,25,50,75,100,125].map(v => (
                <g key={v}>
                  <line x1={padX} y1={ty(v)} x2={W-8} y2={ty(v)} stroke={TDS.borderDefault} strokeWidth="0.8" opacity="0.7" />
                  <text x={padX-4} y={ty(v)+4} textAnchor="end" fontSize="10" fill={TDS.textTertiary} fontFamily="Pretendard,sans-serif">{v}</text>
                </g>
              ))}
              {/* 면 채움 */}
              <path d={areaPath} fill="url(#dauGrad)" />
              {/* 라인 */}
              <path d={linePath} fill="none" stroke={TDS.blue500} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {/* 데이터 포인트 (6개 강조) */}
              {[4,9,14,19,24,29].map(i => (
                <circle key={i} cx={tx(i)} cy={ty(pts[i])} r="4" fill="#fff" stroke={TDS.blue500} strokeWidth="2.5" />
              ))}
            </svg>
          </div>
        </div>
        {/* X축 날짜 레이블 */}
        <div style={{display:"flex",justifyContent:"space-between",padding:"6px 16px 0",fontSize:10,color:TDS.textTertiary}}>
          {xLabels.map(d => <span key={d}>{d}</span>)}
        </div>
      </div>

      {/* ── OS 도넛 + 성별 도넛 (피그마와 동일) ── */}
      <div className="grid2" style={{gap:20,marginBottom:24}}>
        {/* OS 분포 */}
        <div className="card card-p">
          <div className="card-hdr">
            <span className="card-title">OS 분포</span>
            <span style={{fontSize:13,color:TDS.textTertiary}}>총 763명</span>
          </div>
          {/* 도넛 */}
          <div style={{display:"flex",justifyContent:"center",marginBottom:16}}>
            <DonutChart
              size={148}
              label="Android"
              pct="61.3%"
              data={[
                {color:TDS.chartAndroid, pct:0.613},
                {color:TDS.chartiOS,     pct:0.387},
              ]}
            />
          </div>
          {/* 구분선 */}
          <div style={{height:1,background:TDS.borderDefault,marginBottom:14}} />
          {/* 범례 */}
          {[
            {col:TDS.chartAndroid, name:"Android", cnt:"468명", pct:"61.3%"},
            {col:TDS.chartiOS,     name:"iOS",     cnt:"295명", pct:"38.7%"},
          ].map(l=>(
            <div key={l.name} style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:l.col,flexShrink:0}} />
              <span style={{fontSize:13,color:TDS.textSecondary,minWidth:60}}>{l.name}</span>
              <span style={{fontSize:13,color:TDS.textSecondary,flex:1}}>{l.cnt}</span>
              <span style={{fontSize:13,fontWeight:600,color:TDS.textPrimary,minWidth:44}}>{l.pct}</span>
              {/* 미니 프로그레스바 */}
              <div style={{width:48,height:4,background:TDS.bgTertiary,borderRadius:2,overflow:"hidden"}}>
                <div style={{height:4,borderRadius:2,background:l.col,width:`${parseFloat(l.pct)}%`}} />
              </div>
            </div>
          ))}
        </div>

        {/* 성별 분포 */}
        <div className="card card-p">
          <div className="card-hdr">
            <span className="card-title">성별 분포</span>
            <span style={{fontSize:13,color:TDS.textTertiary}}>총 763명</span>
          </div>
          <div style={{display:"flex",justifyContent:"center",marginBottom:16}}>
            <DonutChart
              size={148}
              label="남성"
              pct="64.7%"
              data={[
                {color:TDS.chartMale,   pct:0.647},
                {color:TDS.chartFemale, pct:0.353},
              ]}
            />
          </div>
          <div style={{height:1,background:TDS.borderDefault,marginBottom:14}} />
          {[
            {col:TDS.chartMale,   name:"남성", cnt:"494명", pct:"64.7%"},
            {col:TDS.chartFemale, name:"여성", cnt:"269명", pct:"35.3%"},
          ].map(l=>(
            <div key={l.name} style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:l.col,flexShrink:0}} />
              <span style={{fontSize:13,color:TDS.textSecondary,minWidth:60}}>{l.name}</span>
              <span style={{fontSize:13,color:TDS.textSecondary,flex:1}}>{l.cnt}</span>
              <span style={{fontSize:13,fontWeight:600,color:TDS.textPrimary,minWidth:44}}>{l.pct}</span>
              <div style={{width:48,height:4,background:TDS.bgTertiary,borderRadius:2,overflow:"hidden"}}>
                <div style={{height:4,borderRadius:2,background:l.col,width:`${parseFloat(l.pct)}%`}} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 최근 활동 + 읽지 않은 코멘트 ── */}
      <div className="grid2" style={{gap:20}}>
        {/* 최근 활동 (피그마: 색상 dot + title/desc/time) */}
        <div className="card card-p">
          <div className="card-hdr">
            <span className="card-title">최근 활동</span>
            <Btn v="ghost" s="sm" onClick={()=>onNav("S26")}>피드 보기</Btn>
          </div>
          {acts.map((a,i) => (
            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"13px 0",borderBottom:i<acts.length-1?`1px solid ${TDS.bgTertiary}`:"none"}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:a.dot,flexShrink:0,marginTop:7}} />
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:500,color:TDS.textPrimary}}>{a.title}</div>
                <div style={{fontSize:13,color:TDS.textTertiary,marginTop:2}}>{a.desc}</div>
              </div>
              <div style={{fontSize:12,color:TDS.textDisabled,flexShrink:0}}>{a.time}</div>
            </div>
          ))}
        </div>

        {/* 읽지 않은 코멘트 (피그마: 아바타 + 안 읽음 dot + 내용 클리핑) */}
        <div className="card card-p">
          <div className="card-hdr">
            <div className="row" style={{gap:8,alignItems:"center"}}>
              <span className="card-title">읽지 않은 코멘트</span>
              <span className="badge-num">3</span>
            </div>
            <Btn v="ghost" s="sm" onClick={()=>onNav("S24")}>전체 보기</Btn>
          </div>
          {comments.map((c,i) => (
            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"13px 0",borderBottom:i<comments.length-1?`1px solid ${TDS.bgTertiary}`:"none",position:"relative"}}>
              {/* 안 읽음 파란 dot */}
              {c.unread && <div style={{position:"absolute",left:-2,top:18,width:6,height:6,borderRadius:"50%",background:TDS.blue500}} />}
              {/* 아바타 */}
              <Av name={c.from[0]} size="sm" />
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:13,fontWeight:700,color:TDS.textPrimary}}>{c.from}</span>
                  <span style={{fontSize:11,color:TDS.textDisabled,flexShrink:0,marginLeft:8}}>{c.time}</span>
                </div>
                <div style={{fontSize:13,color:TDS.textSecondary,overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{c.txt}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

