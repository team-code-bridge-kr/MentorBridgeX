import { useEffect, useState } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import api from "../../api/index.js";
import { showLoading } from "../../components/LoadingDock.jsx";

/**
 * S02 — Google OAuth 콜백
 * URL: /oauth/callback?code=...&state=...
 */
export function S02({ onNav }) {
  const { actions } = useStore();
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    // 구글에서 돌아와 토큰을 바꾸는 동안. 실패하면 아래에서 바로 내린다.
    const doneLoading = showLoading("로그인을 마무리하는 중이에요…", { center: true });

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const oauthErr = params.get("error");

      if (oauthErr) {
        doneLoading();
        setErr(`Google 로그인 취소/실패: ${oauthErr}`);
        return;
      }
      if (!code) {
        doneLoading();
        setErr("인증 코드가 없습니다. 다시 로그인해 주세요.");
        return;
      }

      const expected = sessionStorage.getItem("mbx_oauth_state");
      if (expected && state && expected !== state) {
        doneLoading();
        setErr("잘못된 OAuth state 입니다. 다시 시도해 주세요.");
        return;
      }

      const redirectUri =
        sessionStorage.getItem("mbx_oauth_redirect") ||
        `${window.location.origin}/oauth/callback`;

      try {
        const session = await api.auth.exchangeOAuthCode(code, redirectUri);
        sessionStorage.removeItem("mbx_oauth_state");
        sessionStorage.removeItem("mbx_oauth_redirect");
        if (cancelled) return;
        await actions.completeGoogleSession(session);
        onNav?.("S05", { replace: true });
      } catch (e) {
        if (!cancelled) setErr(e.message || "Google 로그인에 실패했습니다.");
      } finally {
        doneLoading();
      }
    })();

    return () => { cancelled = true; doneLoading(); };
  }, [actions, onNav]);

  // 기다리는 동안에는 아무것도 그리지 않는다. 아래 알림이 무슨 일이 도는지
  // 이미 말하고 있고, 자물쇠 그림과 "확인하고 있습니다" 를 한 번 더 얹으면
  // 같은 말을 두 번 하는 셈이다. 이 화면은 스쳐 가는 자리다.
  if (!err) return null;

  return (
    <div className="login-wrap" style={{ justifyContent: "center", alignItems: "center" }}>
      <div className="login-box" style={{ textAlign: "center", maxWidth: 420 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10, color: TDS.textPrimary }}>
          로그인 실패
        </h2>
        <p style={{ fontSize: 14, color: TDS.textTertiary, marginBottom: 24, lineHeight: 1.6 }}>{err}</p>
        <button
          type="button"
          onClick={() => onNav?.("S01", { replace: true })}
          style={{
            height: 44, padding: "0 20px", borderRadius: 10, border: "none",
            background: TDS.blue500, color: "#fff", fontWeight: 700, cursor: "pointer",
          }}
        >
          로그인으로 돌아가기
        </button>
      </div>
    </div>
  );
}
