/**
 * S03 — 가입 직후 온보딩.
 *
 * 화면 하나가 STEP 0~5 를 전부 들고 있다. 단계마다 화면 ID 를 새로 파면 주소가
 * 여섯 개로 늘고, 중간 주소로 직접 들어온 사람이 앞 단계를 건너뛴 상태가 된다.
 * 여기서는 **서버가 기억하는 step** 하나가 어디까지 왔는지를 정한다.
 *
 * 설계 원칙 세 가지가 그대로 코드에 있다.
 *  1. 모른다고 답할 수 있다 — STEP 3 "아직 모르겠어요", STEP 4 건너뛰기.
 *  2. 뒤로 갈수록 가벼워진다 — 앞은 한 번 누르면 넘어가고, 마지막은 선택이다.
 *  3. 마지막에 결과를 보여준다 — STEP 5 에서 실제 글 3건.
 */

import { useCallback, useEffect, useState } from "react";
import { useStore } from "../../store/StoreProvider.jsx";
import api from "../../api/index.js";
import { useLoading } from "../../components/LoadingDock.jsx";
import { useOnboarding } from "../../hooks/useOnboarding.js";
import { homeForStudent } from "../../lib/onboardingData.js";
import { Shell } from "../../components/onboarding/Shell.jsx";
import { RoleStep } from "../../components/onboarding/RoleStep.jsx";
import {
  FieldStep,
  GradeStep,
  KeywordStep,
  MajorStep,
  PreviewStep,
} from "../../components/onboarding/StudentSteps.jsx";
import { MentorFieldStep, MentorProfileStep } from "../../components/onboarding/MentorSteps.jsx";
import { ClassroomStep, TeacherProfileStep } from "../../components/onboarding/TeacherSteps.jsx";
import mbxLogo from "../../assets/brand/mbx_logo.png";

const STUDENT_STEPS = 5;
const SHORT_STEPS = 2; // 멘토 · 교사

