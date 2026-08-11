/**
 * S30 — 설정
 *
 * 다른 화면들과 같은 유리 표면(.act-glass)을 쓴다. 여기만 흰 카드에 인라인
 * 스타일이라 다른 앱처럼 보였다.
 *
 * 손본 것:
 *
 * - **이름을 여기서 바로 고친다.** 「프로필 편집」이 데려가던 화면(S31)은
 *   이 화면과 똑같은 넉 줄(이름·이메일·역할·제공자)을 다시 보여주고 이름만
 *   고칠 수 있었다. 한 칸 고치자고 화면을 옮길 이유가 없다.
 * - **빠른 이동 격자를 걷었다.** 통계·알림은 사이드바 아래에 있고 보고서는
 *   메뉴에 있다 — 같은 곳으로 가는 길이 둘이면 어느 쪽이 진짜인지 모른다.
 *   여기서만 갈 수 있던 「관심 주제 다시 고르기」만 제 줄로 남긴다.
 *   덤으로 이모지 아이콘(📊💬🔔)도 함께 사라졌다.
 * - **끌 수 없는 알림 스위치를 걷었다.** 「주간 리포트(이메일)」와 「푸시
 *   알림」은 켜도 꺼도 아무 일이 없었다 — 메일을 보내는 곳도, 브라우저 푸시를
 *   받는 곳도 서버에 없다. 남은 둘은 진짜로 서버가 읽는다(_push_notification).
 * - **역할을 우리말로.** 화면에 `student` 라고 적혀 있었다.
 * - **"S32에서 진행할 수 있습니다"** — 학생에게 화면 번호를 말하지 않는다.
 */

import { useState, useEffect } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import { Av, Btn, Notice } from "../../components/ui.jsx";
import api from "../../api/index.js";
import { ClassroomJoinCard } from "../../components/onboarding/ClassroomJoinCard.jsx";

const TABS = ["계정", "알림", "개인정보"];

/** 화면에 나가는 말. `student` 는 우리 코드의 낱말이지 학생의 낱말이 아니다. */
const ROLE_LABEL = { student: "학생", teacher: "교사", mentor: "멘토", admin: "관리자" };
const PROVIDER_LABEL = { google: "구글 계정", dev: "개발용 로그인" };

/**
 * 알림 스위치. 서버가 실제로 읽는 것만 세운다.
 * 끌 수 없는(=보낼 곳이 없는) 알림을 스위치로 세우면, 꺼 놓고도 계속 오는
 * 것처럼 보이거나 반대로 켜 놓고 기다리게 된다.
 */
const NOTIF_SWITCHES = [
  { k: "comment", label: "코멘트 알림", desc: "선생님이 코멘트를 남겼을 때" },
  { k: "activity", label: "활동 알림", desc: "그래프에 새 키워드가 들어왔을 때" },
];

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

