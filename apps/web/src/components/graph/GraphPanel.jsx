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
 * 경로표시는 여기 없다. 캔버스 좌상단(범례 아래)에 늘 서 있어서, 판을 닫아도
 * 지금 어느 층인지 볼 수 있다 — 한때 이 판 머리에 두었는데 판을 닫는 순간
 * 길이 사라졌다.
 */
/**
 * `tight` — 판 안의 내용이 **스스로 ✕ 자리를 비켜 줄 때** 켠다.
 *
 * 닫기 ✕ 는 흐름 밖(오른쪽 위 못박음)이라, 기본값은 그만큼 위를 비워 둔다.
 * 그런데 노드 상세는 맨 위가 이름 한 줄이라 그 줄 오른쪽 끝에 ✕ 가 나란히
 * 서면 된다 — 비워 두면 아무것도 없는 띠가 한 줄 생긴다. 만들기·확장하기는
 * 맨 위부터 입력칸이 꽉 차서 비켜 줄 데가 없으므로 기본값을 쓴다.
 */
export function GraphPanel({ title, onClose, width, tight, children }) {
  return (
    // `width` 가 없으면 CSS 의 기본 폭(clamp)을 쓴다. 손으로 끈 뒤에만 px 로 굳는다.
    <aside className="gpanel" style={width ? { width } : undefined}>
      <div className="gpanel-head">
        {/* 제목은 화면 읽기용으로만 남긴다. 판 안에 노드 이름이 크게 서 있어서
            그 위의 "노드" 는 아무것도 더 말해 주지 않았다. */}
        <span className="gpanel-title sr-only">{title}</span>
        <button type="button" className="gpanel-x" onClick={onClose} aria-label="닫기">
          <NavIcon name="close" size={14} color={TDS.textSecondary} />
        </button>
      </div>
      <div className={`gpanel-body${tight ? " is-tight" : ""}`}>{children}</div>
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
