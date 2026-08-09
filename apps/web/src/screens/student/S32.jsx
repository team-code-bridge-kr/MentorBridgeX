/**
 * S32 — 계정 삭제
 *
 * 이 화면은 **아무것도 하지 않고 있었다.** 단추를 누르면 화면이 "삭제 요청이
 * 접수되었습니다 · 2026-02-20 이후 데이터가 완전히 삭제됩니다" 로 바뀌었는데,
 * 그 날짜는 코드에 박아 둔 글자였고 서버는 요청이 있었다는 사실조차 몰랐다.
 * 30일 안에 "철회하기" 를 누르면 "철회되었습니다" 가 떴다 — 철회할 요청이
 * 애초에 없었으니 그것도 참말이 아니었다.
 *
 * 개인정보를 지워 달라는 것은 학생의 권리다. 지워 준 척하는 화면은 없는 것만
 * 못하다.
 *
 * 지금은 진짜로 지운다. 그래서 화면도 사실대로 바뀐다.
 *
 * - **30일 유예를 없앴다.** 미루려면 "지우는 중" 상태와 그날 실제로 지우는
 *   일꾼이 필요한데, 그 일꾼이 한 번 죽으면 아무도 모르는 채 데이터가 남는다.
 *   지워 준 척했던 자리로 돌아간다.
 * - **자기 이메일을 적게 한다.** 되돌릴 수 없는 일에는 "정말요?" 한 번보다
 *   직접 쓰는 한 줄이 낫다. 확인 창은 눈을 감고도 눌린다.
 */

import { useState } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import { Back, Btn, Notice } from "../../components/ui.jsx";
import { withLoading } from "../../components/LoadingDock.jsx";
import api from "../../api/index.js";

export function S32({ onNav }) {
  const { state, actions } = useStore();
  const email = state.session?.user?.email || "";
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const matches = typed.trim().toLowerCase() === email.toLowerCase() && Boolean(email);

  const remove = async () => {
    setBusy(true);
    setErr("");
    try {
      await withLoading("계정을 지우는 중이에요…", () => api.account.remove(typed.trim()));
      // 지운 뒤에는 남아 있는 토큰으로 아무것도 할 수 없다. 화면에 남겨 두면
      // 누를 때마다 "유효하지 않은 토큰" 만 뜬다.
      await actions.signOut();
    } catch (e) {
      setErr(e.message || "계정을 지우지 못했습니다.");
      setBusy(false);
    }
  };

  return (
    <div className="rs-wrap rs-narrow">
      <div className="form-head">
        <Back onClick={() => onNav("S30")} label="설정" />
        <h1 className="form-title">계정 삭제</h1>
      </div>

      <Notice type="danger">
        <div className="del-warn-t">되돌릴 수 없습니다</div>
        <ul className="del-warn-list">
          <li>지식 그래프, 생기부 글, 보고서, 녹음, 코멘트가 <strong>모두</strong> 지워집니다.</li>
          <li>지운 뒤에는 복구할 방법이 없습니다. 취소 기간도 없습니다.</li>
          <li>같은 이메일로 다시 가입할 수는 있지만, 빈 계정으로 시작합니다.</li>
        </ul>
      </Notice>

      <div className="card card-p del-confirm">
        <label className="inp-label" htmlFor="del-email">
          지우려면 아래에 <strong>{email || "로그인한 이메일"}</strong> 을 적어 주세요
        </label>
        <input
          id="del-email"
          className="inp"
          type="email"
          autoComplete="off"
          placeholder={email}
          value={typed}
          onChange={(e) => { setTyped(e.target.value); setErr(""); }}
        />
        {typed && !matches && (
          <div className="del-hint">이메일이 아직 맞지 않습니다.</div>
        )}
      </div>

      {err && <div className="form-err">{err}</div>}

      <div className="del-actions">
        <Btn v="secondary" s="md" onClick={() => onNav("S30")}>그만두기</Btn>
        <Btn v="danger" s="md" disabled={!matches || busy} onClick={remove}>
          계정 영구 삭제
        </Btn>
      </div>

      {/* 지우는 것 말고 다른 길이 있다는 것도 알려 준다. 대개는 "다 지우고
          싶다" 가 아니라 "이건 남기기 싫다" 이다. */}
      <p className="del-alt">
        기록만 정리하고 싶다면{" "}
        <button type="button" className="del-alt-link" onClick={() => onNav("S30")}>
          설정 · 데이터
        </button>
        에서 탐구 기록만 따로 지울 수 있습니다.
      </p>
    </div>
  );
}
