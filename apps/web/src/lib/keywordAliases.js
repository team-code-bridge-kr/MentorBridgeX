/**
 * 한글·영문 중복 키워드를 화면에서만 하나로 묶는다.
 *
 * **왜 UI 층인가.** user_keywords 테이블은 (user_id, keyword) 문자열 쌍일 뿐,
 * alias·synonym·id 구조가 없다. 저장 구조를 바꾸면 이미 등록된 키워드를 옮겨야
 * 하고 수집·매칭 경로까지 함께 손봐야 한다. 그래서 지금은 여기서 묶고, 나중에
 * 백엔드에 alias 가 생기면 이 파일만 갈아끼우면 되도록 떼어 놨다.
 *
 * **검색어는 줄어들지 않는다.** 화면에는 대표 이름 하나만 보이지만, 그 그룹이
 * 검색에 쓰일 때는 묶인 낱말을 **모두** 보낸다(searchTerms). 표시를 합쳤다고
 * 결과가 줄면 통합이 아니라 손실이다.
 *
 * 짝은 시드(seed_data.py 의 TRACKS)가 한글·영문을 나란히 넣는 규칙에서 왔다.
 */

// 대표이름 → 같은 뜻으로 쓰는 낱말들. 소문자로 비교한다.
const GROUPS = [
  ["알고리즘", ["알고리즘", "algorithm"]],
  ["자료구조", ["자료구조", "data structure"]],
  ["운영체제", ["운영체제", "operating system"]],
  ["컴파일러", ["컴파일러", "compiler"]],
  ["분산시스템", ["분산시스템", "distributed system"]],
  ["클라우드 컴퓨팅", ["클라우드", "cloud computing"]],
  ["사이버보안", ["사이버보안", "cybersecurity"]],
  ["오픈소스", ["오픈소스", "open source"]],
  ["소프트웨어공학", ["소프트웨어공학", "software engineering"]],
  ["데이터베이스", ["데이터베이스", "database"]],
  ["머신러닝", ["머신러닝", "machine learning"]],
  ["딥러닝", ["딥러닝", "deep learning"]],
  ["자연어처리", ["자연어처리", "natural language processing"]],
  ["컴퓨터비전", ["컴퓨터비전", "computer vision"]],
  ["강화학습", ["강화학습", "reinforcement learning"]],
  ["추천시스템", ["추천시스템", "recommender system"]],
  ["데이터사이언스", ["데이터사이언스", "data science"]],
  ["인공지능", ["인공지능", "artificial intelligence"]],
  ["언어모델", ["언어모델", "language model"]],
  ["생성형", ["생성형", "generative"]],
  ["트랜스포머", ["트랜스포머", "transformer"]],
  ["반도체", ["반도체", "semiconductor"]],
  ["신호처리", ["신호처리", "signal processing"]],
  ["제어공학", ["제어공학", "control system"]],
  ["로보틱스", ["로보틱스", "robotics"]],
  ["촉매", ["촉매", "catalysis"]],
  ["고분자", ["고분자", "polymer"]],
  ["전기화학", ["전기화학", "electrochemistry"]],
  ["나노소재", ["나노소재", "nanomaterial"]],
  ["유전자", ["유전자", "genomics", "gene"]],
  ["단백질", ["단백질", "protein"]],
  ["신경과학", ["신경과학", "neuroscience"]],
  ["임상시험", ["임상시험", "clinical trial"]],
  ["공중보건", ["공중보건", "public health"]],
  ["기후변화", ["기후변화", "climate change"]],
  ["재생에너지", ["재생에너지", "renewable energy"]],
  ["통계", ["통계", "statistics"]],
  ["최적화", ["최적화", "optimization"]],
];

const TO_GROUP = new Map();
for (const [display, terms] of GROUPS) {
  for (const t of terms) TO_GROUP.set(t.toLowerCase(), { display, terms });
}

/**
 * 서버가 준 키워드 목록을 화면용 그룹으로 묶는다.
 *
 * @param keywords [{ keyword, source }] — /v1/research/keywords 응답 그대로
 * @returns [{ id, displayName, searchTerms, sources, raw }]
 *          searchTerms 는 **사용자가 실제로 등록한 낱말만** 담는다. 등록하지
 *          않은 동의어까지 검색에 넣으면 화면의 "내 키워드"와 결과가 어긋난다.
 */
export function groupKeywords(keywords = []) {
  const out = [];
  const byDisplay = new Map();

  for (const k of keywords) {
    const raw = typeof k === "string" ? k : k.keyword;
    if (!raw) continue;
    const hit = TO_GROUP.get(raw.toLowerCase());
    const display = hit?.display || raw;

    let group = byDisplay.get(display);
    if (!group) {
      group = {
        id: display,
        displayName: display,
        searchTerms: [],
        sources: new Set(),
        raw: [],
      };
      byDisplay.set(display, group);
      out.push(group);
    }
    if (!group.searchTerms.includes(raw)) group.searchTerms.push(raw);
    group.raw.push(k);
    if (typeof k === "object" && k.source) group.sources.add(k.source);
  }

  return out.map((g) => ({ ...g, sources: [...g.sources] }));
}

/**
 * 낱말 하나를 화면에 적을 이름으로 바꾼다.
 *
 * 서버가 준 매칭 키워드는 등록된 그대로라 "algorithm"처럼 영어가 섞인다.
 * 학생에게 보여줄 때는 같은 뜻의 한국어 쪽을 쓴다 — 매칭 결과는 그대로 두고
 * 표기만 바꾸는 것이라 무엇이 걸렸는지는 달라지지 않는다.
 */
export function displayKeyword(word) {
  if (!word) return "";
  return TO_GROUP.get(String(word).toLowerCase())?.display || word;
}

/** 대표 이름 하나가 감춘 낱말이 몇 개인지 — 툴팁에 쓴다. */
export function aliasHint(group) {
  return group.searchTerms.length > 1 ? group.searchTerms.join(" · ") : "";
}
