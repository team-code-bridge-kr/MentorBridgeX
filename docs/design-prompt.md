# 디자인 프롬프트 — Arena / Technical Precision Light

**다른 프로젝트에 붙여 넣는 용도의 프롬프트다.** MBX 화면 이야기는 빼고, 이 시스템을
그 시스템이게 하는 것만 남겼다. 새 프로젝트의 AI 에게 통째로 붙여 넣거나, 사람이
읽고 손으로 옮겨도 된다.

MBX 안에서 화면별 규칙을 찾는다면 [design-guide.md](design-guide.md) 를 볼 것 —
이 문서는 그 상위에 있는 **이식 가능한 부분**이다.

---

## 0. 한 문장

> 흰 바탕에 얇은 회색 선, 파랑 하나, 14px 밀도. 색으로 꾸미지 않고 **간격과
> 경계**로 정보를 나눈다. 움직임은 배경에서만 아주 느리게.

이 시스템의 인상은 **밀도**에서 온다. 본문을 16px 로 올리는 순간 완전히 다른
제품이 된다. 그 한 줄만 지켜도 절반은 따라온다.

---

## 1. 반드시 지킬 다섯 가지

이걸 어기면 아무리 값을 베껴도 다른 물건이 된다.

1. **본문 14px / line-height 1.5.** 15도 16도 아니다.
2. **강조색은 파랑 하나.** 나머지는 흰색·회색 계단이다. 빨강·주황·초록은
   **상태**(위험·주의·완료)에만 쓰고 장식으로 쓰지 않는다.
3. **깊이는 테두리로 낸다.** 그림자는 **실제로 떠 있는 것**(팝오버·드로어·모달·
   떠 있는 판)에만. 평평한 카드에 그림자를 두르면 화면이 물렁해진다.
4. **색·테두리·그림자를 컴포넌트에 인라인으로 적지 않는다.** 공용 클래스가 없으면
   클래스를 새로 만든다. 인라인으로 흩어지면 다음 사람이 "통일"을 다시 해야 한다.
5. **한글이면 `word-break: keep-all` + `overflow-wrap: anywhere` 를 짝으로.**
   keep-all 만 쓰면 긴 영문 토큰(URL·ID)이 레이아웃을 밀어버린다. 이 한 줄이
   한글 UI 품질의 절반이다.

---

## 2. 토큰

그대로 복사해서 쓰는 `:root` 블록이다. **값을 직접 짚어 넣지 말고 늘 변수로**
참조한다 — 한 곳에서 못 바꾸게 되는 순간 시스템이 아니다.

