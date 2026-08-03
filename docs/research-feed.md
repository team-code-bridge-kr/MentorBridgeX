# 탐구주제 피드

고등학생이 진학 희망 학과를 고르면 관련 뉴스·논문을 자동 수집해 한 곳에서 보여준다.
목적은 학생부종합전형의 탐구활동 주제 발굴을 돕는 것.

**넓게 시작해서 좁혀 들어가는** 구조다. 학생이 처음부터 키워드를 떠올릴 필요가 없다.

1. 구글 로그인 (기존 MBX 인증 재사용)
2. 진학 희망 학과 선택 → 그 학과의 프리셋 키워드가 자동 적용 (S40)
3. 피드를 읽으며 세부 키워드를 추가/제거 (S41 → S42)
4. 읽은 글에 자주 나온 개념을 보여줘 다음 탐구 방향을 암시 (S43)

## 구성

```
services/api/app/features/research/
├─ models.py       tracks, track_keywords, research_profiles, user_keywords,
│                  sources, articles, article_terms, user_reads, fetch_logs
├─ seed_data.py    학과 프리셋 16종 + 수집 소스 목록  ← 소스를 늘리려면 여기
├─ seed.py         부팅 시 idempotent 반영
├─ feed.py         키워드 매칭 + keyset 페이지네이션
├─ scheduler.py    주기 수집 (asyncio 루프)
├─ ingest/         http(예절) · rss · arxiv · crossref · dedupe · summarize · runner
└─ terms/          TermExtractor 인터페이스 + 통계 구현체

apps/web/src/screens/student/
└─ S40 온보딩 · S41 피드 · S42 키워드 관리 · S43 발견
```

## 로컬 실행

MBX 본체와 같다. 별도 프로세스가 없다.

```bash
docker compose up -d --build api
curl -X POST http://127.0.0.1:8000/v1/research/ingest/run \
  -H "Authorization: Bearer $TOKEN"        # 수집 즉시 1회
```

스케줄러는 부팅 60초 뒤부터 `RESEARCH_INGEST_INTERVAL_HOURS`(기본 6) 간격으로 돈다.
0 이하로 두면 스케줄러를 띄우지 않는다 — 개발 중에는 이렇게 두고 수동으로 돌리는 게 편하다.

## 지금 어디서 가져오는가 (2026-08 기준 23개)

| 종류 | 소스 | 비고 |
|---|---|---|
| 뉴스 RSS | 연합뉴스 8개 (산업·보건·경제·사회·문화·정치·국제·스포츠) | 섹션당 120건 |
| 뉴스 RSS | 전자신문 IT·과학, 한국경제 경제, 동아일보 IT·의학, ZDNet Korea | |
| 뉴스 RSS | 한겨레 미래&과학, 경향신문 과학 | **꺼둠** — 피드에 "AI 학습 및 활용 금지" 문구 |
| 뉴스 API | NewsAPI.org 2개 | **꺼둠** — 아래 참고 |
| 논문 | arXiv 12개 (cs.AI/LG, cs.CV/CL, cs.DS/CC, cs.DC/OS, cs.SE/PL, cs.CR/DB, chem-ph, eess, math, q-bio, econ, physics) | |
| 논문 | Crossref 7개 (의약·간호·교육·환경·사회·인문 등) | 검색어 기반 |

**넣지 않기로 한 곳**

- **매일경제(mk.co.kr)**: robots.txt 가 GPTBot·ClaudeBot·anthropic-ai·CCBot 등
  AI 크롤러에 `Disallow: /` 를 건다. 우리 UA 는 그 목록에 없어 문자열로는
  통과하지만, 매체의 뜻이 분명하므로 따른다.
- **NewsAPI.org 무료 플랜**: 하루 100요청 + 기사 24시간 지연에 더해, 약관이
  "development and testing in a development environment only, and cannot be used
  in a staging or production environment" 다. 운영 배포에는 못 쓴다.
  유료는 $449/월. 수집기는 만들어 뒀으니 키를 넣고 enabled 만 켜면 된다
  (`NEWSAPI_KEY`, `seed_data.py` 의 `newsapi-ko`/`newsapi-en`).

