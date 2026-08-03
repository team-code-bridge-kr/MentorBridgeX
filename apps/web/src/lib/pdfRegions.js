/**
 * 생기부 PDF 구획 인식.
 *
 * 나이스 출력물은 표 기반 문서라 구획의 경계가 **영역명이 나타나는 y좌표**다.
 * 실제 표본(19쪽, A4 595×842)을 재서 아래 세 가지를 확인하고 그에 맞췄다.
 *
 * 1. **앵커는 두 계층이다.** 페이지 좌측의 대제목(x≈35: 수상경력, 창의적
 *    체험활동상황, 교과학습발달상황, 독서활동상황, 행동특성 및 종합의견)과
 *    표 안의 영역 라벨(x≈90~95: 자율활동·동아리활동·진로활동)이 따로 있다.
 *    한 열만 보면 둘 중 하나를 통째로 놓친다.
 * 2. **본문에도 같은 낱말이 나온다.** "봉사활동을", "봉사활동에서" 가 본문
 *    한가운데(x≈260~460)에 있다. x 범위로 거르지 않으면 구획이 엉킨다.
 * 3. **글자가 벌어져 인쇄된다.** "세 부 능 력 및 특 기 사 항" 처럼 자간이
 *    벌어진 줄이 있어, 공백을 지우고 비교해야 잡힌다.
 *
 * 좌표는 전부 **캔버스 좌표**(좌상단 원점)로 통일한다. PDF 원점은 좌하단이라
 * viewport.transform 을 반드시 거친다 — 빠뜨리면 박스가 위아래로 뒤집힌다.
 */

/** 구획으로 인정하는 이름. 공백을 지운 형태로 비교한다. */
export const ANCHOR_LABELS = [
  { key: "award", norm: "수상경력", label: "수상경력" },
  { key: "autonomous", norm: "자율활동", label: "자율활동" },
  { key: "club", norm: "동아리활동", label: "동아리활동" },
  { key: "volunteer", norm: "봉사활동", label: "봉사활동" },
  { key: "career", norm: "진로활동", label: "진로활동" },
  { key: "subject", norm: "세부능력및특기사항", label: "세부능력 및 특기사항" },
  { key: "reading", norm: "독서활동상황", label: "독서활동상황" },
  { key: "behavior", norm: "행동특성및종합의견", label: "행동특성 및 종합의견" },
];

// 앵커 후보로 볼 x 상한(페이지 폭 대비). 실측에서 라벨은 34~95px(=5.7~16%),
// 본문은 157px(=26%)부터 시작한다. 25% 면 둘을 가른다.
const LABEL_X_RATIO = 0.25;
// 라벨 줄은 짧다. 이보다 길면 본문에 낱말이 섞여 들어간 것으로 본다.
const LABEL_SLACK = 4;
// 하단 인적사항 영역(페이지 높이 대비). 실측: y=784, 824 두 줄에 학교명·출력일·
// 학년·반·번호·성명·IP·출력자명이 모두 들어 있다.
const FOOTER_RATIO = 0.92;

const norm = (s) => (s || "").replace(/\s+/g, "");

/**
 * 한 페이지의 텍스트를 줄 단위로 모은다.
 *
 * pdf.js 는 조각(item) 단위로 주는데, 자간이 벌어진 제목은 한 글자씩 쪼개져
 * 나온다. y 가 비슷한 조각을 한 줄로 묶어야 "세부능력및특기사항" 이 만들어진다.
 */
export function toLines(textContent, viewport, pdfjs) {
  const items = textContent.items
    .filter((it) => (it.str || "").trim())
    .map((it) => {
      const tx = pdfjs.Util.transform(viewport.transform, it.transform);
      const h = Math.hypot(tx[2], tx[3]) || it.height || 10;
      return {
        str: it.str,
        x: tx[4],
        // tx[5] 는 글자 기준선(baseline)이다. 박스 위쪽은 그만큼 올려야 한다.
        y: tx[5] - h,
        w: it.width * (viewport.scale || 1),
        h,
      };
    });

  const lines = [];
  for (const it of items.sort((a, b) => a.y - b.y || a.x - b.x)) {
    const last = lines[lines.length - 1];
    // 같은 줄 판정은 글자 높이의 절반 — 위첨자나 미세한 baseline 차이를 흡수한다
    if (last && Math.abs(it.y - last.y) <= last.h * 0.6) {
      last.str += it.str;
      last.x = Math.min(last.x, it.x);
      last.w = Math.max(last.x + last.w, it.x + it.w) - last.x;
      last.h = Math.max(last.h, it.h);
    } else {
      lines.push({ ...it });
    }
  }
  return lines;
}