```css
:root {
  /* ── 강조 — 평상시 밝은 쪽, hover 에서 어두운 쪽. 누르려 하면 어두워진다 ── */
  --primary:#0051ae;  --primary-container:#0969da;
  --on-primary:#ffffff;

  --blue-50:#e7effb;  --blue-100:#c9dcf5; --blue-200:#9ec4ff;
  --blue-300:#75abff; --blue-400:#58a6ff; --blue-500:#0969da;
  --blue-600:#0051ae; --blue-700:#003a6b;

  /* ── 표면 계단 — 밝은 쪽부터. 직접 조합하지 말고 이 여섯만 쓴다 ── */
  --bg1:#ffffff;      /* 카드·판                    */
  --bg2:#f7f9ff;      /* 화면 바닥                  */
  --bg3:#ebeef5;      /* 눌린 자리·비활성 칩        */
  --bgd:#e0e2e9;      /* 가장 어두운 표면           */
  --bg-low:#f1f4fa;
  --surface-zebra:#f6f8fa;  /* 표 줄무늬·인용 블록 */

  /* ── 글자 4단계 ── */
  --tp:#181c21;   /* 본문·제목       */
  --ts:#424753;   /* 설명            */
  --tt:#727785;   /* 보조·라벨       */
  --td:#c2c6d6;   /* 플레이스홀더    */

  /* ── 선 ── */
  --brd:#c2c6d6;  --brds:#727785;  --brdf:#0051ae;

  /* ── 상태 (장식용 아님) ── */
  --success:#16a34a; --successbg:#e7f6ec;
  --warning:#b84b00; --warningbg:#ffece5;
  --danger:#ba1a1a;  --dangerbg:#ffdad6;

  /* ── 순서 척도 — 난이도·진행도·단계 어디에나 재사용 ── */
  --tier-1:#16a34a; --tier-2:#0ea5e9; --tier-3:#0969da;
  --tier-4:#7c3aed; --tier-5:#db2777;

  /* ── 모양 — 단추·입력 8, 카드 12~18, 칩 4, 알약 9999 ── */
  --r4:4px; --r6:6px; --r8:8px; --r12:12px; --rfull:9999px;

  /* ── 그림자 사다리 ── */
  --surface-1:0 1px 2px rgba(15,23,42,.05), 0 8px 24px rgba(15,23,42,.045);
  --surface-2:0 2px 6px rgba(15,23,42,.06), 0 14px 34px rgba(15,23,42,.09);

  /* ── 간격 — 4의 배수. 여기 없는 값을 쓰지 않는다 ── */
  --s4:4px;--s6:6px;--s8:8px;--s10:10px;--s12:12px;--s16:16px;
  --s20:20px;--s24:24px;--s28:28px;--s32:32px;--s40:40px;

  /* ── 폭 ── */
  --page-w:1280px;             /* 본문 최대 폭. 27인치에서 문장이 화면 끝까지
                                  늘어나면 어느 화면이든 못 읽는다 */
  --sb-w-rail:68px;            /* 사이드바 접힘 */
  --sb-w-open:260px;           /* 사이드바 펼침 */
}

body {
  font-family:'Pretendard','Apple SD Gothic Neo',-apple-system,sans-serif;
  background:var(--bg1); color:var(--tp);
  font-size:14px; line-height:1.5;
  -webkit-font-smoothing:antialiased;
  word-break:keep-all; overflow-wrap:anywhere;
}
```

**글자 크기 사다리** — 이 여섯 개로 다 만든다.

| 자리 | 크기 / 굵기 |
|---|---|
| 화면 제목(히어로) | `clamp(30px, 3vw, 44px)` / 700 |
| 구역 제목 | 22px / 700 |
| 카드 제목 | 15px / 700 |
| 본문 | 14px / 400 |
| 설명·보조 | 13px / 400, `--ts` 또는 `--tt` |
| 라벨·배지 | 11~12px / 700 |

큰 제목에는 `letter-spacing:-.02em` 를 준다. 한글은 자간이 넓어 보여서 24px 이
넘어가면 조금 조여야 한 덩어리로 읽힌다.

숫자가 바뀌는 자리(카운터·시각·용량)에는 `font-variant-numeric: tabular-nums` 를
준다. 없으면 값이 바뀔 때마다 폭이 흔들린다.

---

## 3. 부품

### 단추

```css
.btn {
  display:inline-flex; align-items:center; justify-content:center; gap:6px;
  font-family:inherit; font-weight:700; border:none; cursor:pointer;
  border-radius:var(--r8); white-space:nowrap;
  transition:background-color .14s, border-color .14s, color .14s;
}
.btn-sm { height:34px; padding:0 12px; font-size:13px; }
.btn-md { height:40px; padding:0 16px; font-size:14px; }
.btn-lg { height:46px; padding:0 20px; font-size:15px; }
/* 폭을 채우는 단추는 반드시 display:flex. inline-flex 로 두면 auto 여백이
   먹히지 않아 가운데 정렬된 형제들 사이에서 혼자 왼쪽에 붙는다. */
.btn-fw { width:100%; display:flex; height:48px; }

.btn-primary   { background:var(--blue-500); color:#fff; }
.btn-primary:hover  { background:var(--blue-600); }
.btn-secondary { background:var(--bg1); color:var(--tp); border:1px solid var(--brd); }
.btn-secondary:hover { background:var(--bg3); }
.btn-ghost     { background:transparent; color:var(--primary); }
.btn-ghost:hover { background:var(--blue-50); }
.btn-danger    { background:var(--danger); color:#fff; }
/* 지우기를 옆의 「수정」과 짝지어 세울 때. 꽉 찬 빨강은 판 안에서 너무 세고,
   테두리가 없으면 짝이 안 맞아 눌리는 것으로 안 보인다. */
.btn-outline-danger { background:var(--bg1); color:var(--danger); border:1px solid var(--dangerbg); }
```