export function S03({ onNav }) {
  const { state, actions } = useStore();
  const { data, tracks, loading, saving, error, patch, setKeywords, complete } = useOnboarding();

  const [step, setStep] = useState(null);
  const [majors, setMajors] = useState([]);
  const [group, setGroup] = useState("");
  const [preset, setPreset] = useState([]);
  const [manual, setManual] = useState([]);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [classrooms, setClassrooms] = useState([]);

  const role = data?.role || null;
  const name = state.session?.user?.name || "";

  // 서버가 기억하는 지점에서 이어간다 (이탈 복구)
  useEffect(() => {
    if (!data || step !== null) return;
    setStep(data.completed ? 0 : data.step || 0);
    setMajors(data.majors || []);
    setGroup(data.track_group || "");
    setClassrooms(data.classrooms || []);
  }, [data, step]);

  const go = useCallback(
    async (next, part) => {
      try {
        await patch({ ...(part || {}), step: next });
        setStep(next);
      } catch {
        /* 저장이 실패하면 단계를 넘기지 않는다 — 화면만 앞서 가면 안 된다 */
      }
    },
    [patch]
  );

  // STEP 5 에 들어설 때 실제로 받게 될 글을 가져온다
  useEffect(() => {
    if (role !== "student" || step !== 5 || preview || previewing) return;
    setPreviewing(true);
    api.onboarding
      .preview()
      .then(setPreview)
      .catch(() => setPreview({ items: [], matched: false, keywords: [] }))
      .finally(() => setPreviewing(false));
  }, [role, step, preview, previewing]);

  const finish = useCallback(async () => {
    try {
      const done = await complete();
      actions.updateSessionUser({ role: done.role, grade: done.grade, onboarded: true });
      if (done.role === "teacher") onNav("T03");
      // 멘토 전용 대시보드는 아직 없다. 가장 가까운 화면인 멘토링으로 보낸다.
      else if (done.role === "mentor") onNav("S24");
      else onNav(homeForStudent(done.grade));
    } catch {
      /* 오류 문구는 화면 안에 이미 떠 있다 */
    }
  }, [complete, actions, onNav]);

  const createRoom = useCallback(
    async (roomName) => {
      const room = await api.classrooms.create(roomName, data?.school || "");
      setClassrooms((c) => [...c, room]);
    },
    [data]
  );

  const joinRoom = useCallback(async (code) => {
    const room = await api.classrooms.join(code);
    setClassrooms((c) => (c.some((x) => x.id === room.id) ? c : [...c, room]));
  }, []);

  const toggleKeyword = useCallback((terms, on) => {
    setPreset((cur) =>
      on ? [...new Set([...cur, ...terms])] : cur.filter((t) => !terms.includes(t))
    );
  }, []);

  const total = role === "student" ? STUDENT_STEPS : role ? SHORT_STEPS : 0;
  useLoading(loading || step === null, "온보딩을 준비하는 중이에요…");

  const errorLine = error ? (
    <p className="ob-warn" role="alert">
      {error}
    </p>
  ) : null;

  if (loading || step === null) return <div className="ob-wrap" />;

  /* ── STEP 0 역할 ─────────────────────────────────────── */
  if (step === 0) {
    return (
      <Shell
        total={0}
        /* 인사 한 줄을 앞에 둔다. 로그인하자마자 나오는 첫 화면인데 곧바로
           질문부터 들이밀면 서류처럼 읽힌다. 손 흔드는 이모지는 인사에 붙는
           것이라 자리를 벌지 않는다 — 온보딩에서 이모지는 여기와 마지막
           「준비됐어요! 🎉」 둘뿐이다. */
        title={
          <>
            안녕하세요 <span className="ob-title-emoji ob-wave" aria-hidden="true">👋</span>
            <br />
            <img className="ob-title-logo" src={mbxLogo} alt="" aria-hidden="true" />
            <span className="ob-title-mbx">MBX</span>에 어떤 목적으로 오셨나요?
          </>
        }
        /* 제목 바로 아래로. 카드 밑 가운데에 있을 때는 다 고르고 나서야
           눈에 들어와서, 정작 망설이는 순간에는 읽히지 않았다. */
        sub="나중에 언제든 바꿀 수 있으니 지금은 편하게 선택해도 괜찮아요!"
      >
        {errorLine}
        <RoleStep value={role} busy={saving} onPick={(r) => go(1, { role: r })} />
      </Shell>
    );
  }

  /* ── 멘토 ────────────────────────────────────────────── */
  if (role === "mentor") {
    if (step === 1) {
      return (
        <Shell
          total={total}
          current={1}
          title="어떤 분야를 "
          accent="전공하셨나요?"
          sub="후배들이 물어볼 수 있는 분야를 알려주세요"
          onBack={() => setStep(0)}
          footer={
            <button
              type="button"
              className="btn btn-primary btn-md"
              onClick={() => go(2)}
              disabled={saving || !data?.mentor_track_id}
            >
              다음
            </button>
          }
        >
          {errorLine}
          <MentorProfileStep
            tracks={tracks}
            trackId={data?.mentor_track_id}
            affiliation={data?.mentor_affiliation}
            status={data?.mentor_status}
            busy={saving}
            onChange={(part) => patch(part).catch(() => {})}
          />
        </Shell>
      );
    }
    return (
      <Shell
        total={total}
        current={2}
        title="어떤 주제로 "
        accent="도움을 줄 수 있나요?"
        sub="학생들이 쓰는 것과 같은 분류예요"
        onBack={() => setStep(1)}
        footer={
          <button
            type="button"
            className="btn btn-primary btn-md"
            onClick={finish}
            disabled={saving || majors.length === 0}
          >
            시작하기
          </button>
        }
      >
        {errorLine}
        <MentorFieldStep
          tracks={tracks}
          value={majors}
          busy={saving}
          onChange={(next) => {
            setMajors(next);
            patch({ majors: next }).catch(() => {});
          }}
        />
      </Shell>
    );
  }

  /* ── 교사 ────────────────────────────────────────────── */
  if (role === "teacher") {
    if (step === 1) {
      return (
        <Shell
          total={total}
          current={1}
          title="어느 학교에서 "
          accent="가르치시나요?"
          onBack={() => setStep(0)}
          footer={
            <button
              type="button"
              className="btn btn-primary btn-md"
              onClick={() => go(2)}
              disabled={saving || !data?.school || !data?.subject}
            >
              다음
            </button>
          }
        >
          {errorLine}
          <TeacherProfileStep
            school={data?.school}
            subject={data?.subject}
            grades={data?.teacher_grades}
            busy={saving}
            onChange={(part) => patch(part).catch(() => {})}
          />
        </Shell>
      );
    }
    return (
      <Shell
        total={total}
        current={2}
        title="학생들과 어떻게 "
        accent="연결할까요?"
        sub="지금 만들지 않아도 됩니다. 설정에서 언제든 만들 수 있어요."
        onBack={() => setStep(1)}
        footer={
          <button type="button" className="btn btn-primary btn-md" onClick={finish} disabled={saving}>
            시작하기
          </button>
        }
      >
        {errorLine}
        <ClassroomStep
          classrooms={classrooms}
          busy={saving}
          onCreate={createRoom}
          onJoin={joinRoom}
        />
      </Shell>
    );
  }

  /* ── 학생 STEP 1 학년 ────────────────────────────────── */
  if (step === 1) {
    return (
      <Shell total={total} current={1} title="몇 학년인가요?" onBack={() => setStep(0)}>
        {errorLine}
        <GradeStep value={data?.grade} busy={saving} onPick={(g) => go(2, { grade: g })} />
      </Shell>
    );
  }

  /* ── 학생 STEP 2 계열 ────────────────────────────────── */
  if (step === 2) {
    return (
      <Shell
        total={total}
        current={2}
        title="어떤 분야에 "
        accent="관심이 있나요?"
        onBack={() => setStep(1)}
        footer={
          <button
            type="button"
            className="btn btn-primary btn-md"
            onClick={() => go(3, { track_group: group })}
            disabled={saving || !group}
          >
            다음
          </button>
        }
      >
        {errorLine}
        <FieldStep tracks={tracks} value={group} busy={saving} onChange={setGroup} />
      </Shell>
    );
  }

  /* ── 학생 STEP 3 학과 ────────────────────────────────── */
  if (step === 3) {
    return (
      <Shell
        total={total}
        current={3}
        title="조금 더 "
        accent="좁혀볼까요?"
        sub="나중에 언제든 바꿀 수 있어요"
        onBack={() => setStep(2)}
        footer={
          <button
            type="button"
            className="btn btn-primary btn-md"
            onClick={() => go(4, { majors })}
            /* 목록에 없어서 직접 적은 것만 있어도 넘어갈 수 있다 — 그 사람도
               자기 관심사를 말한 것이다. */
            disabled={saving || (majors.length === 0 && manual.length === 0)}
          >
            다음
          </button>
        }
      >
        {errorLine}
        <MajorStep
          tracks={tracks}
          trackGroup={group}
          value={majors}
          busy={saving}
          onChange={setMajors}
          onUnsure={() => {
            // 계열 전체로 넓게 잡고 세부 관심은 건너뛴다 — 모른다고 답한 사람에게
            // 바로 다음 화면에서 또 고르라고 하면 같은 질문을 두 번 하는 셈이다.
            setMajors([]);
            go(5, { majors: [] });
          }}
          extra={manual}
          /* 적는 즉시 서버에 남긴다. 다음 단계를 건너뛰어도 사라지지 않아야
             한다 — 목록에 없어서 적은 것이 제일 아까운 값이다. manual 은
             더하기만 하므로(on_conflict_do_nothing) 기존 것을 지우지 않고,
             preset 은 서버가 학과 핵심 키워드로 다시 채운다. */
          onAddExtra={(name, remove) => {
            if (remove) { setManual(manual.filter((x) => x !== name)); return; }
            setManual([...manual, name]);
            setKeywords([], [name]).catch(() => {});
          }}
        />
      </Shell>
    );
  }

  /* ── 학생 STEP 4 세부 관심 ───────────────────────────── */
  if (step === 4) {
    return (
      <Shell
        total={total}
        current={4}
        title="마지막이에요! "
        accent="관심 있는 걸 골라주세요"
        sub="고르지 않아도 괜찮아요"
        onBack={() => setStep(3)}
        footer={
          <>
            <button type="button" className="ob-skip" onClick={() => go(5)} disabled={saving}>
              건너뛰기
            </button>
            <button
              type="button"
              className="btn btn-primary btn-md"
              onClick={async () => {
                try {
                  await setKeywords(preset, manual);
                  await go(5);
                } catch {
                  /* 저장 실패 — 단계를 넘기지 않는다 */
                }
              }}
              disabled={saving}
            >
              다음
            </button>
          </>
        }
      >
        {errorLine}
        <KeywordStep
          tracks={tracks}
          majors={majors}
          selected={preset}
          onToggle={toggleKeyword}
          manual={manual}
          onManual={setManual}
          busy={saving}
        />
      </Shell>
    );
  }

  /* ── 학생 STEP 5 미리보기 ────────────────────────────── */
  return (
    <Shell
      total={total}
      current={5}
      title="준비됐어요!"
      emoji="🎉"
      sub={`${name ? `${name}님을 위해 ` : ""}매일 이런 글들을 모아드릴게요`}
      onBack={() => setStep(majors.length ? 4 : 3)}
      footer={
        <button type="button" className="btn btn-primary btn-md" onClick={finish} disabled={saving}>
          시작하기
        </button>
      }
      note={
        <button type="button" className="ob-restart" onClick={() => setStep(2)}>
          설정 다시 하기
        </button>
      }
    >
      {errorLine}
      <PreviewStep
        preview={preview}
        loading={previewing || !preview}
        keywords={preview?.keywords || []}
      />
    </Shell>
  );
}
