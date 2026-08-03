/**
 * S04 — 예전 '관심 키워드 시드' 화면.
 *
 * 이 단계는 온보딩(S03) 안으로 들어갔다(STEP 4 세부 관심). 화면을 지우지 않고
 * 되돌려 보내는 이유: 예전 주소(/S04)를 눌러 들어오는 사람이 아직 있고, 빈
 * 화면보다는 온보딩 제자리로 보내 주는 편이 낫다.
 */

import { useEffect } from "react";

export function S04({ onNav }) {
  useEffect(() => {
    onNav("S03", { replace: true });
  }, [onNav]);

  return (
    <div className="ob-wrap">
      <div className="ob-card ob-card-loading">관심 설정으로 이동 중…</div>
    </div>
  );
}
