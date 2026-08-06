# Ontology domain (생기부)

온톨로지 담당 범위 요약. 상세는 `guide/_extracted/정합성/feature_spec.md` §3.

## Features (F1)

| ID | Name | MVP endpoint |
|----|------|----------------|
| F1-01 | 시드 키워드 | `POST /v1/students/me/graph/seed` |
| F1-02 | PDF 업로드 | `POST /v1/students/me/documents/import-pdf` |
| F1-02b | PDF 텍스트·**전체** 토큰 추출 | **PyMuPDF + 규칙 기반** (`app/parsers/`) — ML 아님, top-N 제한 없음 |
| F1-03 | 그래프 자동 생성 | PDF job 완료 시 Mock ML → Neo4j |
| F1-04 | 가지치기 추천 | `POST /v1/students/me/recommendations/branch` |
| F1-05 | 노드/엣지 CRUD | `/v1/students/me/graph/nodes`, `edges` |
| F1-05b | 노드 출처 문장 | `GET /v1/students/me/graph/nodes/{id}/evidence` |
| F1-06 | 그래프↔텍스트 동기화 | **partial** — PATCH documents only |
| F1-08~10 | 양식 변환 | **not in MVP** |
| F1-12 | 임베딩 | Mock adapter; pgvector tables later |

## Storage map

| Data | Store |
|------|-------|
| 본문 텍스트 (8영역) | PostgreSQL `document_sections` |
| 그래프 | Neo4j `(:Node)` + `[:REL]` |
| 임베딩 | PostgreSQL pgvector (planned) |
| PDF file | Future: object storage |

## 세특은 과목마다 한 영역 (F1-02c)

세부능력 및 특기사항은 나머지 일곱 영역과 모양이 다르다. **한 영역이 아니라 과목
수십 개**다(표본 19쪽에서 46과목 21,000자). 예전에는 `[과목] 본문` 꼴로 이어 붙여
한 행에 저장했는데, 그러면 ① 편집 상자 하나에 21,000자가 들어가고 ② 노드가 어느
과목에서 나왔는지 말할 수 없고 ③ 과목이 노드의 자리를 정하는데 그 과목이 없다.

- 저장 단위는 `document_sections` 한 행 = **(학년, 과목)** 하나. 과목명은
  `subject_id`, 학년은 `period_id`("1학년") 에 넣는다. 과목만으로 묶으면 안 된다 —
  미술·음악은 두 학년에 걸쳐 있어서 2년 치가 한 칸에 뭉친다(표본 46조각 → 42행).
- 학년은 PDF 의 `[1학년]` 표시에서만 나온다. 성적표를 걷어낼 때 함께 지워지므로
  `_strip_grade_tables` 가 그 한 줄만 남기고, 본문에는 딸려 들어가지 않게 뺀다.
  **학년을 이름으로 추측하지 않는다**(선택과목 편성은 학교마다 다르다).
- 새로 올린 PDF 는 `_merge_sections_by_type` 이 학년·과목별로 갈라 저장한다.
- 이미 저장된 생기부는 `POST /documents/split-subjects` 가 정리한다:
  ① `[과목]` 표시로 가르고 ② 같은 생기부를 두 번 올려 생긴 중복을 걷고
  ③ 원본 PDF 가 남아 있으면 다시 읽어 학년을 붙인다. 이때 **원본에서 온 것이
  확실한 행만** 갈아 끼운다 — 한 글자라도 원본에 없는 행(손으로 쓴 글)은 그대로
  둔다. 이미 원본과 같으면 아무것도 건드리지 않는다(문서 id 가 흔들리면 열어 둔
  화면이 없는 문서를 가리킨다). 규칙은 `parsers/subject_blocks.py` 와 화면 쪽
  `lib/subjectBlocks.js` 가 같아야 한다.
- 화면(S11 목록)은 세특만 영역 카드 대신 **학년 → 과목 카드**로 펼친다.

## 노드의 다른 이름 — 별칭 (F1-05d)

생기부에는 "인공지능" 이라고 적혀 있는데 노드 이름은 "AI" 인 일이 흔하다. 그러면
출처 문장도 관계도 못 찾고, **그 노드만 조용히 빠진다.** 별칭은 그 간극을 메운다.