**한 줄에 서는 것은 키를 맞춘다.** 도구띠에 34px 단추와 48px 검색창이 나란히
서면 그것만으로 조잡해 보인다. 검색창·칩·개수 표시 전부 같은 높이로.

**누르는 것과 알려 주는 것은 면으로 가른다.** 단추는 흰색으로 **채우고**, 값만
알려 주는 칩은 배경을 비우고 선만 남긴다. 색으로 구별하려 들지 않는다.

### 카드

```css
.card { background:var(--bg1); border-radius:18px; border:none; box-shadow:var(--surface-1); }
.card-p { padding:20px; }
```

카드는 **테두리 대신 그림자**로 뜬다(선과 그림자를 겹치면 두 번 나뉜다).
목록 안의 작은 카드는 반대로 **1px 선 + 그림자 없음**이 낫다 — 열 장이 저마다
그림자를 지면 바닥이 지저분해진다.

같은 화면에서 같은 무게의 것은 **같은 카드 옷**을 입힌다. 추천 카드와 제안
카드가 하나는 파란 판, 하나는 흰 카드면 무게가 달라 보인다.

### 배지 · 칩

```css
.badge { display:inline-flex; align-items:center; padding:1px 6px; border-radius:var(--r4);
         font-size:11px; font-weight:700; line-height:18px; white-space:nowrap; }
.badge-blue  { background:var(--blue-50);   color:var(--blue-500); }
.badge-grey  { background:var(--bg3);       color:var(--ts); }
.badge-green { background:var(--successbg); color:var(--success); }
.badge-pill  { border-radius:var(--rfull); padding:3px 10px; }
```

**판 안에서 파랑은 "누르는 것"이 아니라 "표시"다.** 구역 머리글을 파란 알약으로
두면 그 아래가 한 덩이로 묶여 읽힌다.

### 탭 — 밑줄

```css
.tab-bar  { display:flex; border-bottom:1.5px solid var(--brd); gap:0; }
.tab-item { padding:9px 14px; font-size:14px; font-weight:500; color:var(--ts);
            border-bottom:2px solid transparent; margin-bottom:-1.5px; cursor:pointer;
            transition:color .14s, border-color .14s; }
.tab-item:hover  { color:var(--primary); }
.tab-item.active { color:var(--primary); font-weight:700; border-bottom-color:var(--primary); }
```

목록을 가르는 방법은 **앱 전체에서 하나**여야 한다. 어떤 화면은 밑줄 탭,
어떤 화면은 알약 거르개면 그게 같은 것인 줄 모른다.

### 입력

```css
.input {
  height:40px; padding:0 14px; border-radius:var(--r8);
  border:1px solid var(--brd); background:var(--bg1); font-size:14px; color:var(--tp);
  transition:border-color .14s, box-shadow .14s;
}
.input:focus { border-color:var(--blue-400); box-shadow:0 0 0 4px rgba(9,105,218,.10); }
.input::placeholder { color:var(--td); }
```

초점은 **테두리 색 + 4px 링**이다. `outline` 을 지웠으면 반드시 이걸 준다.
키보드만 쓰는 사람에게는 이게 커서다.

### 빈 상태

```css
.empty       { text-align:center; padding:44px 24px; }
.empty-title { font-size:15px; font-weight:700; color:var(--tp); margin-bottom:6px; }
.empty-sub   { font-size:13px; color:var(--tt); line-height:1.65; margin-bottom:16px; }
```

빈 칸을 그냥 비워 두면 **고장으로 읽힌다.** 왜 비었는지 한 줄, 그리고 채우는
길(단추) 하나. 「아직 없습니다」로 끝내지 않는다.

