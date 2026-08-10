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
        <span className="gpanel-title">{title}</span>
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
 * 접혀 있어도 제목과 개수는 보이므로, 학생은 "출처가 2문장 있는데 지금은 접어
 * 뒀다"를 알 수 있다. 폐지한 노드 상세 화면(S07)의 4탭이 정확히 그 실패였다.
 *
 * `count` 는 0 도 보여준다. "연결 0개"는 빈 값이 아니라 **읽어야 할 사실**이다.
 */
export function Section({ title, count, open, onToggle, children }) {
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
        {count != null && <span className="gsec-count">{count}</span>}
      </button>
      {open && <div className="gsec-body">{children}</div>}
    </section>
  );
}
