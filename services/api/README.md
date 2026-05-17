# MentorBridgeX API (Ontology MVP)

FastAPI 백엔드 — 온톨로지 생기부 6/5 Swagger 데모용 초안.

## Quick start

```bash
# 1. 인프라
cd ../.. && cp .env.example .env && make up

# 2. API (로컬)
cd services/api
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

- Swagger: http://localhost:8000/docs
- Graph viewer: http://localhost:8000/dev/graph-viewer

## Harness tests (ML Mock, Docker 불필요)

```bash
make harness
# 또는
pytest tests/harness/ -v
```

## Demo flow

1. `POST /v1/auth/dev-login` → `access_token` 복사
2. Authorize in Swagger (Bearer token)
3. `POST /v1/students/me/graph/seed` body: `{"seeds": ["양자컴퓨팅"]}`
4. `GET /v1/students/me/graph`
5. `POST /v1/students/me/recommendations/branch` body: `{"seeds": ["양자컴퓨팅"], "max_results": 5}`
6. `POST /v1/students/me/documents/import-pdf` (multipart file)
7. `GET /v1/jobs/{job_id}`

자세한 시나리오: `../../docs/demo-june5.md`
