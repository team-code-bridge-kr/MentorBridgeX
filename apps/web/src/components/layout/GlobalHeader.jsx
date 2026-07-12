import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Av } from "../ui.jsx";

export function GlobalHeader({ onNav }) {
  const { state } = useStore();
  const user = state.session?.user;
  const name = user?.name || user?.email?.split("@")[0] || "?";
  const picture = user?.picture;

  return (
    <>
      <div className="icon-btn" onClick={() => onNav("S27")} title="검색">
        <TFI s={18} color={TDS.textSecondary}>🔍</TFI>
      </div>
      <div className="icon-btn" onClick={() => onNav("S25")} title="알림" style={{ position: "relative" }}>
        <TFI s={18} color={TDS.textSecondary}>🔔</TFI>
        <span className="notif-dot" />
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