무언가를 받아야 하는 자리(업로드·연결 대기)는 **점선 테두리 + 아주 옅은 파랑**
으로 둔다. 실선으로 두르면 내용이 든 카드처럼 보인다.

```css
.dropzone {
  display:flex; flex-direction:column; align-items:center; text-align:center;
  padding:22px 20px; border-radius:18px;
  border:1.5px dashed rgba(9,105,218,.35); background:rgba(9,105,218,.035);
}
.dropzone-ic { width:42px; height:42px; border-radius:12px; margin-bottom:10px;
               display:grid; place-items:center; background:rgba(9,105,218,.1); }
```

---

## 4. 유리(frosted) — 아껴 쓴다

목록 하나만 있는 화면에서 흰 판을 흰 배경에 얹으면 경계가 안 보이고, 테두리를
두르면 상자처럼 굳는다. 그럴 때만 쓴다.

```css
/* 뒤에 흐릴 빛을 먼저 깐다 */
.glass-wrap {
  background:
    radial-gradient(60% 44% at 50% -6%, rgba(99,102,241,.20) 0%, transparent 70%),
    radial-gradient(48% 38% at  8% 54%, rgba(9,105,218,.14) 0%, transparent 72%),
    radial-gradient(44% 34% at 94% 30%, rgba(56,189,248,.13) 0%, transparent 74%),
    var(--bg1);
}
.glass {
  background:rgba(255,255,255,.66);
  backdrop-filter:blur(20px) saturate(165%);
  -webkit-backdrop-filter:blur(20px) saturate(165%);
  border:1px solid rgba(255,255,255,.85);   /* 윗면에 빛이 걸린 것처럼 */
  box-shadow:0 12px 34px rgba(15,23,42,.09), inset 0 1px 0 rgba(255,255,255,.6);
}
/* 흐림을 못 쓰는 브라우저에서는 그냥 흰 판. 반투명만 남으면 글자 뒤로 배경이
   비쳐 읽기 어려워진다. */
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))) {
  .glass { background:var(--bg1); border-color:var(--brd); }
}
```

> **유리는 뒤에 흐릴 무언가가 있을 때만 유리다.** 흰 배경 위의 반투명 흰 판은
> 그냥 흰 판이고, 흰색 85% 테두리는 아예 안 보인다. 배경을 걷을 거면 판도 함께
> 평범한 흰 카드로 떨어뜨린다 — 위 `@supports` 대비책과 같은 처방이다.

---

## 5. 브랜드 물결

제품 이름과 화면 제목의 회전 단어에만 쓴다. **한 프로젝트에 한 그라데이션.**
이름이 화면마다 다르게 빛나면 같은 이름으로 안 읽힌다.

```css
:root {
  --brand-wave:linear-gradient(100deg,
    #0969da 0%, #4f46e5 22%, #38bdf8 42%, #6366f1 62%, #0969da 100%);
}
.brand-word {
  display:inline-block;
  background:var(--brand-wave); background-size:220% 100%;
  -webkit-background-clip:text; background-clip:text;
  color:transparent; -webkit-text-fill-color:transparent;
  animation:brandWave 3.4s linear infinite;
}
@keyframes brandWave { to { background-position:-220% 0; } }
@media (prefers-reduced-motion:reduce) {
  .brand-word { animation:none; background-position:22% 0; }
}
```

---

## 6. 움직임

**규칙: 빛은 배경에서만, 아주 느리게. 틀은 움직이지 않는다.**

| 무엇 | 시간 |
|---|---|
| 색·테두리 바뀜(hover) | `.12~.14s` |
| 자리 옮김·펼침 | `.28~.34s cubic-bezier(.22,.8,.28,1)` |
| 배경 오로라 | `19s` / `26s`(두 겹, 주기를 다르게) |
| 회전하는 내용 | 2.6s / 5s / 6s / 8s — **서로 어긋나게** |