**이 목록이 곧 피드의 한계다.** 학과 트랙을 새로 만들 때는 그 트랙을 받아 줄
소스가 있는지부터 확인할 것 — 컴퓨터공학 트랙이 한동안 빈 피드였던 이유가
arXiv 에 cs.AI/cs.CV 밖에 없어서였다.

### 트랙별 커버리지 (2026-08-03 실측, 상한 50건)

cs 50 / ai 50 / mech 49 / math 50 / physics 50 / civil 50 / biz 50 / psych 50 /
humanities 50 / env 27 / ee 26 / social 24 / med 18 / nursing 18 / bio 14 / **chem 5**

소스를 늘리기 전에는 cs 가 0건이었다. 화학은 `physics.chem-ph` +
`cond-mat.mtrl-sci` 를 넣어 38건을 받았는데도 5건밖에 안 걸린다 — 논문 초록이
"촉매/catalysis" 같은 트랙 키워드를 그대로 쓰지 않기 때문이다. 국내 화학 기사도
드물다. 화학 트랙은 키워드를 초록에서 실제로 쓰는 말로 손보는 게 다음 숙제다.

## 키워드가 걸리는 방식

`articles.search_text`(= lower(제목 + 요약))에 대한 부분일치다. 두 가지를 주의한다.

1. **여러 낱말 키워드는 통짜 문구가 아니라 "낱말 모두 포함"으로 본다.**
   "cloud computing" 을 통짜로 찾으면 1,154건 중 0건이 걸린다 — 실제 글은
   "cloud environments", "cloud-native computing" 처럼 쓰기 때문이다.
   낱말 조건으로 바꾸면 2건이 잡히고, "data structure" 는 0건 → 12건이 된다.
2. **한글 키워드는 국내 기사에, 영문 키워드는 논문에 걸린다.** 트랙 시드가
   한글·영문 쌍을 함께 넣는 이유다. "알고리즘"은 국내 기사 411건에 0건이지만
   "algorithm"은 43건이다. 화면에서도 결과가 0건이면 반대쪽 표기를 권한다.

## 소스 추가하기

`seed_data.py` 의 `SOURCES` 에 튜플 한 줄을 넣고 api 를 재시작하면 끝이다.
런타임 상태(etag, 실패 횟수, 백오프)는 시드를 고쳐도 초기화되지 않는다.

```python
# (id, name, type, url, query, outlet, enabled)
("yna-industry", "연합뉴스 산업", "rss", "https://www.yna.co.kr/rss/industry.xml",
 None, "연합뉴스", True),

# arXiv 는 url 대신 query 에 카테고리 검색식
("arxiv-cs-ai", "arXiv 인공지능", "arxiv", "", "cat:cs.AI OR cat:cs.LG", "arXiv", True),

# Crossref 는 query 에 검색어
("crossref-med", "Crossref 의약", "crossref", "", "precision medicine clinical trial",
 "Crossref", True),
```

추가 전에 확인할 것:

1. **피드가 살아 있는지** — `curl -A 'MentorBridgeX-Bot/0.1' <url> | grep -c '<item'`
2. **robots.txt** — 코드가 자동으로 확인하고 막히면 `skipped` 로 기록하지만,
   미리 보고 넣는 편이 낫다
3. **저작권 고지** — 아래 참고

### 기본 비활성 소스

`hani-science`(한겨레), `khan-science`(경향)는 `enabled=false` 다.
robots.txt 는 우리 UA 를 막지 않지만, 피드 자체에
`무단 전재, 재배포, AI 학습 및 활용 금지` 고지가 붙어 있다.
제목+요약+링크만 보여주는 건 통상적인 RSS 구독 사용이지만, 판단은 운영자 몫이라
정의만 해두고 꺼놨다. 켜려면 `enabled` 를 `True` 로 바꾸면 된다.

