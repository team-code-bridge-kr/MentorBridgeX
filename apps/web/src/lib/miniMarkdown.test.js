import { describe, it, expect } from "vitest";
import { parseMarkdown, inlineParts, toPlainText } from "./miniMarkdown.js";

describe("parseMarkdown", () => {
  it("제목의 단계를 읽는다", () => {
    expect(parseMarkdown("# 보고서\n\n## 융합 학습")).toEqual([
      { kind: "h", level: 1, text: "보고서" },
      { kind: "h", level: 2, text: "융합 학습" },
    ]);
  });

  it("이어진 줄을 한 문단으로 잇는다", () => {
    // 생성된 글은 폭에 맞춰 줄이 접혀 온다. 줄마다 문단을 만들면 문장 중간에
    // 빈 줄이 생겨 읽히지 않는다.
    const [b] = parseMarkdown("첫 줄이고\n이어지는 줄이다.");
    expect(b).toEqual({ kind: "p", text: "첫 줄이고 이어지는 줄이다." });
  });

  it("빈 줄에서 문단을 끊는다", () => {
    expect(parseMarkdown("앞 문단.\n\n뒤 문단.")).toHaveLength(2);
  });

  it("글머리표를 하나의 목록으로 모은다", () => {
    expect(parseMarkdown("- 하나\n- 둘\n- 셋")).toEqual([
      { kind: "ul", items: ["하나", "둘", "셋"] },
    ]);
  });

  it("번호 목록과 글머리표를 섞지 않는다", () => {
    // 섞으면 번호가 엉켜 "1. 2. 3." 이 남의 항목까지 세게 된다.
    const blocks = parseMarkdown("1. 하나\n2. 둘\n- 셋");
    expect(blocks.map((b) => b.kind)).toEqual(["ol", "ul"]);
  });

  it("제목이 앞 문단을 끊는다", () => {
    const blocks = parseMarkdown("문단이다.\n## 소제목");
    expect(blocks.map((b) => b.kind)).toEqual(["p", "h"]);
  });

  it("빈 글은 블록이 없다", () => {
    expect(parseMarkdown("")).toEqual([]);
    expect(parseMarkdown(null)).toEqual([]);
  });

  it("마크다운이 아닌 글도 그대로 문단이 된다", () => {
    // 학생이 직접 쓴 글에는 기호가 없다. 그래도 읽히는 모양이어야 한다.
    expect(parseMarkdown("그냥 줄글입니다.")).toEqual([{ kind: "p", text: "그냥 줄글입니다." }]);
  });
});

describe("inlineParts", () => {
  it("굵은 글씨만 가른다", () => {
    expect(inlineParts("앞 **가운데** 뒤")).toEqual([
      { t: "앞 " },
      { t: "가운데", b: true },
      { t: " 뒤" },
    ]);
  });

  it("짝이 맞지 않는 별표는 글자로 남는다", () => {
    expect(inlineParts("**닫히지 않음")).toEqual([{ t: "**닫히지 않음" }]);
  });
});

describe("toPlainText", () => {
  it("붙여넣기 좋게 마크다운 기호를 걷는다", () => {
    const out = toPlainText("## 인공지능탐구반\n\n**36시간**을 참여했다.");
    expect(out).toBe("인공지능탐구반\n\n36시간을 참여했다.");
  });

  it("목록은 글머리를 남긴다 — 문단으로 뭉치면 읽기 어렵다", () => {
    expect(toPlainText("- 첫째\n- 둘째")).toBe("· 첫째\n· 둘째");
    expect(toPlainText("1. 하나\n2. 둘")).toBe("1. 하나\n2. 둘");
  });

  it("빈 글은 빈 글로", () => {
    expect(toPlainText("")).toBe("");
    expect(toPlainText(null)).toBe("");
  });
});

describe("toPlainText · dropLeadingTitle", () => {
  it("첫 줄의 문서 제목을 걷는다 — 화면 머리에 이미 있다", () => {
    const src = "# 동아리 활동 보고서\n\n## 수학문제만들기반\n\n30시간을 활동했다.";
    expect(toPlainText(src, { dropLeadingTitle: true }))
      .toBe("수학문제만들기반\n\n30시간을 활동했다.");
  });

  it("`##` 은 제목이 아니므로 그대로 둔다", () => {
    expect(toPlainText("## 소제목\n\n본문", { dropLeadingTitle: true }))
      .toBe("소제목\n\n본문");
  });
});
