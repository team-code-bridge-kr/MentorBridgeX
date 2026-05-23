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

## ML (v0.1)

- **No vendor chosen** in guide — use `MockMLAdapter` / `MockEmbeddingAdapter`
- F1-04 pipeline: pgvector ANN (stub) → ML suggest keywords → user accept → Neo4j node

## Out of scope (other tracks)

- Voice STT WebSocket (`voice-planned`)
- Teacher / Admin consoles
- Production Google OAuth (use dev-login for demo)
