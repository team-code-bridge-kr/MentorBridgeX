# DB 스키마 설계서

**프로젝트**: 온톨로지 기반 생활기록부 관리 시스템
**문서 버전**: v0.1
**작성일**: 2026-05-05

---

## 1. 설계 원칙

### 1.1 하이브리드 DB 구조
- **PostgreSQL (관계형)**: 사용자, 권한, 정형 데이터(성적, 원본 텍스트 영역, 양식 결과물 등), 감사 로그
- **Neo4j (그래프)**: 온톨로지 노드와 관계
- **연결 방식**: 그래프 노드의 `external_refs` 속성에 PostgreSQL의 PK를 저장. 양쪽에 `user_id`를 두어 사용자 단위로 격리.

### 1.2 사용자 격리
- 모든 노드/엣지에 `user_id` 속성 부여
- Neo4j composite index `(label, user_id)` 활용
- 모든 쿼리는 `user_id` 필터로 시작 → 탐색 비용은 해당 사용자 서브그래프 규모에 비례

### 1.3 변경 추적
- 모든 노드/엣지/레코드에 `created_at`, `updated_at`, `created_by`, `source` 부여
- 민감 작업은 PostgreSQL의 `audit_logs`에 기록

---

## 2. PostgreSQL 스키마 (관계형)

### 2.1 사용자/권한 도메인

#### `users`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | UUID PK | 사용자 식별자 |
| email | VARCHAR(255) UNIQUE | 로그인 이메일 |
| role | ENUM('student','teacher','admin') | 계정 유형 |
| display_name | VARCHAR(100) | 표시 이름 |
| oauth_provider | VARCHAR(50) | 소셜 제공자 (google 등) |
| oauth_subject | VARCHAR(255) | 제공자 측 사용자 ID |
| settings | JSONB | 자동 반영 모드 등 사용자별 설정 |
| created_at, updated_at | TIMESTAMPTZ | |

#### `teacher_student_links`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | UUID PK | |
| teacher_id | UUID FK → users.id | |
| student_id | UUID FK → users.id | |
| status | ENUM('pending','active','revoked') | |
| created_at | TIMESTAMPTZ | |

UNIQUE 제약: `(teacher_id, student_id)`

### 2.2 생기부 정형 데이터 도메인

#### `academic_periods`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK | 학생 |
| grade | SMALLINT | 학년 (1~3) |
| semester | SMALLINT | 학기 (1~2) |
| label | VARCHAR(50) | "1학년 2학기" 등 표시명 |

UNIQUE: `(user_id, grade, semester)`
※ Neo4j의 `Period` 노드와 1:1 대응되며, 그래프에서 `external_refs.period_id`로 참조

#### `subjects`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK | |
| name | VARCHAR(100) | 과목명 ("화학Ⅰ" 등) |
| category | VARCHAR(50) | 교과 영역 (국어/수학/영어/과학/사회/...) |

#### `subject_grades`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK | |
| subject_id | UUID FK | |
| period_id | UUID FK | |
| raw_score | NUMERIC(5,2) | 원점수 |
| achievement_level | VARCHAR(5) | 성취도 (A~E) |
| rank_in_class | VARCHAR(10) | 등급/석차 |
| extra | JSONB | 표준편차, 평균 등 부가 정보 |

UNIQUE: `(user_id, subject_id, period_id)`

#### `document_sections`
원본 생기부 텍스트 영역. Neo4j의 `Document` 노드가 이 테이블 행을 참조.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK | |
| period_id | UUID FK | nullable |
| subject_id | UUID FK | nullable (세특인 경우) |
| section_type | ENUM | 'subject_specific'(세특), 'autonomous'(자율), 'club'(동아리), 'volunteer'(봉사), 'career'(진로), 'behavior'(행특), 'reading'(독서), 'award'(수상) |
| content | TEXT | 원본 텍스트 |
| source | ENUM('pdf_parsed','manual','voice_imported') | |
| version | INT | 텍스트 변경 시 증가 |
| created_at, updated_at | TIMESTAMPTZ | |

