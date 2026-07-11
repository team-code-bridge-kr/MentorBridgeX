import { useStore } from "../store/StoreProvider.jsx";
import TDS from "../theme/tokens.js";
import { TFI } from "./ui.jsx";

export function Toast() {
  const { state } = useStore();
  if (!state.toast) return null;
  const c = { success:TDS.blue500, error:TDS.danger, info:TDS.textSecondary }[state.toast.type] || TDS.textSecondary;
  return (
    <div style={{position:"fixed",bottom:88,left:"50%",transform:"translateX(-50%)",zIndex:10000,
      background:"#111",color:"#fff",padding:"12px 20px",borderRadius:12,fontSize:14,fontWeight:600,
      boxShadow:"0 8px 30px rgba(0,0,0,.3)",borderLeft:`3px solid ${c}`,maxWidth:"90vw"}}>
      {state.toast.msg}
    </div>
  );
}



/* ──────────────────────────────────────────────────────────────
   TDS TOKEN MAP  (toss-design-system.md 기준)
────────────────────────────────────────────────────────────── */

