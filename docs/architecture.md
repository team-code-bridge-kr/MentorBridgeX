# Architecture

## Overview

```
Flutter App  ──REST/WS──►  FastAPI (services/api)
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         PostgreSQL        Neo4j          Redis
         (+ pgvector)    (ontology)     (jobs/cache)
              │
              ▼
         Object storage (future: PDF/audio)
              │
              ▼
         ML / STT / Embedding (external, v0.1 = Mock)
```

## Ontology data flow

1. **Input**: seed keywords, PDF, manual text, (later) voice report approval
2. **PostgreSQL**: `document_sections`, grades, `format_outputs`, jobs
3. **Neo4j**: 6 node types, 9 relation types — **authoritative graph**
4. **pgvector**: `node_embeddings`, `document_chunk_embeddings` (MVP: embedding mock only)
5. **Output**: graph JSON for clients, recommendations, generated format text

## MVP scope (2026-06-05)

Implemented in `services/api`:

- Dev auth (`POST /v1/auth/dev-login`)
- Graph CRUD + seed
- Documents CRUD + PDF import (mock parser)
- Branch recommendations (mock ML + RAG stub)
- Jobs status
- Voice routes: **planned stub only**

## Harness engineering

| Type | Artifact |
|------|----------|
| Guides | `AGENTS.md`, this file, `ontology-domain.md` |
| Sensors | `pytest`, `ruff`, YAML harness under `tests/harness/` |
| Demo | `docs/demo-june5.md`, Swagger `/docs`, `/dev/graph-viewer` |

Reference specs: `guide/_extracted/정합성/`
