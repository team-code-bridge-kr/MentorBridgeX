import { useEffect, useState } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI } from "../../components/ui.jsx";
import api from "../../api/index.js";

/**
 * S02 — Google OAuth 콜백
 * URL: /oauth/callback?code=...&state=...
 */
export function S02({ onNav }) {
  const { actions } = useStore();
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const oauthErr = params.get("error");

      if (oauthErr) {
        setErr(`Google 로그인 취소/실패: ${oauthErr}`);
        return;
      }
      if (!code) {
        setErr("인증 코드가 없습니다. 다시 로그인해 주세요.");
        return;
      }

      const expected = sessionStorage.getItem("mbx_oauth_state");
      if (expected && state && expected !== state) {
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
      }
    })();

    return () => { cancelled = true; };
  }, [actions, onNav]);

  return (
    <div className="login-wrap" style={{ justifyContent: "center", alignItems: "center" }}>
      <div className="login-box" style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, background: TDS.blue500,
          display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 20,
        }}>
          <TFI s={22} color="#fff">🔐</TFI>
        </div>
        {err ? (
          <>
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
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10, color: TDS.textPrimary }}>
              Google 로그인 중…
            </h2>
            <p style={{ fontSize: 14, color: TDS.textTertiary }}>계정 정보를 확인하고 있습니다.</p>
          </>
        )}
      </div>
    </div>
  );
}
