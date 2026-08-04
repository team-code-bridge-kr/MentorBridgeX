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

- 저장 단위는 `document_sections` 한 행 = 한 과목. 과목명은 `subject_id` 에 넣는다.
  같은 과목이 학년별로 여러 번 나오면 한 행으로 합친다(46 → 40).
- 새로 올린 PDF 는 `_merge_sections_by_type` 이 과목별로 갈라 저장한다.
- 이미 한 덩어리로 저장된 생기부는 `POST /documents/split-subjects` 로 가른다.
  `[과목]` 표시를 되짚을 뿐이라 글자는 버리지 않고, 여러 번 불러도 안전하다
  (갈라 놓은 행에는 표시가 남지 않는다). 규칙은 `parsers/subject_blocks.py` 와
  화면 쪽 `lib/subjectBlocks.js` 가 같아야 한다.
- 화면(S11 목록)은 세특만 영역 카드 대신 **과목 카드**로 펼친다.

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