- 저장 자리는 `external_refs.aliases`(문자열 배열, 최대 8개). 새 표를 만들지 않는
  이유는 별칭이 노드에 딸린 값이라 노드를 지우면 함께 사라져야 하기 때문이다.
- 출처 문장·관계 찾기 둘 다 **이름 + 별칭 전부**로 찾는다
  (`node_evidence.patterns_of`). 별칭으로 걸린 문장도 출처로서 값어치가 같다.
- 두 글자 이름은 그 이름으로는 찾지 않지만(우연히 겹칠 확률이 너무 높다),
  별칭 중 셋 글자 이상이 있으면 그 별칭으로 찾는다 — "AI" 노드가 "인공지능"으로
  걸리는 길이 이것이다.
- 한쪽이 다른 쪽을 품는 짝을 거를 때도 별칭까지 견준다.

## 개념끼리의 관계 (F1-05c)

그래프의 선은 거의 전부 "이 노드가 생기부 문서에 나왔다"(MENTIONED_IN) 하나였다.
60개 선이 전부 같은 뜻이라 선을 진하게 그려도 읽을 것이 없다. 학생이 알고 싶은
것은 문서와의 관계가 아니라 **개념끼리의 관계**다.

`GET /graph/links/suggested` — 생기부 **같은 문장**에 함께 적혀 있던 노드 짝을
찾아 근거 문장과 함께 돌려준다(`services/node_links.py`).

- 근거는 그 문장 하나뿐이다. 지어낸 유사도·임베딩 거리를 쓰지 않는다.
- **잇지는 않는다.** 근거 문장을 보여주고 결정은 학생이 한다(`POST /graph/edges`).
  자동으로 이으면 근거가 약한 연결이 늘어 그래프가 다시 못 읽는 그림이 된다.
- "같은 항목에 있었다" 로는 잇지 않는다. 세특 한 과목이 500자가 넘어서 거의 모든
  쌍이 해당한다 — 그건 관계가 아니라 목록이다.
- 거르는 것: 한 문장에 7개 이상 걸린 문장(나열), 두 글자 이하 이름, 한쪽이 다른
  쪽을 품는 짝("빅데이터"/"빅데이터 분석"), 시간 표시("2학기"), 이미 이어진 짝.

## 노드 출처 문장 (F1-05b)

노드 상세 패널은 그 노드 이름이 **실제로 적혀 있던 생기부 문장**을 함께 보여준다.
낱말만 남으면 학생은 "이게 왜 내 그래프에 있지?" 를 알 수 없고, 잘못 뽑힌
노드인지 아닌지 판단할 수 없어 고치지도 지우지도 못한다.

- 문장을 노드에 **저장하지 않는다.** 요청할 때마다 `document_sections` 원문에서
  다시 찾는다 — ① 예전에 만든 노드에도 출처가 붙고, ② 생기부를 고치면 출처도
  따라 바뀌며, ③ 민감한 개인정보를 두 벌 갖지 않는다.
- 찾기는 공백을 무시한다(`services/node_evidence.py`). PDF 에서 뽑은 글은 낱말
  중간에 줄바꿈이 끼어 있는 일이 흔하다("정 의 란 무 엇 인 가").
- 최대 3문장, 문장이 150자를 넘으면 낱말 둘레만 잘라 `…` 로 표시한다. 나머지는
  개수로만 알린다. 여기는 문서를 읽는 자리가 아니라 노드를 판단하는 자리다.
- `origin` (`document` / `student` / `branch`) 은 `external_refs.source` 에서
  온다. 문장을 못 찾았을 때 **왜 없는지**를 말하기 위한 값이다 — 직접 만든
  노드에 출처가 없는 건 오류가 아니다.
- `PATCH /nodes/{id}` 의 `external_refs` 는 **보낸 열쇠만 덮어쓴다.** 화면에서는
  과목만 보내는데 통째로 갈아 끼우면 `source` 가 지워져 출처를 잃는다.

## ML (v0.1)

- **No vendor chosen** in guide — use `MockMLAdapter` / `MockEmbeddingAdapter`
- F1-04 pipeline: pgvector ANN (stub) → ML suggest keywords → user accept → Neo4j node

## Out of scope (other tracks)

- Voice STT WebSocket (`voice-planned`)
- Teacher / Admin consoles
- Production Google OAuth (use dev-login for demo)