두 겹이 같은 박자로 뛰면 숨이 아니라 **깜빡임**이 된다. 회전하는 자리가 여럿이면
간격을 소수로 어긋나게 둔다.

회전은 **제자리에서 내용만** 바뀌어야 한다. 틀이 늘었다 줄면 아래 내용이 밀린다.

```css
/* 배경 오로라 — 빛을 단추 같은 작은 것에 두르면 그것만 튀지만,
   배경에 두면 화면 전체가 숨 쉬는 것처럼 보인다. */
.glow { position:absolute; inset:0; pointer-events:none; overflow:hidden; }
.glow::before, .glow::after { content:""; position:absolute; border-radius:50%; will-change:transform, opacity; }
.glow::before { width:70%; height:78%; left:-6%; top:34%;
  background:radial-gradient(circle, rgba(9,105,218,.19) 0%, rgba(9,105,218,.06) 46%, transparent 72%);
  animation:auroraDrift 19s ease-in-out infinite; }
.glow::after  { width:64%; height:72%; right:-4%; top:12%;
  background:radial-gradient(circle, rgba(167,139,250,.20) 0%, rgba(99,102,241,.08) 44%, transparent 72%);
  animation:auroraDrift 26s ease-in-out infinite reverse; }
@keyframes auroraDrift {
  0%,100% { transform:translate3d(0,0,0) scale(1);       opacity:.72; }
  50%     { transform:translate3d(4%,-4%,0) scale(1.18); opacity:1; }
}
```

**`prefers-reduced-motion` 은 선택이 아니다.** 움직임만 멈추고 **색은 남긴다** —
애니메이션을 껐다고 화면이 밋밋해지면 그 사람만 다른 제품을 쓰게 된다.

```css
@media (prefers-reduced-motion:reduce) {
  .glow::before, .glow::after { animation:none; opacity:.86; }
}
```

---

## 7. 배치

- **모든 화면이 같은 폭에서 시작한다.** `max-width: var(--page-w); margin:0 auto`.
  읽는 목록은 860px 로 더 좁혀도 된다 — 한 줄이 길면 제목과 시간이 멀어져서
  어느 시간이 어느 항목의 것인지 눈으로 이어야 한다.
- **화면을 덮는 것은 덮게 둔다.** 히어로가 둥근 판으로 떠 있으면 "위젯 하나"가
  된다. 바깥 여백을 음수 마진으로 되밀고 모서리를 둥글리지 않는다. 안쪽 내용만
  가운데 정렬.
- **옆 판은 옆에 붙인다. 위에 띄우지 않는다.** 넓은 화면에서 도킹 분할
  (판 `min-width:330px / max-width:430px`), 900px 이하에서 아래로 내린다.
- **스크롤은 바깥이 아니라 안쪽 몸통이 한다.** 그래야 닫기 ✕ 를 판에 못박아 둘
  수 있고, 글을 내려도 닫기가 따라 사라지지 않는다.
- **패널 자리는 하나다.** 무엇을 세울지는 상태 한 값이 정한다. 둘이 나란히 설 수
  있게 두면 어떤 순서로 누를 때 본문이 사라진다.
- **떠 있는 단추(FAB) 아래에는 여백을 비워 둔다.** 스크롤이 끝까지 갔을 때 마지막
  단추가 로고 뒤에 깔린다.

---

## 8. 글

디자인의 절반은 문구다.

- **화면이 제 이름을 두 번 말하지 않는다.** 왼쪽 바에서 「음성 세션」을 눌러
  들어온 화면에 「음성 세션」 제목을 또 두지 않는다. 낭독기용으로만 남긴다.
- **머리글이 이미 한 말을 본문에서 되풀이하지 않는다.** 「출처」 아래 "출처 문장",
  「연결」 아래 "연결 3개" 는 같은 말을 두 번 하며 정작 읽을 것을 밀어낸다.
- **개수를 머리글에 붙이지 않는다.** 아래를 세면 나온다.
- **미리 설명하지 말고 그때 말한다.** "PDF · 최대 50MB" 는 지금 알 필요가 없다.
  어긋나면(형식 틀림·너무 큼) 그 순간에 이유를 말한다.
