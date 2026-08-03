# 온보딩 (S03)

구글 로그인 직후 들어오는 화면. 역할을 고르고, 학생이면 학년·계열·학과·관심사를
정한 뒤 **실제로 받게 될 글 3건을 보고** 끝난다.

## 설계 원칙

**1. 모른다고 답할 수 있어야 한다.**
이 서비스가 풀려는 문제 자체가 "학생이 자기 관심사를 모른다"는 것이다. 온보딩에서
정확한 관심사를 요구하면 그 문제를 사용자에게 되돌려 주는 꼴이 된다. STEP 3 에
**"아직 모르겠어요"**, STEP 4 에 **건너뛰기**가 있는 이유다. 좁히는 일은 발견(S43)
화면이 대신한다.

**2. 뒤로 갈수록 가벼워진다.** 앞 단계는 한 번 누르면 넘어가고, 마지막은 선택이다.

**3. 마지막에 결과를 보여준다.** 고르기만 하고 끝나면 무엇을 얻었는지 모른다.

## 흐름

```
STEP 0  역할        학생 / 멘토 / 교사        (학생 카드가 넓다 — 기본 경로)
  학생  STEP 1 학년 → 2 계열 → 3 학과 → 4 세부 관심(건너뛰기) → 5 미리보기
  멘토  M1 전공·소속 → M2 멘토링 가능 분야
  교사  T1 학교·과목·담당 학년 → T2 학급 개설 / 참여
```

진행바는 학생 5칸, 멘토·교사 2칸.

## 어디에 저장하나

| 값 | 위치 |
|---|---|
| 역할 · 학년 · 계열 · 학교 · 과목 · 진행 단계 | `user_profiles` (user_id PK) |
| 고른 학과 (최대 3) | `user_majors` |
| 대표 학과 1개 | `research_profiles` — 기존 화면들이 쓰던 자리. 학생만 쓴다 |
| 관심 키워드 | `user_keywords` (preset / manual) |
| 멘토 전공·소속 | `mentor_profiles` |
| 학급 · 소속 | `classrooms`, `classroom_members` |

`users` 테이블에는 손대지 않았다. MBX 에는 Alembic 이 없고 `create_all` 은 **새
테이블만 만들고 기존 테이블은 바꾸지 않는다.** `users.role` 로 컬럼을 붙이면 새로
만든 DB 에만 생기고 이미 돌아가는 DB 에는 없다. `research_profiles` 가 같은 이유로
갈라져 나온 선례를 따랐다.

## 키워드를 언제 넣나

- **STEP 3 학과 선택** → 그 학과의 *핵심* 키워드(시드에서 가중치를 높인 앞 4개 쌍)
- **STEP 4** → 나머지 프리셋 중 고른 것 + 직접 적은 것
- **"아직 모르겠어요"** → 고른 계열 **전체 학과**의 핵심 키워드

STEP 3 에서 프리셋을 통째로 넣으면 STEP 4 가 할 일이 없어지고, 반대로 STEP 4 에서
고른 것만 남기면 **건너뛴 사람이 더 많은 키워드를 갖는** 이상한 상태가 된다.

## 학년이 실제로 바꾸는 것

물어봤으면 쓰여야 한다. 지금 달라지는 것은 둘이다.

- **1학년** → 로그인 직후 첫 화면이 대시보드가 아니라 **발견(S43)**
- **3학년** → 탐구 피드가 **논문 탭**으로 열린다

## 설계안에서 빼거나 바꾼 것

| 설계안 | 실제 | 이유 |
|---|---|---|
| "아직 모르겠어요"에 가중치 0.5 | 계열 전체의 **핵심 키워드만** 등록 | 매칭(pg_trgm 부분일치)에 점수 개념이 없어 weight 컬럼을 만들어도 아무 데도 쓰이지 않는다 |
| 3학년 "피드 양 축소 · 주간 다이제스트 ON" | 논문 탭으로 여는 것만 | 피드 분량·다이제스트를 조절하는 설정이 아직 없다 |
| 계열 카드 이모지 | 라벨 + 예시 학과만 | TossFace 에 🔬·🩺·🎨 가 없어 한 화면에 두 종류 이모지가 섞인다 |
| 멘토 완료 → 멘토 대시보드 | 멘토링 화면(S24) | 멘토 전용 대시보드가 아직 없다. 멘토는 당분간 학생 화면을 함께 쓴다 |

## 한국어·영어 짝

시드(`seed_data.py`)는 "촉매", "catalysis" 처럼 같은 개념을 나란히 적는다.
**순서가 곧 짝**이라 DB 를 거치면(정렬이 바뀐다) 알 수 없으므로, 묶음은 시드
상수에서 만들어 `/v1/research/tracks` 의 `keyword_groups` 로 내려준다.

화면에는 대표 이름 하나만 보이지만 **검색에는 묶인 낱말을 모두 쓴다.** 표시를
합쳤다고 결과가 줄면 통합이 아니라 손실이다.

## 쉬운 말 라벨

칩에 적히는 말은 학생이 알아들을 수 있는 말이다 — "자연어처리"가 아니라
"챗봇·번역 AI". 매핑은 `apps/web/src/lib/onboardingData.js` 의 `EASY_LABELS`
하나뿐이고, 여기 없는 낱말은 그대로 보여준다("로봇"·"백신"까지 풀어쓰면 오히려
뭘 고르는지 모르게 된다). **매칭에는 원래 낱말을 쓴다** — 라벨을 바꿔도 결과는
달라지지 않는다.

## 수동 스키마 변경

`create_all` 은 ALTER 를 하지 않는다. 이미 만들어진 표에 컬럼을 더할 때는 손으로
한 번 반영해야 한다. 이 기능을 붙이며 실행한 것:

```sql
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS teacher_grades VARCHAR(40);
ALTER TABLE user_profiles ALTER COLUMN track_group TYPE VARCHAR(120);
```

## 계정 삭제 시 함께 지워야 하는 것

`user_profiles`, `user_majors`, `mentor_profiles`, `classroom_members`,
그리고 기존의 `user_keywords`, `user_reads`, `research_profiles`.
`DELETE /v1/research/me` 는 관심사 부분만 지우고 온보딩을 되돌린다(키워드가 없는
채로 "완료" 상태를 남기면 다음 로그인에 빈 피드로 떨어진다).

## API

```
GET   /v1/onboarding            현재 상태 (이탈 복구)
PATCH /v1/onboarding            바뀐 항목만 저장 — 단계마다 부른다
POST  /v1/onboarding/keywords   세부 관심 저장
GET   /v1/onboarding/preview    받게 될 글 3건 (matched=false 면 최신글로 대신 채운 것)
POST  /v1/onboarding/complete   완료
GET   /v1/classrooms            내 학급
POST  /v1/classrooms            학급 개설 (교사만)
POST  /v1/classrooms/join       참여 코드로 참여
```

로그인 응답(`/v1/auth/*`)에 `role` · `grade` · `onboarded` 가 함께 온다.
`role` 이 **null 이면 "서버가 모른다"**는 뜻이고, 그때만 프런트의 옛 이메일 추측
경로가 쓰인다. 온보딩을 한 번 끝내면 서버 값이 이긴다.

## 참고 파일

- 화면: `apps/web/src/screens/student/S03.jsx`
- 단계 컴포넌트: `apps/web/src/components/onboarding/`
- 상태: `apps/web/src/hooks/useOnboarding.js`
- 표시용 데이터: `apps/web/src/lib/onboardingData.js`
- 서버: `services/api/app/features/onboarding/`
- 스타일: `apps/web/src/theme/styles.css` 의 "온보딩 (S03)" 블록
