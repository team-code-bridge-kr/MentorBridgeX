/**
 * 그래프 화면 옆 패널의 껍데기.
 *
 * **패널은 한 자리뿐이다.** 예전에는 만들기·빈 곳·관계·상세가 저마다 같은 인라인
 * 스타일을 복사해 두고 서로 배타적이라는 것을 관례로만 지켰다. 그래서 어떤 순서로
 * 누르면 둘이 나란히 서서 720px 를 먹고 캔버스가 사라졌다. 이제 자리는 하나이고,
 * 무엇을 세울지는 S06 의 `panel` 한 값이 정한다.
 *
 * 생김새는 생기부 리더(`components/doc/PdfReader.jsx`)의 `.rd-panel` 을 그대로
 * 따른다 — 문서 **옆에** 붙고 절대 위에 띄우지 않는다. 좁은 화면에서는 아래로
 * 내려간다(`.gpanel` @media 900px).
 */
import { NavIcon } from "../NavIcon.jsx";
import TDS from "../../theme/tokens.js";

/**
 * @param onBack  있으면 머리에 뒤로 가기가 선다. 파고들어 온 층에서 한 겹
 *   나가는 길이다 — 닫기(✕)는 판만 닫고 층은 그대로 두므로, 두 일을 한
 *   단추로 겸할 수 없다. 여태 나가는 길은 위쪽 경로표시뿐이었는데, 판을 읽는
 *   동안 눈은 오른쪽에 있어서 거기까지 되짚어 올라가야 했다.
 * @param backLabel 어디로 나가는지. 이름 없이 갈매기만 두면 어디로 가는지 모른다.
 */
export function GraphPanel({ title, onClose, onBack, backLabel, children }) {
  return (
    <aside className="gpanel">
      <div className="gpanel-head">
        {onBack && (
          <button type="button" className="gpanel-back" onClick={onBack}
            title={`${backLabel || "위"}(으)로 나가기`}>
            <NavIcon name="chevronLeft" size={15} color={TDS.primary} />
            <span>{backLabel || "위로"}</span>
          </button>
        )}
        {/* 제목은 화면 읽기용으로만 남긴다. 판 안에 노드 이름이 크게 서 있어서
            그 위의 "노드" 는 아무것도 더 말해 주지 않았다. */}
        <span className="gpanel-title sr-only">{title}</span>
        <button type="button" className="gpanel-x" onClick={onClose} aria-label="닫기">
          <NavIcon name="close" size={14} color={TDS.textSecondary} />
        </button>
      </div>
      <div className="gpanel-body">{children}</div>
    </aside>
  );
}

/**
 * 패널 안의 접히는 구획.
 *
 * 탭이 아니라 디스클로저를 쓴다 — 탭은 **정보가 있다는 사실 자체를** 감춘다.
 * 접혀 있어도 제목이 남으므로 무엇이 있는지는 알 수 있다. 폐지한 노드 상세
 * 화면(S07)의 4탭이 정확히 그 실패였다.
 *
 * 머리에 있던 개수는 걷었다. 펼치면 안에 "연결 1개" 가 또 적혀 있어서 같은
 * 숫자가 두 번 섰고, 접혀 있을 때 오른쪽 끝에 뜬 숫자 하나만으로는 그것이
 * 무엇을 센 것인지도 알 수 없었다.
 */
export function Section({ title, open, onToggle, children }) {
  return (
    <section className="gsec">
      <button
        type="button"
        className="gsec-hd"
        aria-expanded={open}
        onClick={onToggle}
      >
        <NavIcon
          name="chevronDown"
          size={14}
          color={TDS.textTertiary}
        />
        <span className="gsec-title">{title}</span>
      </button>
      {open && <div className="gsec-body">{children}</div>}
    </section>
  );
}
