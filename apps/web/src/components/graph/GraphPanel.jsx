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
import { GraphCrumb } from "./GraphCrumb.jsx";
import TDS from "../../theme/tokens.js";

/**
 * @param trail  뿌리 → 지금 층까지의 길. 주면 판 머리에 경로표시가 선다.
 *   판이 서 있는 동안 왼쪽 제 줄에서는 내린다 — 같은 길을 화면 양끝에 두
 *   번 그리면 어느 쪽이 진짜인지 알 수 없다(GraphCrumb 주석).
 *   나가는 길도 이것이 겸한다. 바로 앞 칸을 누르면 한 겹 위로 간다 —
 *   닫기(✕)는 판만 닫고 층은 그대로 두므로 두 일을 한 단추로 겸할 수 없다.
 * @param onCrumb 경로표시의 한 칸을 눌렀을 때. 그 층으로 간다.
 */
export function GraphPanel({ title, onClose, trail, onCrumb, width, children }) {
  return (
    // `width` 가 없으면 CSS 의 기본 폭(clamp)을 쓴다. 손으로 끈 뒤에만 px 로 굳는다.
    <aside className="gpanel" style={width ? { width } : undefined}>
      <div className="gpanel-head">
        {trail && <GraphCrumb trail={trail} onGo={onCrumb} className="gcrumb-in-panel" />}
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
 * 판 안의 한 구획.
 *
 * 접었다 펴는 방식을 그만두었다. 판에 서는 것은 넷뿐이고(출처·연결·다음
 * 탐구·코멘트) 저마다 짧다 — 접어서 아낄 자리보다, 무엇이 있는지 보려고
 * 네 번 누르는 품이 더 든다. 게다가 접힌 것은 **없는 것처럼** 읽혀서, 출처가
 * 일곱 문장 있는데도 학생이 그냥 지나치는 일이 생겼다.
 *
 * 판 폭을 끌어 넓힐 수 있게 된 뒤로 자리가 모자라 접을 이유도 줄었다.
 */
export function Section({ title, children }) {
  return (
    <section className="gsec">
      <h3 className="gsec-title">{title}</h3>
      <div className="gsec-body">{children}</div>
    </section>
  );
}
