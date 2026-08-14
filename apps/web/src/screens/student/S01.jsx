import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { withLoading } from "../../components/LoadingDock.jsx";
import { takeSignOutReason } from "../../lib/sessionExpiry.js";
import { TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider } from "../../components/ui.jsx";
import { NavIcon } from "../../components/NavIcon.jsx";
import { BrandWord } from "../../components/BrandWord.jsx";
import mbxLogo from "../../assets/brand/mbx_logo.png";

/** 돌아가는 낱말. 셋 다 "흩어진 생기부를 ~로 만듭니다" 에 붙는다. */
const HEADLINE_WORDS = ["이어진 지도", "읽히는 근거", "다음 탐구"];

export function S01({ onNav }) {
  const { state, actions } = useStore();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [localErr, setLocalErr] = useState("");
  // 왜 로그인 화면으로 왔는지. 아무 말 없이 뜨면 고장으로 읽힌다.
  // 한 번 읽고 지운다 — 다음에 또 뜨면 거짓말이 된다.
  const [signedOut] = useState(takeSignOutReason);
  // 영상 파일이 있는가. 못 읽으면 영상만 빼고 상자(포스터)는 남긴다.
  const [videoOk, setVideoOk] = useState(true);
  /**
   * 카드가 지금 무엇을 보이는가 — `idle | login | signup`.
   *
   * 학교 계정으로 들어오는 것이 주 경로다. 그런데 이메일·비밀번호 두 칸과
   * 「로그인」이 늘 펼쳐져 있어서 카드가 세로로 길었고, **무엇으로 들어가야
   * 하는지**가 흐렸다 — 같은 무게의 길이 둘로 보였다. 접어 두고 필요한
   * 사람만 편다.
   */
  const [view, setView] = useState("idle");
  const [name, setName] = useState("");
  const emailRef = useRef(null);
  const nameRef = useRef(null);

  /** 펴면서 첫 칸에 커서를 둔다. 펴 놓고 다시 눌러야 하면 한 번 더 손이 간다. */
  const open = (next) => {
    setView(next);
    setLocalErr("");
    requestAnimationFrame(() => (next === "signup" ? nameRef : emailRef).current?.focus());
  };

  const doSignUp = async () => {
    setLocalErr("");
    if (!name.trim()) { setLocalErr("이름을 입력하세요."); return; }
    if (!emailOk) { setLocalErr("올바른 이메일 형식을 입력하세요."); return; }
    if (pw.length < 8) { setLocalErr("비밀번호는 8자 이상이어야 합니다."); return; }
    try {
      await withLoading("계정을 만드는 중이에요…", () => actions.signUp(email, pw, name));
      /* 게이팅이 자동으로 온보딩으로 보낸다 */
    } catch (e) { setLocalErr(e.message); }
  };
  const busy = state.authLoading;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const doPasswordLogin = async () => {
    setLocalErr("");
    if (!emailOk) { setLocalErr("올바른 이메일 형식을 입력하세요."); return; }
    if (pw.length < 4) { setLocalErr("비밀번호를 입력하세요."); return; }
    try {
      await withLoading("로그인 중이에요…", () => actions.signInPassword(email, pw));
      /* 게이팅이 자동으로 역할 홈으로 이동 */
    } catch (e) { setLocalErr(e.message); }
  };
  const doGoogleLogin = async () => {
    setLocalErr("");
    try {
      // 설정을 받아 온 뒤 구글로 **페이지를 통째로 넘긴다.** 그 사이가 비어 있으면
      // 눌렸는지 알 수 없어 한 번 더 누르게 된다.
      await withLoading("Google 로 이동 중이에요…", () => actions.signInGoogle());
    } catch (e) { setLocalErr(e.message); }
  };
  const onKey = e => { if (e.key === "Enter" && !busy) doPasswordLogin(); };
  const onKeyUp2 = e => { if (e.key === "Enter" && !busy) doSignUp(); };
  const errMsg = localErr || state.authError;

  return (
    <div className="login-wrap">
      {/* 소개 영상이 **화면 전체**의 바탕이다.

          처음에는 왼쪽 파란 판 안에 16:9 상자를 두었는데, 상자는 안전한 대신
          작았다(1280×800 에서 538px). 영상이 화면을 다 쓰면 첫인상이 완전히
          달라진다 — 대신 그 위에 글씨가 얹히므로 검은 막을 한 겹 깐다.

          소리 트랙이 있어도 `muted` 없이는 브라우저가 자동재생을 막는다.
          영상을 못 읽으면 아래 그라데이션(.login-wrap 의 background)이 그대로
          남는다 — 예전 화면이 그대로 서는 것이라 깨진 것처럼 보이지 않는다. */}
      {videoOk && (
        <video
          className="login-bg"
          src="/login.mp4"
          autoPlay muted loop playsInline preload="auto"
          onError={() => setVideoOk(false)}
        />
      )}
      <div className="login-scrim" />

      {/* 왼쪽 — 한 줄로 끝낸다.

          영상이 이미 제품을 보여주고 있어서 글이 길면 둘이 싸운다. 특징 세 줄을
          걷고 **한 문장**만 남긴다. 그 문장의 낱말 하나가 대시보드 히어로와
          똑같이 브랜드 물결로 돌아간다(components/BrandWord.jsx) — 로그인하고
          들어가면 같은 빛깔의 같은 문장이 기다린다. */}
      <div className="login-left">
        <div className="login-left-content">
          <div className="login-brand">
            <img className="login-brand-logo" src={mbxLogo} alt="팀코드브릿지 MBX" />
            <span className="login-brand-text" aria-hidden="true">
              팀코드브릿지 <b>MBX</b>
            </span>
          </div>

          <h1 className="login-title">
            흩어진 생기부를<br />
            <BrandWord words={HEADLINE_WORDS} />로 만듭니다
          </h1>
        </div>
      </div>

      {/* 오른쪽 — 로그인 폼 */}
      <div className="login-right">
        <div className="login-box">
          <div className="login-box-head">
            <img className="login-brand-logo is-sm" src={mbxLogo} alt="" aria-hidden="true" />
            <span className="login-box-brand">팀코드브릿지 <b>MBX</b></span>
          </div>

          {/* 「시작하기 / 학교 Google 계정으로 로그인하세요」를 걷었다.
              바로 아래 단추에 "Google로 시작하기" 라고 적혀 있어서 같은 말을
              세 번 하고 있었다. */}
          {/* Google 로그인 */}
          <button
            disabled={busy}
            className="login-google"
            style={busy?{opacity:.6,cursor:"not-allowed"}:undefined}
            onClick={doGoogleLogin}
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            {busy ? "로그인 중…" : "Google로 시작하기"}
          </button>

          {/* 시간이 지나 나간 것은 오류가 아니다. 빨간 상자로 겁주지 않는다. */}
          {signedOut && !errMsg && (
            <div className="login-note">{signedOut}</div>
          )}
          {errMsg && (
            <div className="login-err">{errMsg}</div>
          )}

          {/* 카드는 세 모습이다 — 접힘 / 로그인 / 가입.

              접혀 있을 때는 길이 하나만 보인다(학교 계정). 이메일과 가입은 그
              아래 약한 글씨로 둔다. 셋이 같은 무게로 서면 처음 온 사람이 어디로
              가야 할지 다시 고르게 된다. */}
          {view === "idle" && (
            <>
              <button type="button" className="login-more" onClick={() => open("login")}>
                이메일로 로그인
              </button>
              <p className="login-swap">
                처음이신가요? <button type="button" onClick={() => open("signup")}>회원가입</button>
              </p>
            </>
          )}

          {view === "login" && (
            <>
              <div style={{marginBottom:14}}>
                <label className="login-label">이메일</label>
                <input ref={emailRef} className="inp" placeholder="school@example.ac.kr" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={onKey} disabled={busy} autoComplete="username" />
              </div>
              <div style={{marginBottom:20}}>
                <label className="login-label">비밀번호</label>
                <input className="inp" type="password" placeholder="••••••••" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={onKey} disabled={busy} autoComplete="current-password" />
              </div>
              <Btn v="primary" s="lg" fw onClick={doPasswordLogin} disabled={busy} style={busy?{opacity:.7,cursor:"not-allowed"}:undefined}>
                {busy ? "로그인 중…" : "로그인"}
              </Btn>
              <p className="login-swap">
                처음이신가요? <button type="button" onClick={() => open("signup")}>회원가입</button>
              </p>
            </>
          )}

          {view === "signup" && (
            <>
              {/* 이름을 묻는다. 이메일 앞자리로 지어내면 `netf2005` 같은 것이
                  화면 곳곳에서 사람 이름 자리에 선다. 한 번 물어보는 편이 낫다. */}
              <div style={{marginBottom:14}}>
                <label className="login-label">이름</label>
                <input ref={nameRef} className="inp" placeholder="홍길동" value={name} onChange={e=>setName(e.target.value)} onKeyDown={onKeyUp2} disabled={busy} autoComplete="name" maxLength={50} />
              </div>
              <div style={{marginBottom:14}}>
                <label className="login-label">이메일</label>
                <input className="inp" placeholder="school@example.ac.kr" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={onKeyUp2} disabled={busy} autoComplete="username" />
              </div>
              <div style={{marginBottom:20}}>
                <label className="login-label">비밀번호 <span className="login-hint">8자 이상</span></label>
                <input className="inp" type="password" placeholder="••••••••" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={onKeyUp2} disabled={busy} autoComplete="new-password" />
              </div>
              {/* 가입하고 다시 로그인 화면으로 보내지 않는다 — 방금 정한 것을 한 번
                  더 적으라는 뜻이 되고, 그 사이 오타 한 번이면 자기가 만든 계정에
                  못 들어간다. 서버가 가입과 동시에 토큰을 준다. */}
              <Btn v="primary" s="lg" fw onClick={doSignUp} disabled={busy} style={busy?{opacity:.7,cursor:"not-allowed"}:undefined}>
                {busy ? "만드는 중…" : "가입하고 시작하기"}
              </Btn>
              <p className="login-swap">
                이미 계정이 있나요? <button type="button" onClick={() => open("login")}>로그인</button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* S03 가입 환영 */

