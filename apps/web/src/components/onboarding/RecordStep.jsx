/**
 * 학생 온보딩 STEP 5 — 생기부 올리기 권유.
 *
 * **여기서 올리지는 않는다.** 파싱은 이 앱에서 가장 오래 걸리는 일이고(표본
 * 19쪽에 56초) 끝나면 결과를 확인하는 화면이 따로 있다. 그걸 온보딩 안에
 * 밀어 넣으면 마지막 단계에서 1분을 기다리게 되고, 창을 닫으면 어디까지
 * 됐는지도 알 수 없다. 그래서 여기서는 **무엇이 좋아지는지**와 **어떻게
 * 지켜지는지**만 말하고, 올리는 일은 원래 있던 업로드 화면에 맡긴다.
 *
 * 건너뛰는 길이 먼저다. 가입 직후에 생기부 PDF 를 손에 들고 있는 학생은
 * 드물다 — 지금 못 올린다고 온보딩이 막히면 안 된다.
 *
 * 개인정보 약속(본인만 열람 · 최신본 한 개 · 인적사항 가림)은 업로드 화면과
 * **같은 말**로 적는다. 두 곳이 다른 말을 하면 어느 쪽이 진짜인지 알 수 없다.
 * 보관 정책이 바뀌면 여기와 S13 을 반드시 함께 고칠 것.
 */

import { NavIcon } from "../NavIcon.jsx";

const GOOD = [
  { icon: "graph", text: "생기부에 적힌 과목·활동이 지식 그래프로 이어집니다." },
  { icon: "form", text: "보고서를 쓸 때 생기부 문장을 근거로 붙여 줍니다." },
  { icon: "bookOpen", text: "책처럼 넘겨 보는 뷰어에서 원본을 다시 볼 수 있습니다." },
];

const SAFE = [
  "본인만 열람할 수 있게 보관합니다.",
  "최신본 한 개만 남고, 언제든 원본만 지울 수 있습니다.",
  "맨 아래 인적사항 칸은 그림 자체를 칠해 가립니다.",
];

export function RecordStep() {
  return (
    <>
      <ul className="ob-good">
        {GOOD.map((g) => (
          <li key={g.text}>
            <span className="ob-good-ic" aria-hidden="true">
              <NavIcon name={g.icon} size={18} color="currentColor" />
            </span>
            <span>{g.text}</span>
          </li>
        ))}
      </ul>

      {/* 학생이 망설이는 지점은 "쓸모"가 아니라 "내 정보가 어디로 가나"다.
          그 답을 묻기 전에 먼저 적는다. */}
      <div className="ob-safe">
        <div className="ob-safe-title">
          <NavIcon name="lock" size={15} color="currentColor" />
          생기부는 이렇게 지켜집니다
        </div>
        <ul>
          {SAFE.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
    </>
  );
}
