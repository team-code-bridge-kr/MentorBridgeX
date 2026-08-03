import { useState, useEffect } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import TDS from "../../theme/tokens.js";
import { TFI, Btn, Notice } from "../../components/ui.jsx";
import api from "../../api/index.js";
import { ClassroomJoinCard } from "../../components/onboarding/ClassroomJoinCard.jsx";

export function S30({ onNav }) {
  const { state } = useStore();
  const user = state.session?.user;
  const [profile, setProfile] = useState(null);
  const [notifs, setNotifs] = useState({ comment: true, system: true, weekly: false, push: true });
  const [activeTab, setActiveTab] = useState("계정");
  const [msg, setMsg] = useState("");
  const tabs = ["계정", "알림", "보안", "데이터"];

  useEffect(() => {
    api.settings.get()
      .then((p) => {
        setProfile(p);
        if (p.prefs) setNotifs((prev) => ({ ...prev, ...p.prefs }));
      })
      .catch(() => {});
  }, []);

  const toggle = async (k) => {
    const next = { ...notifs, [k]: !notifs[k] };
    setNotifs(next);
    try {
      await api.settings.patch({ prefs: next });
      setMsg("알림 설정이 저장되었습니다.");
    } catch (e) {
      setMsg(e.message);
    }
  };

  const Toggle = ({ on, onClick }) => (
    <div onClick={onClick} style={{ width: 44, height: 26, borderRadius: 13, background: on ? TDS.blue500 : TDS.bgTertiary, position: "relative", cursor: "pointer", flexShrink: 0 }}>
      <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: on ? 21 : 3, boxShadow: "0 1px 4px rgba(0,0,0,.2)" }} />
    </div>
  );

  const name = profile?.display_name || user?.name || "학생";
  const email = profile?.email || user?.email || "";
  const initial = (name || "?")[0];

  return (
    <div className="content">
        <div className="card card-p" style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: TDS.blue500, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 30, fontWeight: 700, flexShrink: 0 }}>{initial}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: TDS.textPrimary }}>{name}</div>
            <div style={{ fontSize: 14, color: TDS.textTertiary, marginTop: 2 }}>{email}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <div style={{ padding: "3px 10px", borderRadius: 20, background: TDS.blue50, color: TDS.blue500, fontSize: 11, fontWeight: 600 }}>{user?.role || "student"}</div>
              <div style={{ padding: "3px 10px", borderRadius: 20, background: TDS.successBg, color: TDS.success, fontSize: 11, fontWeight: 600 }}>활성</div>
            </div>
          </div>
          <Btn v="secondary" s="sm" onClick={() => onNav("S31")}>프로필 편집</Btn>
        </div>

        <div className="tab-pill-wrap" style={{ marginBottom: 20 }}>
          {tabs.map((t) => <div key={t} className={`tab-pill${activeTab === t ? " active" : ""}`} onClick={() => setActiveTab(t)}>{t}</div>)}
        </div>
        {msg && <Notice type="info" style={{ marginBottom: 12 }}>{msg}</Notice>}

        {activeTab === "계정" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="card card-p">
              <div style={{ fontSize: 14, fontWeight: 700, color: TDS.textPrimary, marginBottom: 16 }}>기본 정보</div>
              {[
                ["이름", name], ["이메일", email],
                ["역할", user?.role || "student"],
                ["OAuth 제공자", user?.provider || "—"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: `1px solid ${TDS.bgTertiary}` }}>
                  <span style={{ fontSize: 14, color: TDS.textTertiary, minWidth: 120 }}>{k}</span>
                  <span style={{ fontSize: 14, color: TDS.textPrimary, fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
            <ClassroomJoinCard />
            <div className="card card-p">
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>빠른 이동</div>
              <div className="grid2" style={{ gap: 8 }}>
                {[
                  { ic: "📊", t: "활동 통계", s: "S28" }, { ic: "💬", t: "코멘트 목록", s: "S24" },
                  { ic: "🔔", t: "알림 목록", s: "S25" }, { ic: "📝", t: "양식", s: "S20" },
                  { ic: "🎯", t: "관심 설정 다시 하기", s: "S03" },
                ].map((item) => (
                  <div key={item.t} onClick={() => onNav(item.s)} style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, background: TDS.bgSecondary, cursor: "pointer", border: `1px solid ${TDS.borderDefault}` }}>
                    <TFI s={18} color={TDS.textSecondary}>{item.ic}</TFI>
                    <span style={{ fontSize: 13, fontWeight: 600, color: TDS.textSecondary }}>{item.t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "알림" && (
          <div className="card card-p">
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>알림 설정</div>
            {[
              { k: "comment", label: "코멘트 알림", desc: "교사가 코멘트를 남겼을 때" },
              { k: "system", label: "시스템 공지", desc: "서비스 공지 및 점검 안내" },
              { k: "weekly", label: "주간 리포트", desc: "매주 월요일 활동 요약 이메일" },
              { k: "push", label: "푸시 알림", desc: "브라우저 푸시 알림 허용" },
            ].map((n) => (
              <div key={n.k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: `1px solid ${TDS.bgTertiary}` }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: TDS.textPrimary, marginBottom: 2 }}>{n.label}</div>
                  <div style={{ fontSize: 12, color: TDS.textTertiary }}>{n.desc}</div>
                </div>
                <Toggle on={!!notifs[n.k]} onClick={() => toggle(n.k)} />
              </div>
            ))}
          </div>
        )}

        {activeTab === "보안" && (
          <div className="card card-p">
            <Notice type="info">Google OAuth / 개발 로그인으로 인증합니다. MFA는 관리자 계정에만 적용됩니다.</Notice>
          </div>
        )}

        {activeTab === "데이터" && (
          <div className="card card-p">
            <Notice type="warning">계정 삭제 요청은 S32에서 진행할 수 있습니다. 그래프 데이터는 Neo4j에 보관됩니다.</Notice>
            <Btn v="danger" s="sm" style={{ marginTop: 12 }} onClick={() => onNav("S32")}>계정 삭제 요청</Btn>
          </div>
        )}
    </div>
  );
}