### 2.3 양식 변환 도메인

#### `format_templates`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | UUID PK | |
| owner_id | UUID FK → users.id | nullable이면 시스템 기본 템플릿 |
| name | VARCHAR(100) | "화학과 지원용" 등 |
| guideline | TEXT | 생성 가이드라인 |
| max_chars | INT | 글자수 제한 |
| filters | JSONB | 키워드/도메인 필터 조건 |
| visibility | ENUM('private','shared_with_students','public') | |

#### `format_outputs`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK | 결과물의 소유자(학생) |
| template_id | UUID FK | |
| version | INT | 동일 템플릿의 N번째 생성 |
| content | TEXT | 생성된 텍스트 |
| source_node_ids | TEXT[] | 사용된 그래프 노드 ID 배열 |
| generated_at | TIMESTAMPTZ | |

UNIQUE: `(user_id, template_id, version)`

### 2.4 음성 활동 기록 도메인

#### `voice_sessions`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK | |
| started_at, ended_at | TIMESTAMPTZ | |
| status | ENUM('recording','processing','reviewed','reflected','failed') | |
| stt_engine | VARCHAR(50) | 사용된 엔진 식별자 |
| audio_path | TEXT | 오디오 저장 경로 (S3 등) |

#### `activity_reports`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | UUID PK | |
| session_id | UUID FK → voice_sessions.id | |
| user_id | UUID FK | |
| transcript | TEXT | 화자분리 후 정제된 전사문 |
| speakers | JSONB | 화자 라벨 배열 |
| extracted_keywords | TEXT[] | 후처리에서 추출된 키워드 |
| report_payload | JSONB | 일시/장소/주제/내용/결론/후속과제 등 구조화된 보고서 |
| approval_status | ENUM('pending_review','approved','rejected','auto_applied') | |

### 2.5 감사·시스템

#### `audit_logs`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | BIGSERIAL PK | |
| user_id | UUID | 행위자 |
| target_user_id | UUID | 대상 데이터의 소유자 |
| action | VARCHAR(50) | 'node.create','grade.read','export.pdf' 등 |
| target_type | VARCHAR(50) | |
| target_id | VARCHAR(100) | Neo4j 노드 ID도 들어올 수 있어 문자열 |
| diff | JSONB | 변경 전/후 (필요 시) |
| created_at | TIMESTAMPTZ | |

INDEX: `(target_user_id, created_at DESC)`, `(user_id, created_at DESC)`

---

## 3. Neo4j 스키마 (그래프)

### 3.1 노드 공통 속성
모든 노드가 공통으로 갖는 속성:

| 속성 | 타입 | 설명 |
|---|---|---|
| node_id | String | UUID, 그래프 내 고유 ID |
| user_id | String | 소유자 (필수, 모든 쿼리의 시작 필터) |
| type | String | 노드 타입 라벨과 동일 |
| label | String | 표시명 |
| description | String | 부가 설명 (nullable) |
| source | String | 'manual' / 'pdf_parsed' / 'ml_extracted' / 'voice_imported' |
| confidence | Float | 0~1, ML 생성 시에만 의미 (nullable) |
| created_at, updated_at | DateTime | |
| created_by | String | 행위자 user_id |
| external_refs | Map | PostgreSQL FK 모음 (예: `{subject_id: "...", document_section_id: "..."}`) |
| domain_tags | List<String> | 다중 도메인 표시 ("english", "science" 등) |

**인덱스**:
- `CREATE INDEX FOR (n:Node) ON (n.user_id, n.type)` — 사용자별 타입 조회
- `CREATE INDEX FOR (n:Node) ON (n.node_id)` — 단건 조회
- `CREATE FULLTEXT INDEX node_label_search FOR (n:Node) ON EACH [n.label, n.description]` — 라벨 검색