- **무엇이 바뀌었는지 이름으로 말한다.** "연결했습니다" 가 아니라
  「'A'와 'B'를 이었습니다」. 한글이면 받침에 맞는 조사를 계산해서 붙인다 —
  `'수학' 가 적혀` 같은 문장은 그 문구가 하는 말까지 못 믿게 만든다.
- **AI 가 쓴 문장은 AI 가 썼다고 밝힌다.** 사실(원문 인용)과 해석(모델의 판단)이
  같은 글씨로 나란히 있으면 둘 다 사실로 읽힌다. 짝이 되는 낱말을 쓴다 —
  아래가 「출처」면 위는 「해석」.

---

## 9. 접근성 — 값싸고 반드시 하는 것

- `outline` 을 지웠으면 `:focus-visible` 로 4px 링을 반드시 돌려준다.
- 아이콘만 있는 단추에 `aria-label`.
- 색만으로 알리지 않는다. 「안 읽음」은 파란 점 **과 함께** 글자로도 적는다.
- 감춘 제목은 `display:none` 이 아니라 `.sr-only` 로. 문서 구조는 남겨야 한다.

```css
.sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px;
           overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; border:0; }
```

---

## 10. 새 화면 체크리스트

- [ ] 본문 14px / line-height 1.5 인가
- [ ] 색·테두리·그림자를 인라인으로 적지 않았나
- [ ] 파랑 말고 다른 강조색을 쓰지 않았나(상태색 제외)
- [ ] 한 줄에 서는 것들의 높이가 같은가
- [ ] 카드 옷이 같은 무게의 것끼리 같은가
- [ ] 빈 상태에 이유와 다음 길이 있나
- [ ] 초점 링이 보이나 · 아이콘 단추에 이름이 있나
- [ ] `prefers-reduced-motion` 에서 움직임만 멈추고 색은 남나
- [ ] 머리글이 한 말을 본문이 되풀이하지 않나
- [ ] 좁은 화면(900px)에서 옆 판이 본문을 덮지 않나

---

## 11. AI 에게 그대로 넘길 때

새 프로젝트에서 이 시스템을 재현시키려면 아래를 붙여 넣는다.

> 이 프로젝트의 UI 는 아래 디자인 시스템을 따른다.
>
> **성격**: 흰 바탕 · 얇은 회색 선 · 강조색은 파랑 하나 · 본문 14px 밀도.
> 색으로 꾸미지 않고 간격과 경계로 정보를 나눈다. 움직임은 배경에서만 아주 느리게.
>
> **토큰**: 아래 `:root` 블록을 전역 CSS 최상단에 두고, 색·반경·간격은 **반드시
> 변수로만** 참조한다. 컴포넌트에 색·테두리·그림자를 인라인으로 적지 않는다.
> 공용 클래스가 없으면 전역 CSS 에 클래스를 새로 만든다.
> (§2 블록을 여기 붙여 넣을 것)
>
> **반드시 지킬 것**
> 1. 본문 14px / line-height 1.5
> 2. 강조색은 파랑 하나. 빨강·주황·초록은 상태에만
> 3. 깊이는 테두리로. 그림자는 실제로 떠 있는 것에만
> 4. 한글이면 `word-break:keep-all` + `overflow-wrap:anywhere` 를 짝으로
> 5. 한 줄에 서는 것들은 높이를 맞춘다
> 6. `outline` 을 지웠으면 `:focus-visible` 4px 링을 반드시 돌려준다
> 7. `prefers-reduced-motion` 에서 움직임만 멈추고 색은 남긴다
>
> **문구**: 화면이 제 이름을 두 번 말하지 않는다. 머리글이 한 말을 본문에서
> 되풀이하지 않는다. 미리 설명하지 말고 어긋나는 순간에 말한다. 무엇이
> 바뀌었는지는 이름으로 말한다. AI 가 쓴 문장은 AI 가 썼다고 밝힌다.
