# MentorBridgeX — Agent / Harness Guide

이 레포는 **Harness engineering** 원칙으로 운영합니다. 에이전트·개발자는 코드보다 **가이드·검증·계약**을 우선합니다.

## Stack

| Layer | Tech |
|-------|------|
| API | FastAPI (`services/api`) |
| DB | PostgreSQL + pgvector, Neo4j, Redis |
| Client (product) | Flutter (별도 `apps/mobile` 예정) |
| ML / Embedding (v0.1) | **Mock adapters** — 벤더 미정 |

## Source of truth

1. **제품·온톨로지 동작**: `guide/_extracted/정합성/feature_spec.md` (v1.0)
2. **API 계약**: FastAPI OpenAPI (`/openapi.json`) + `guide/_extracted/정합성/api_catalog.md`
3. **그래프 데이터**: Neo4j (Source of Truth), PostgreSQL `document_sections` = 텍스트 표현
4. **당신이 수정할 코드**: `services/api/app/` — routers → services → adapters/db

## Domain ownership

| Domain | Owner track | Tags in Swagger |
|--------|-------------|-----------------|
| Ontology / 생기부 | 온톨로지 담당 | `ontology-*` |
| Voice / STT | 음성 담당 | `voice-planned` (스텁) |
| Auth (dev) | 공통 | `auth` |

## Conventions

- Base path: `/v1`
- Student scope: `/v1/students/me/*`
- Errors: `{ "error": { "code", "message", "details", "trace_id" } }`
- Success list: `{ "data": [], "page": {} }` (MVP는 단순 배열도 허용)
- URL slug: kebab-case (`import-pdf`, not camelCase)
- **Do not** commit `.env`, secrets, or `guide/*.zip`

## Harness (feedback loop)

```bash
make harness          # ML Mock YAML fixtures — Docker 불필요
make test             # 전체 pytest
make lint             # ruff
```

- ML behavior changes → update `tests/harness/cases/*.yaml` + `app/adapters/ml_mock.py`
- New ontology endpoint → add router + Pydantic schema + demo step in `docs/demo-june5.md`

## Local services

```bash
make up               # postgres, neo4j, redis
make api              # uvicorn reload
```

Neo4j Browser: http://localhost:7474 (neo4j / mentorbridgex)

## Docs index

- `docs/architecture.md` — 시스템 구조
- `docs/ontology-domain.md` — 온톨로지 담당 범위
- `docs/demo-june5.md` — 6/5 Swagger 시연 시나리오
- `services/api/README.md` — API 실행 방법

## When adding real ML

1. Implement `app/adapters/ml_<vendor>.py` + `embedding_<vendor>.py`
2. Wire in `app/adapters/factory.py` via env `ML_ADAPTER` / `EMBEDDING_ADAPTER`
3. Extend harness cases — do not delete Mock tests