### 3.2 노드 타입별 추가 속성

#### `Keyword`
- `category`: 학문 분류 (선택)
- `aliases`: 동의어 리스트

#### `Inquiry` (탐구활동)
- `motivation`: 탐구 동기
- `method`: 탐구 방법
- `result`: 결과/결론
- `period_ref`: 연결된 Period의 node_id (편의성)

#### `Subject` (교과목)
- `subject_category`: 국어/수학/영어/과학/사회 등
- `external_refs.subject_id` 필수 → PostgreSQL `subjects.id`

#### `Activity` (비교과활동)
- `activity_type`: 'club' / 'volunteer' / 'autonomous' / 'career' / 'award' / 'reading' 중 하나
- `period_ref`: nullable

#### `Period` (시간 차원)
- `grade`: 1~3
- `semester`: 1~2
- `external_refs.period_id` 필수 → PostgreSQL `academic_periods.id`

#### `Document` (원본 텍스트 영역)
- `section_type`: document_sections.section_type와 동일
- `excerpt`: 원본의 일부 (검색 편의)
- `external_refs.document_section_id` 필수 → PostgreSQL `document_sections.id`
- `text_version`: 동기화 충돌 감지용 버전 번호

### 3.3 관계(Edge) 타입

모든 관계의 공통 속성:
- `weight`: 0~1, 연결 강도 (attention 점수 등)
- `created_at`: DateTime
- `created_by`: 행위자 user_id
- `source`: 'manual' / 'ml_extracted' / 'voice_imported'
- `evidence_node_id`: 근거가 된 Document 노드 ID (nullable)

| 관계 | 적용 노드 (From → To) | 의미 |
|---|---|---|
| `RELATES_TO` | Keyword ↔ Keyword, Inquiry ↔ Inquiry | 일반적 의미 연결 |
| `BELONGS_TO` | Inquiry/Activity → Subject, Keyword → Inquiry | 소속 |
| `MENTIONED_IN` | Keyword → Document, Keyword → Inquiry | 언급됨 |
| `DERIVED_FROM` | Inquiry/Keyword → Activity, * → Document | 파생 출처 |
| `OCCURRED_IN` | Inquiry/Activity → Period | 시점 |
| `INFLUENCES` | Inquiry → Subject, Activity → Subject | 영향 (성적 변화 추적용) |
| `EVOLVED_FROM` | Inquiry → Inquiry, Keyword → Keyword | 발전형 (학년 간 성장) |
| `CONTRADICTS` | Keyword ↔ Keyword, Inquiry ↔ Inquiry | 상충 관점 |
| `EVIDENCED_BY` | * → Document | ML 추출의 근거 |

방향성 주의: Neo4j 엣지는 본질적으로 방향이 있지만, 의미상 양방향인 `RELATES_TO`/`CONTRADICTS`는 **쿼리 시 방향 무시** (`MATCH (a)-[:RELATES_TO]-(b)`).

### 3.4 사용자 ↔ 그래프 격리
사용자별로 모든 노드에 `user_id`를 두는 방식 채택 (별도 그래프 인스턴스 X).
- 장점: 인프라 단순, 사용자 간 공유 가능 노드(시스템 키워드 등) 향후 확장 용이
- 단점: 누락 시 데이터 유출 위험 → **모든 쿼리의 첫 줄에 `user_id` 매칭 강제** (애플리케이션 레이어에서 강제)

---

## 4. 시나리오별 쿼리 예시

### 시나리오 A: "영어 탐구 노드 클릭 → 영어 성적 변화 보기"

```cypher
MATCH (i:Inquiry {node_id: $inquiry_id, user_id: $user_id})
      -[:BELONGS_TO]->(s:Subject)
      -[:OCCURRED_IN|INFLUENCES]->(p:Period)
RETURN s.external_refs.subject_id AS subject_id,
       collect(p.external_refs.period_id) AS period_ids
```
→ 반환된 `subject_id`, `period_ids`로 PostgreSQL `subject_grades` 조회.

