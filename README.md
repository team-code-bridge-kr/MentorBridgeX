# MentorBridgeX

온톨로지 기반 생활기록부 관리 시스템 — MVP 초안.

## Repository layout

```
MentorBridgeX/
├── AGENTS.md              # Harness / agent guide
├── docs/                  # Architecture & demo scripts
├── guide/                 # Product specs (IA, feature spec, …)
├── services/api/          # FastAPI backend
├── docker-compose.yml
└── Makefile
```

## Quick start

### Docker 있을 때 (Neo4j·PostgreSQL 실연동)

```bash
cp .env.example .env
make up
cd services/api
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

### Docker 없을 때 (메모리 데모)

```bash
cd services/api
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
make -C ../.. api-offline
# 또는: OFFLINE_DEMO=1 uvicorn app.main:app --reload
```

- **Swagger**: http://localhost:8000/docs  
- **Graph viewer**: http://localhost:8000/dev/graph-viewer  
- **STT tester**: http://localhost:8000/dev/stt-recorder (`DAGLO_API_TOKEN` 설정 시)  
- **6/5 demo script**: [docs/demo-june5.md](docs/demo-june5.md)

## Tests

```bash
make harness   # ML Mock YAML (no Docker)
make test      # full pytest
```

## Stack

- API: FastAPI  
- DB: PostgreSQL (pgvector), Neo4j, Redis  
- Client: Flutter (planned)  
- ML v0.1: Mock adapters (`ML_ADAPTER=mock`)