## 지키고 있는 제약

**저작권**
- 기사 전문을 저장하지도 표시하지도 않는다. `articles` 에 본문 컬럼 자체가 없다.
- 요약은 화면이 아니라 **저장 직전에** 3문장·400자로 자른다 (`ingest/summarize.py`).
- `ingest/extract.py` 는 전문을 절대 반환하지 않는다 — 호출부가 실수할 여지를 없앴다.
- 카드는 새 탭으로 원 매체에 보내고, 매체명과 발행일을 항상 함께 표시한다.

**크롤링 예절** (`ingest/http.py`)
- 요청 전 robots.txt 확인 (stdlib `robotparser`, 6시간 캐시)
- 도메인별 락으로 동시 요청 1개 + 최소 3초 간격
- User-Agent 에 서비스명·연락처 URL 명시 (헤더는 latin-1 만 담기므로 ASCII)
- `If-None-Match` / `If-Modified-Since` 조건부 요청
- 429/5xx 는 `Retry-After` 존중 + 지수 백오프 3회, 4xx 는 즉시 포기
- 실패 3회 누적 시 해당 소스를 24시간 비활성 (성공하면 카운터 리셋)
- 한 소스가 실패해도 나머지 소스 수집은 계속된다

**개인정보**
- 관심 키워드와 읽기 이력은 개인정보로 취급한다
- `DELETE /v1/research/me` — 프로필·키워드·읽기 이력을 전부 삭제
- 로그에 이메일·이름·키워드를 남기지 않는다 (내부 user_id 만)

## 설계 메모

**왜 pg_trgm 인가** — `to_tsvector('simple')` 은 공백 단위라 조사가 붙은
"반도체가"를 "반도체"로 잡지 못한다. 형태소 분석기를 넣지 않고 부분일치로 해결했다.
`articles.search_text` 에 GIN 인덱스가 걸려 있다.

**왜 매칭을 미리 계산하지 않는가** — 사용자마다 키워드 집합이 다르고 수시로 바뀐다.
쿼리 시점에 판정한다.

**왜 OFFSET 이 아니라 keyset 인가** — 수집기가 계속 새 글을 넣으므로 OFFSET 은
페이지를 넘기는 사이에 중복·누락을 만든다. `(published_at, id)` 커서를 쓰고,
그래서 `published_at` 을 항상 채운다 (없으면 수집 시각).

**왜 TF-IDF 를 배치로 도는가** — 수집 직후 건건이 계산하면 IDF 분모가 미완성이라
점수가 흔들린다. 수집 사이클이 끝난 뒤 다시 계산한다.

**왜 users 에 track_id 를 안 붙였는가** — MBX 에는 Alembic 이 없고 스키마를
`Base.metadata.create_all` 로 만든다. create_all 은 새 테이블만 만들고 기존 테이블을
변경하지 않으므로, `users` 에 컬럼을 추가해도 조용히 무시된다.
`research_profiles` 로 분리한 이유다.

**오프라인 데모 모드 미지원** — `OFFLINE_DEMO=true` 에서는 트랙 목록만 주고
나머지는 503 을 돌려준다. 수집기까지 인메모리로 이중 구현할 값이 없다고 봤다.

## 나중에

당장 넣지 않았지만 기록해 둔다.

- **이메일 다이제스트** — 주 1회 정리 메일. 학생이 앱을 안 열어도 된다.
- **개념 그래프** — `article_terms` 의 동시 출현으로 개념 간 연결을 만들어 시각화.
  MBX 에 이미 Neo4j 와 그래프 화면(S06)이 있어 붙이기 유리하다.
- **탐구 기록** — 저장한 글에 메모를 남기고 나중에 활동 근거로 내보내기.
- **교사 뷰** — 담당 학생들의 관심사 분포를 한눈에.

개념 추출을 형태소 분석기나 LLM 으로 바꾸려면 `terms/service.py` 의
`get_extractor()` 하나만 손대면 된다.
