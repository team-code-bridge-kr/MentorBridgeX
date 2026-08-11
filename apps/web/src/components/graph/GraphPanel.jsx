/**
 * 그래프 화면 옆 패널의 껍데기.
 *
 * **패널은 한 자리뿐이다.** 예전에는 만들기·빈 곳·관계·상세가 저마다 같은 인라인
 * 스타일을 복사해 두고 서로 배타적이라는 것을 관례로만 지켰다. 그래서 어떤 순서로
 * 누르면 둘이 나란히 서서 720px 를 먹고 캔버스가 사라졌다. 이제 자리는 하나이고,
 * 무엇을 세울지는 S06 의 `panel` 한 값이 정한다.
 *
 * **아래에서 올라오는 시트다.** 오른쪽에 세로로 서 있을 때는 캔버스 폭을
 * 330~430px 씩 먹어서 그래프가 눌렸고, 출처 문장처럼 긴 글은 좁은 칸에서
 * 열 줄씩 흘렀다. 아래에 가로로 누우면 그래프는 폭을 그대로 쓰고, 글은
 * 넓게 읽힌다. 구획(출처·연결·다음 탐구·코멘트)은 폭이 남는 만큼 옆으로
 * 늘어선다(`.gpanel-body` 의 격자).
 */
import { NavIcon } from "../NavIcon.jsx";
import TDS from "../../theme/tokens.js";

/**
 * 경로표시는 여기 없다. 캔버스 좌상단(범례 아래)에 늘 서 있어서, 판을 닫아도
 * 지금 어느 층인지 볼 수 있다 — 한때 이 판 머리에 두었는데 판을 닫는 순간
 * 길이 사라졌다.
 */
export function GraphPanel({ title, onClose, height, children }) {
  return (
    // `height` 가 없으면 CSS 의 기본 높이(clamp)를 쓴다. 손으로 끈 뒤에만 px 로 굳는다.
    <aside className="gpanel" style={height ? { height } : undefined}>
      <div className="gpanel-head">
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