export function S30({ onNav }) {
  const { state, actions } = useStore();
  const user = state.session?.user;
  const [profile, setProfile] = useState(null);
  const [notifs, setNotifs] = useState({ comment: true, activity: true });
  const [tab, setTab] = useState("계정");
  const [msg, setMsg] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.settings.get()
      .then((p) => {
        setProfile(p);
        setName(p.display_name || "");
        if (p.prefs) setNotifs((prev) => ({ ...prev, ...p.prefs }));
      })
      .catch(() => {});
  }, []);

  const toggle = async (k) => {
    const next = { ...notifs, [k]: !notifs[k] };
    setNotifs(next);
    try {
      await api.settings.patch({ prefs: next });
    } catch (e) {
      setNotifs(notifs);   // 되돌린다 — 화면에서만 바뀌면 껐다고 믿게 된다
      setMsg(e.message || "저장하지 못했습니다.");
    }
  };

  const isStudent = !user?.role || user.role === "student";
  const displayName = profile?.display_name || user?.name || "학생";
  const email = profile?.email || user?.email || "";
  const dirty = name.trim() && name.trim() !== displayName;

  const saveName = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      const p = await api.settings.patch({ display_name: name.trim() });
      setProfile(p);
      // 사이드바·인사말이 모두 세션의 이름을 쓴다(updateUser 주석).
      actions.updateUser({ name: p.display_name });
      setMsg("이름을 바꿨습니다.");
    } catch (e) {
      setMsg(e.message || "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="content act-wrap">
      <div className="act-page">
        <header className="act-head">
          <h1 className="act-title">설정</h1>
        </header>

        <div className="set-prof act-glass">
          <Av name={displayName} src={user?.picture} size="lg" />
          <div className="set-prof-meta">
            <div className="set-prof-name">{displayName}</div>
            <div className="set-prof-mail">{email}</div>
          </div>
          {/* "활성" 배지를 뺐다 — 늘 켜져 있는 값이라 아무것도 알려주지 않았다.
              대신 언제부터 쓰고 있는지를 적는다. */}
          <div className="set-prof-tags">
            <span className="set-tag">{ROLE_LABEL[user?.role] || "학생"}</span>
            {profile?.created_at && (
              <span className="set-tag is-quiet">{fmtDate(profile.created_at)} 가입</span>
            )}
          </div>
        </div>

        <div className="act-filters" role="tablist" aria-label="설정">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`act-filter act-glass${tab === t ? " is-on" : ""}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {msg && <Notice type="info">{msg}</Notice>}

        {tab === "계정" && (
          <>
            <section className="set-card act-glass">
              <h2 className="set-card-title">기본 정보</h2>
              <div className="set-row is-edit">
                <label className="set-k" htmlFor="set-name">이름</label>
                <input
                  id="set-name"
                  className="inp set-name-inp"
                  value={name}
                  maxLength={50}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveName(); }}
                />
                <Btn v="primary" s="sm" onClick={saveName} disabled={!dirty || saving}>
                  {saving ? "저장 중…" : "저장"}
                </Btn>
              </div>
              <div className="set-row">
                <span className="set-k">이메일</span>
                <span className="set-v">{email}</span>
              </div>
              <div className="set-row">
                <span className="set-k">역할</span>
                <span className="set-v">{ROLE_LABEL[user?.role] || "학생"}</span>
              </div>
              <div className="set-row">
                <span className="set-k">로그인 방법</span>
                <span className="set-v">{PROVIDER_LABEL[user?.provider] || user?.provider || "—"}</span>
              </div>
            </section>

            <ClassroomJoinCard className="set-card act-glass" />

            {/* 관심 주제는 학생의 것이다. 교사에게는 탐구 피드가 없고, 저 단추가
                데려가는 곳은 역할부터 다시 고르는 온보딩이라 잘못 누르면
                자기 역할이 바뀐다. */}
            {isStudent && (
            <section className="set-card act-glass">
              <h2 className="set-card-title">관심 주제</h2>
              <div className="set-row is-act">
                <div>
                  <div className="set-k">관심 주제 다시 고르기</div>
                  <div className="set-sub">고른 주제로 탐구 피드에 올라오는 기사와 논문이 정해집니다.</div>
                </div>
                <Btn v="secondary" s="sm" onClick={() => onNav("S03")}>다시 고르기</Btn>
              </div>
            </section>
            )}
          </>
        )}

        {tab === "알림" && (
          <section className="set-card act-glass">
            <h2 className="set-card-title">알림</h2>
            {NOTIF_SWITCHES.map((n) => (
              <div key={n.k} className="set-row is-act">
                <div>
                  <div className="set-k">{n.label}</div>
                  <div className="set-sub">{n.desc}</div>
                </div>
                {/* div 가 아니라 단추다. 예전 것은 마우스로만 눌렸고 화면
                    읽기 프로그램에는 켜짐/꺼짐이 전해지지 않았다. */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!notifs[n.k]}
                  aria-label={n.label}
                  className={`set-sw${notifs[n.k] ? " is-on" : ""}`}
                  onClick={() => toggle(n.k)}
                >
                  <span className="set-sw-knob" />
                </button>
              </div>
            ))}
            {/* 무엇을 안 하는지 적는다. 알림을 켜 놓고 메일함을 기다리는 일이
                없어야 한다. */}
            <p className="set-note">앱 안에서만 알려드립니다. 메일이나 브라우저 알림은 보내지 않습니다.</p>
          </section>
        )}

        {tab === "개인정보" && (
          <>
            <section className="set-card act-glass">
              <h2 className="set-card-title">로그인</h2>
              <p className="set-note">
                구글 계정으로 로그인합니다. MBX 는 비밀번호를 받지도, 저장하지도 않습니다.
              </p>
            </section>

            <section className="set-card act-glass">
              <h2 className="set-card-title">계정 삭제</h2>
              <div className="set-row is-act">
                <div>
                  <div className="set-k">계정과 모든 기록을 지웁니다</div>
                  <div className="set-sub">
                    생기부·그래프·녹음·보고서가 함께 사라집니다. 되돌릴 수 없습니다.
                  </div>
                </div>
                <Btn v="danger" s="sm" onClick={() => onNav("S32")}>계정 삭제</Btn>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
