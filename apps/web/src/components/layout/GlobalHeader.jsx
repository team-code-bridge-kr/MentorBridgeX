import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Av } from "../ui.jsx";

export function GlobalHeader({ onNav }) {
  const { state } = useStore();
  const user = state.session?.user;
  const name = user?.name || user?.email?.split("@")[0] || "?";
  const picture = user?.picture;
  const unread = (state.notifications || []).filter((n) => !n.read).length;

  return (
    <>
      {/* 검색 버튼을 뺐다. 여기(관리자 레이아웃)에서 열리던 통합 검색은 로그인한
          사람 자신의 노드·문서·음성·코멘트를 뒤지는 화면이라, 관리자에게는 언제나
          빈 결과였다. 학생 검색은 활동 기록(S44)으로 합쳤다. */}
      <div className="icon-btn" onClick={() => onNav("S25")} title="알림" style={{ position: "relative" }}>
        <TFI s={18} color={TDS.textSecondary}>🔔</TFI>
        {unread > 0 && <span className="notif-dot" />}
      </div>
      <div
        onClick={() => onNav("S30")}
        title={user?.email || name}
        style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}
      >
        <Av name={name} src={picture} size="sm" />
        <span style={{ fontSize: 13, fontWeight: 600, color: TDS.textPrimary, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </span>
      </div>
    </>
  );
}
