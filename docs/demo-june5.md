# 6월 5일 데모 시나리오 (Swagger / Postman)

온톨로지 생기부 + (음성은 스텁) API 검증용 체크리스트.

## 사전 준비

```bash
cp .env.example .env
make up
cd services/api && python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

- Swagger: http://localhost:8000/docs
- Graph UI: http://localhost:8000/dev/graph-viewer
- Neo4j Browser: http://localhost:7474

Harness (ML Mock, Docker 없이):

```bash
make harness
```

---

## 시나리오 A — 온톨로지 (필수)

### A1. 로그인

`POST /v1/auth/dev-login`

```json
{
  "email": "student@example.com",
  "display_name": "데모 학생"
}
```

→ `access_token` 저장. Swagger **Authorize**에 `Bearer <token>` 입력.

### A2. 시드 → 그래프

`POST /v1/students/me/graph/seed`

```json
{ "seeds": ["양자컴퓨팅", "암호학"] }
```

`GET /v1/students/me/graph` → 노드 2개 이상 확인.

### A3. 가지치기 추천 (Mock ML)

`POST /v1/students/me/recommendations/branch`

```json
{
  "seeds": ["양자컴퓨팅"],
  "max_results": 5
}
```

기대: `큐비트`, `양자 알고리즘` 등 포함 (`tests/harness/cases/branch_recommendation.yaml`과 동일).

### A4. 추천 채택

`POST /v1/students/me/recommendations/accept`

```json
{ "label": "쇼어 알고리즘" }
```

→ `GET /v1/students/me/graph`에 노드 추가 확인.

### A5. 텍스트 영역

`POST /v1/students/me/documents`

```json
{
  "section_type": "subject_specific",
  "content": "화학 실험을 통해 산화·환원 반응을 탐구하였습니다."
}
```

`GET /v1/students/me/documents` → 목록 확인.

### A6. PDF import (PyMuPDF 실제 파싱)

`POST /v1/students/me/documents/import-pdf` — 생기부 PDF multipart 업로드.

→ `job_id` 수신 → `GET /v1/jobs/{job_id}` status `completed`

기대 `result` 예시:

```json
{
  "extractor": "pymupdf+rule_tokens",
  "page_count": 19,
  "unique_token_count": 120,
  "keywords": ["프로그래밍", "탐구", "..."],
  "document_section_ids": ["..."]
}
```

→ `GET /v1/students/me/graph` 에 Keyword 노드 + Document 노드 + `MENTIONED_IN` 엣지 확인.

**담당 범위:** PDF→텍스트/토큰 추출은 **패키지(PyMuPDF)** + 규칙 기반. **핵심어 가중치(ML)** 는 팀장 트랙(`MockMLAdapter` → 실 ML).

### A7. 그래프 시각화

1. `/dev/graph-viewer` 에 토큰 붙여넣기 → **그래프 화면** 확인  
2. 또는 Neo4j Browser: `MATCH (n:Node) RETURN n LIMIT 25`

---

## 시나리오 B — 음성 (스텁)

`POST /v1/students/me/voice/sessions` → `planned` 메시지 확인 (음성 담당 트랙에서 구현 예정).

---

## 발표 시 한 줄 스크립트

> “학생이 시드와 PDF로 생기부를 넣으면 PostgreSQL에 본문, Neo4j에 온톨로지 그래프가 쌓이고, Mock ML이 키워드를 추천합니다. v1.0에서 실 ML 벤더는 RFP로 연결할 예정이며, 지금은 API 계약과 데이터 경로를 검증했습니다.”

---

## 트러블슈팅

| 증상 | 조치 |
|------|------|
| DB connection error | `make up` 후 30초 대기 |
| Neo4j auth failed | `.env`의 `NEO4J_PASSWORD=mentorbridgex` 확인 |
| 401 on graph | Swagger Authorize Bearer 토큰 |
| Harness fail | `cd services/api && pytest tests/harness -v` |