/**
 * 표의 가로 괘선 y 좌표.
 *
 * **구획의 진짜 경계는 괘선이다.** 영역 라벨("자율활동")은 셀 안에서 세로
 * 가운데에 놓이기 때문에, 라벨의 y 를 구획 시작으로 쓰면 실제보다 한참 아래에서
 * 시작한다 (표본 2쪽: 라벨 y=609, 실제 행 시작 y=487 — 122pt 차이).
 * 본문 줄 간격으로 행을 가르려 해도 안 된다. 앞 행 끝과 다음 행 첫 줄이
 * 4pt 간격으로 붙어 있어 텍스트만으로는 경계가 보이지 않는다.
 *
 * 좌표 변환은 viewport.transform 만 적용한다. 표를 그리기 전에 cm(좌표계 변경)이
 * 끼면 어긋날 수 있어서, 결과가 비어 있으면 호출부가 라벨 y 로 되돌아간다.
 */
/* 구획 시작점의 한계 — 다음 사람이 같은 데를 두 번 파지 않도록 적어 둔다.
 *
 * 영역 라벨("자율활동")은 셀 안에서 **세로 가운데**에 놓인다. 그래서 라벨의 y 를
 * 구획 시작으로 쓰면 실제 행 시작보다 아래에서 시작한다.
 * 표본 2쪽 실측: 라벨 y=609 인데 그 행의 본문은 y=489 부터다 (120pt 차이).
 *
 * 시도해 보고 안 된 것:
 * - **본문 줄 간격으로 행 가르기**: 안 된다. 자율활동 마지막 줄(y=729)과
 *   동아리활동 첫 줄(y=743)의 간격이 행 안쪽 간격(4pt)과 같다. 텍스트만으로는
 *   두 행의 경계가 보이지 않는다.
 * - **가로 괘선으로 스냅**: 경계는 실제로 괘선에 있다(2쪽 y=487, 741 확인).
 *   다만 pdf.js 5 의 constructPath 인자는 [타입, [좌표], 경계상자]로 바뀌었고,
 *   경계상자는 그 경로가 그려질 때의 좌표계 기준이라 viewport.transform 만
 *   적용하면 어긋난다. 제대로 하려면 cm/q/Q 를 따라가며 CTM 을 추적해야 한다.
 *
 * 지금은 라벨 y 를 쓴다. 구획을 고르고 확대해 읽는 데는 지장이 없고, 시작점이
 * 행 중간이라는 점만 감안하면 된다. 정확히 맞추려면 위의 CTM 추적이 답이다.
 */

/** 한 페이지에서 앵커(구획 시작 줄)를 찾는다. */
export function findAnchors(lines, pageWidth) {
  const limit = pageWidth * LABEL_X_RATIO;
  const hits = [];
  for (const line of lines) {
    if (line.x > limit) continue; // 본문에 섞인 같은 낱말을 여기서 거른다
    const text = norm(line.str);
    for (const a of ANCHOR_LABELS) {
      if (text.includes(a.norm) && text.length <= a.norm.length + LABEL_SLACK) {
        hits.push({ ...a, y: line.y, x: line.x });
        break;
      }
    }
  }
  return hits.sort((a, b) => a.y - b.y);
}

/**
 * 페이지별 앵커를 논리 구획으로 만든다.
 *
 * 세특처럼 20,000자가 넘는 구획은 3~4쪽 연속이고, 쪽마다 제목이 다시 인쇄된다
 * (실측: "세부능력 및 특기사항" 이 16회). 쪽 단위로 자르면 한 구획이 16조각이
 * 나므로, **바로 앞 구획과 이름이 같고 페이지가 이어지면 하나로 합친다.**
 *
 * @param pages [{ index, height, anchors }]
 * @returns [{ key, label, pages: [{ index, yStart, yEnd }] }]
 */
export function buildRegions(pages) {
  const regions = [];
  for (const page of pages) {
    page.anchors.forEach((anchor, i) => {
      const next = page.anchors[i + 1];
      const slice = {
        index: page.index,
        yStart: Math.max(0, anchor.y - 4),
        yEnd: next ? next.y - 4 : page.height,
      };
      const prev = regions[regions.length - 1];
      const continues =
        prev &&
        prev.key === anchor.key &&
        i === 0 && // 페이지 첫 앵커일 때만 — 같은 쪽에 두 번 나오면 다른 구획이다
        prev.pages[prev.pages.length - 1].index === page.index - 1;
      if (continues) prev.pages.push(slice);
      else regions.push({ key: anchor.key, label: anchor.label, pages: [slice] });
    });
  }
  return regions;
}

/**
 * 하단 인적사항 마스크 영역.
 *
 * 스펙은 패턴으로 골라내라고 했지만, 실측해 보니 하단 두 줄이 **통째로**
 * 인적사항이다 — 학교명·출력일·학년·반·번호·성명, 그리고 맨 아래 워터마크에는
 * 출력자 이름과 IP까지 있다. 골라 덮는 것보다 띠 전체를 덮는 쪽이 안전하고,
 * 학교마다 배치가 조금씩 달라도 새는 곳이 없다.
 */
export function footerMask(viewport) {
  const top = viewport.height * FOOTER_RATIO;
  return { x: 0, y: top, w: viewport.width, h: viewport.height - top };
}
