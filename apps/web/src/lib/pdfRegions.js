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
export function toItems(textContent, viewport, pdfjs) {
  return textContent.items
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
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

export function toLines(textContent, viewport, pdfjs) {
  const lines = [];
  for (const it of toItems(textContent, viewport, pdfjs)) {
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

/* 구획의 진짜 경계는 괘선이다 — 이게 이 파일의 핵심이다.
 *
 * 영역 라벨("자율활동")은 셀 안에서 **세로 가운데**에 놓인다. 라벨의 y 를 구획
 * 시작으로 쓰면 실제 행보다 한참 아래에서 시작한다(2쪽 실측: 라벨 y=609,
 * 행 시작 y=487 — 122pt 차이). 본문 줄 간격으로 가르는 것도 안 된다. 자율활동
 * 마지막 줄(729)과 동아리활동 첫 줄(743)의 간격이 행 안쪽 간격(4pt)과 같다.
 *
 * 그래서 `findRules` 로 표의 가로 괘선을 뽑아 라벨을 그 위 괘선에 붙인다.
 * pdf.js 의 constructPath 는 [그리기연산, [좌표들], 경계상자] 꼴이고 좌표는
 * cm(좌표계 변경) 이 걸린 상태다. save/restore/transform 을 따라가며 CTM 을
 * 추적한 뒤 viewport.transform 을 곱해야 캔버스 좌표가 나온다.
 *
 * 표본 대조: pdf.js 로 뽑은 값이 PyMuPDF get_drawings() 와 소수점까지 같다
 * (2쪽 82.9·111.2·…·486.8·740.8·769.0).
 */

/**
 * 제목이 없고 **표 머리로만** 알아볼 수 있는 구획.
 *
 * 봉사활동 실적 표에는 `<봉사활동실적>` 같은 제목이 없다(표본 6쪽 확인).
 * 열 이름 "일자 또는 기간" 이 이 표에만 나오므로 그걸 표시로 쓴다.
 */
const HEADER_LABELS = [
  { key: "volunteer", norm: "일자또는기간", label: "봉사활동 실적" },
];

/** 표 머리로 알아보는 구획의 시작. */
export function findHeaderTables(items, pageWidth) {
  const hits = [];
  for (const it of items) {
    if (it.x > pageWidth * LABEL_X_RATIO) continue;
    const a = HEADER_LABELS.find((c) => c.norm === norm(it.str));
    if (a && inLabelColumn(items, it)) hits.push({ ...a, y: it.y, x: it.x });
  }
  return hits.sort((a, b) => a.y - b.y);
}

/**
 * 줄의 **첫 칸 또는 둘째 칸**에 놓인 조각만 남긴다.
 *
 * 조각의 x 만 보면 본문 한가운데에서 시작한 글자 뭉치가 셀 라벨로 오인된다
 * (표본: 2학년 세특 쪽 한복판에 "자율활동" 구획이 생겼다). 표의 라벨 칸은
 * 줄의 맨 앞이거나, 학년 숫자(한두 자) 바로 다음이다.
 */
function inLabelColumn(items, target) {
  const row = items.filter((it) => Math.abs(it.y - target.y) <= Math.max(it.h, target.h) * 0.6);
  const idx = row.indexOf(target);
  if (idx === 0) return true;
  if (idx !== 1) return false;
  return /^\s*\d{1,2}\s*$/.test(row[0].str);
}

/**
 * 창체 표 맨 왼쪽 학년 칸(`1`, `2`, `3`).
 *
 * 세특의 `[1학년]` 과 달리 창체 표에는 학년 표시가 **숫자 한 칸**뿐이다. 여러 행을
 * 묶는 칸이라 세로 가운데에 놓이므로, 라벨은 y 가 가장 가까운 숫자에 붙인다
 * (실측 3쪽: 숫자 1 y=352 → 동아리 169·진로 395 둘 다 이쪽이 가깝다).
 *
 * 학년이 없으면 같은 쪽에 `자율활동` 구획이 둘 생겨 이름이 겹치고, 그러면 화면이
 * 둘을 같은 것으로 여겨 앞 쪽 구획이 다음 쪽에 남는다.
 */
export function findRowGrades(items, pageWidth) {
  return items
    .filter((it) => it.x <= pageWidth * 0.1 && /^\s*[1-3]\s*$/.test(it.str))
    .map((it) => ({ grade: `${it.str.trim()}학년`, y: it.y }))
    .sort((a, b) => a.y - b.y);
}

/** 표 안의 영역 라벨. 조각 하나가 라벨 하나라서 **정확히 같은지**로 본다. */
export function findCellLabels(items, pageWidth) {
  const hits = [];
  for (const it of items) {
    if (!isCellLabel(it.x, pageWidth) || it.x > pageWidth * LABEL_X_RATIO) continue;
    const a = ANCHOR_LABELS.find((c) => c.norm === norm(it.str));
    if (a && inLabelColumn(items, it)) hits.push({ ...a, y: it.y, x: it.x });
  }
  return hits.sort((a, b) => a.y - b.y);
}

/** 페이지 왼쪽의 대제목. 자간이 벌어져 인쇄되므로 줄로 묶어서 본다. */
export function findAnchors(lines, pageWidth) {
  const limit = pageWidth * 0.08;
  const hits = [];
  for (const line of lines) {
    if (line.x > limit) continue; // 본문·표 안에 섞인 같은 낱말을 여기서 거른다
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

/* ──────────────────────────────────────────────────────────────
   세특 안쪽 — 과목·학년 앵커

   실측(19쪽 표본): 세특 본문은 한 과목이 `국어: 음운 변동…` 꼴로 시작하고,
   전부 같은 x(33.5)에서 시작한다. 들여쓰기로는 과목 시작을 알 수 없다.
   그래서 **과목명 사전**으로 찾는다 — 학생의 저장된 세특에서 과목 이름을
   이미 알고 있으니 추측할 필요가 없다.

   학기 표시가 앞에 붙는 과목이 있다: `(1학기)통합과학:`. 이건 벗겨서 본다.
   학년은 `[1학년]` 한 줄로 나뉜다(7·10·15쪽). 과목 앵커의 학년은 그 앞의
   마지막 학년 표시다.
────────────────────────────────────────────────────────────── */

const SUBJECT_X_RATIO = 0.12; // 본문 시작 x(33.5/595≒5.6%)보다 넉넉히
const GRADE_LINE = /^\s*\[\s*(\d)\s*학년\s*\]/;

/** `[1학년]` 처럼 학년만 적힌 줄. */
export function findGradeMarks(lines, pageWidth) {
  const limit = pageWidth * SUBJECT_X_RATIO;
  return lines
    .filter((l) => l.x <= limit && GRADE_LINE.test(l.str))
    .map((l) => ({ grade: `${GRADE_LINE.exec(l.str)[1]}학년`, y: l.y }))
    .sort((a, b) => a.y - b.y);
}

/**
 * 과목이 시작하는 줄.
 *
 * @param subjects 이 학생의 과목 이름 목록(document_sections.subject_id)
 */
export function findSubjectAnchors(lines, subjects, pageWidth) {
  const limit = pageWidth * SUBJECT_X_RATIO;
  // 긴 이름부터 본다. "과학"이 "과학탐구실험"을 가로채면 안 된다.
  const names = [...new Set(subjects.filter(Boolean))].sort((a, b) => b.length - a.length);
  const hits = [];
  for (const line of lines) {
    if (line.x > limit) continue;
    // 앞에 붙는 학기 표시를 벗긴다: `(1학기)통합과학:` → `통합과학:`
    const head = norm(line.str).replace(/^\(\d학기\)/, "");
    for (const name of names) {
      const key = norm(name);
      if (!head.startsWith(key)) continue;
      // 과목명 바로 뒤는 콜론이어야 한다. 본문 첫 낱말이 우연히 과목명으로
      // 시작하는 일을 여기서 막는다("국어가 계속해서 변화하고…").
      if (head[key.length] !== ":") break;
      hits.push({ subject: name, y: line.y, x: line.x });
      break;
    }
  }
  return hits.sort((a, b) => a.y - b.y);
}

/* ──────────────────────────────────────────────────────────────
   표의 가로 괘선
────────────────────────────────────────────────────────────── */

// pdf.js 의 경로 명령(DrawOPS). 내보내지 않는 상수라 여기에 적어 둔다.
const D_MOVE = 0, D_LINE = 1, D_CURVE = 2, D_QUAD = 3, D_CLOSE = 4;
// 가로로 볼 기울기 — 인쇄 오차 정도만 봐준다
const RULE_FLAT = 0.8;
// 페이지 폭의 이만큼은 넘어야 표의 가로줄이다. 셀 안 밑줄이 섞이면 경계가 는다.
const RULE_MIN_RATIO = 0.3;

const matMul = (a, b) => [
  a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
];

/**
 * 한 쪽의 가로 괘선 y 좌표(캔버스 기준, 오름차순).
 *
 * @param opList page.getOperatorList() 결과
 */
export function findRules(opList, viewport, pdfjs) {
  const OPS = pdfjs.OPS;
  const base = viewport.transform;
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const ys = new Set();

  for (let i = 0; i < opList.fnArray.length; i += 1) {
    const fn = opList.fnArray[i];
    if (fn === OPS.save) { stack.push(ctm.slice()); continue; }
    if (fn === OPS.restore) { ctm = stack.pop() || [1, 0, 0, 1, 0, 0]; continue; }
    if (fn === OPS.transform) { ctm = matMul(ctm, opList.argsArray[i]); continue; }
    if (fn !== OPS.constructPath) continue;

    const m = matMul(base, ctm);
    const at = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
    for (const buf of opList.argsArray[i][1]) {
      const d = Array.from(buf);
      let k = 0;
      let cur = null;
      while (k < d.length) {
        const op = d[k]; k += 1;
        if (op === D_MOVE || op === D_LINE) {
          const pt = at(d[k], d[k + 1]); k += 2;
          if (op === D_LINE && cur
              && Math.abs(pt[1] - cur[1]) < RULE_FLAT
              && Math.abs(pt[0] - cur[0]) > viewport.width * RULE_MIN_RATIO) {
            ys.add(Math.round(pt[1] * 10) / 10);
          }
          cur = pt;
        } else if (op === D_CURVE) { k += 6; cur = null; }
        else if (op === D_QUAD) { k += 4; cur = null; }
        else if (op === D_CLOSE) { cur = null; }
        else break; // 모르는 명령이 나오면 이 경로는 포기한다
      }
    }
  }
  return [...ys].sort((a, b) => a - b);
}

/** 표 안의 라벨인가(대제목이 아니라). 실측: 대제목 x≈35, 셀 라벨 x≈90~95. */
export function isCellLabel(x, pageWidth) { return x > pageWidth * 0.08; }

/** 번호가 붙은 대제목(`4. 자격증 및 인증 취득상황`). 구획은 아니고 경계다. */
export function findSectionBreaks(lines, pageWidth) {
  const limit = pageWidth * 0.08;
  return lines
    // 번호는 한두 자리, 점 뒤에 **공백**, 그 뒤는 한글이나 `<`.
    // 좁히지 않으면 `12021.08.17.수강자` 같은 표 안 날짜가 대제목이 된다.
    .filter((l) => l.x <= limit && /^\s*\d{1,2}\.\s+[가-힣<]/.test(l.str) && norm(l.str).length <= 24)
    .map((l) => ({ y: l.y }))
    .sort((a, b) => a.y - b.y);
}

/** 라벨을 바로 위 괘선에 붙인다. 너무 멀면 붙이지 않는다(표 밖일 수 있다). */
export function snapToRule(rules, y, maxUp = 400) {
  let best = null;
  for (const r of rules) {
    if (r > y + 2) break;
    if (y - r <= maxUp) best = r;
  }
  return best === null ? y - 4 : best;
}
