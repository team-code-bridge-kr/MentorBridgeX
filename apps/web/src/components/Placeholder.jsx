import TDS from "../theme/tokens.js";
import { TFI } from "./ui.jsx";

export function Placeholder({ title, screen }) {
  return (
    <div className="content">
      <div className="empty">
        <div className="empty-icon"><TFI s={48} color={TDS.warning}>🚧</TFI></div>
        <div className="empty-title">{title}</div>
        <div className="empty-sub">화면이 준비 중입니다</div>
        <p style={{fontSize:11,color:TDS.textDisabled}}>{screen}</p>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   SCREEN MAP
────────────────────────────────────────────────────────────── */