### 시나리오 B: "영어 탐구에서 과학 키워드로 점프"

```cypher
MATCH (i:Inquiry {node_id: $inquiry_id, user_id: $user_id})
      -[:MENTIONED_IN|RELATES_TO*1..2]-(k:Keyword)
WHERE 'science' IN k.domain_tags
RETURN DISTINCT k
```

### 시나리오 C: "특정 키워드의 성장 궤적"

```cypher
MATCH path = (start:Keyword {node_id: $keyword_id, user_id: $user_id})
             -[:EVOLVED_FROM*]->(later:Keyword)
RETURN path
```

### 시나리오 D: "ML이 만든 노드의 근거 확인"

```cypher
MATCH (n {node_id: $node_id, user_id: $user_id})
      -[:EVIDENCED_BY]->(d:Document)
RETURN d.external_refs.document_section_id, d.excerpt
```

---

## 5. 그래프-RDB 동기화 규칙

| 시나리오 | 동작 |
|---|---|
| 학생이 PDF 업로드 | RDB에 `document_sections` 행 생성 → 각 행마다 Neo4j에 `Document` 노드 생성 (1:1) |
| ML이 키워드 추출 | `Keyword` 노드 생성 + 해당 `Document` 노드와 `MENTIONED_IN` 또는 `EVIDENCED_BY` 관계 생성 |
| 사용자가 텍스트 직접 수정 | `document_sections.version` +1, `Document.text_version` 동기화, P3 동기화 프로세스 트리거 |
| 사용자가 그래프 노드 삭제 | Neo4j 노드/엣지 삭제, RDB 원본 데이터는 보존 (감사 로그에 기록) |
| 양식 결과물 생성 | RDB `format_outputs`에 저장, 사용된 노드 ID는 `source_node_ids`에 배열로 |
| 음성 보고서 반영 승인 | `activity_reports.approval_status='approved'`, 새 `Activity`/`Keyword` 노드와 `DERIVED_FROM` 관계 생성 |

---

## 6. 인덱스·제약 요약

### Neo4j
- `CREATE CONSTRAINT FOR (n:Node) REQUIRE n.node_id IS UNIQUE`
- `CREATE INDEX FOR (n:Node) ON (n.user_id, n.type)`
- `CREATE FULLTEXT INDEX node_label_search FOR (n:Node) ON EACH [n.label, n.description]`
- 각 타입 라벨에도 동일 인덱스 적용 (`Keyword`, `Inquiry` 등)

### PostgreSQL
- 모든 사용자 데이터 테이블에 `(user_id, ...)` 복합 인덱스 우선
- `subject_grades(user_id, period_id)` 자주 조회 → 인덱스
- `audit_logs(target_user_id, created_at DESC)` — 사용자별 이력 조회
- `format_outputs(user_id, template_id)` — 버전 조회

---

## 7. 미정/추후 결정 사항

1. Neo4j 라벨 전략: 단일 `Node` 라벨 + `type` 속성 vs. 타입별 라벨(`:Keyword`, `:Inquiry`) — **현재는 타입별 라벨 + 공통 라벨(`:Node`) 병행 권장** (Cypher 가독성 ↑)
2. 노드 삭제 정책: 소프트 삭제(`is_deleted` 속성) vs. 하드 삭제 — 감사 요건과 함께 추후 결정
3. 그래프 변경 이력의 저장 방식: PostgreSQL `audit_logs`에 통합 vs. Neo4j 별도 이력 노드 — 일단 통합 방식 권장
4. 벡터 임베딩 저장 위치: Neo4j 노드 속성으로 둘지(Neo4j 5.x 벡터 인덱스), 별도 벡터 스토어로 분리할지
