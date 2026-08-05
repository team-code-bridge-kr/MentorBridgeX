import { useState, useEffect } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { Back, Btn } from "../../components/ui.jsx";
import api from "../../api/index.js";

export function S31({ onNav }) {
  const { state } = useStore();
  const user = state.session?.user;
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.settings.get().then((p) => { setProfile(p); setName(p.display_name || ""); }).catch(() => {});
    api.stats.get().then(setStats).catch(() => {});
  }, []);

  const save = async () => {
    try {
      const p = await api.settings.patch({ display_name: name });
      setProfile(p);
      setMsg("저장되었습니다.");
    } catch (e) {
      setMsg(e.message);
    }
  };

  const display = profile?.display_name || user?.name || "학생";
  const email = profile?.email || user?.email || "";

  return (
    <div className="content">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Back onClick={() => onNav("S30")} label="설정" />
        <div style={{ fontSize: 20, fontWeight: 700 }}>계정 정보</div>
      </div>
      <div className="card card-p" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, paddingBottom: 20, marginBottom: 20, borderBottom: `1px solid ${TDS.borderDefault}` }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: TDS.blue500, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 28, fontWeight: 700 }}>{(display || "?")[0]}</div>
          <div style={{ flex: 1 }}>
            <input className="inp" value={name} onChange={(e) => setName(e.target.value)} style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }} />
            <div style={{ fontSize: 13, color: TDS.textTertiary }}>{email}</div>
          </div>
          <Btn v="primary" s="sm" onClick={save}>저장</Btn>
        </div>
        {msg && <div style={{ fontSize: 13, color: TDS.blue500, marginBottom: 8 }}>{msg}</div>}
        {[
          ["역할", user?.role || "student"],
          ["OAuth 제공자", user?.provider || "—"],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${TDS.bgTertiary}`, fontSize: 14 }}>
            <span style={{ color: TDS.textTertiary }}>{k}</span>
            <span style={{ color: TDS.textPrimary, fontWeight: 500 }}>{v}</span>
          </div>
        ))}
      </div>
      <div className="card card-p">
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>활동 통계</div>
        {[
          ["총 노드", `${stats?.node_count ?? "—"}개`],
          ["총 엣지", `${stats?.edge_count ?? "—"}개`],
          ["음성 녹음", `${stats?.voice_count ?? "—"}회`],
          ["생성한 양식", `${stats?.form_count ?? "—"}개`],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${TDS.bgTertiary}`, fontSize: 13 }}>
            <span style={{ color: TDS.textTertiary }}>{k}</span>
            <span style={{ fontWeight: 600, color: TDS.textPrimary }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
