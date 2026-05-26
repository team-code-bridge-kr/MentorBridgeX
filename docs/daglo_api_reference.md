# Daglo Cloud API 레퍼런스 (공식 OpenAPI 스펙 기반)

> **출처**: <https://apis.daglo.ai/docs> (Stoplight Elements UI)
> **원본 스펙**: <https://apis.daglo.ai/openapi.prod.yaml> → `docs/daglo_openapi.prod.yaml`에 사본 보관
> **수집일**: 2026-05-26
> **목적**: 2024년 구버전 가이드([`daglo_api_guide_LEGACY_2024.md`](daglo_api_guide_LEGACY_2024.md))와 현행 API의 차이를 정리하고, FastAPI 구현의 단일 진실 출처(SSOT)로 사용

---

## ⚠️ 구버전 가이드([`daglo_api_guide_LEGACY_2024.md`](daglo_api_guide_LEGACY_2024.md))와의 결정적 차이

| 항목 | 가이드 문서 | 실제 OpenAPI 스펙 |
|---|---|---|
| **Chat Completion** (`/nlp/v1/sync/chat/completions`) | ✅ 문서화됨 | ❌ **존재하지 않음** (deprecated) |
| **Summaries** (`/nlp/v1/sync/summaries`) | ❌ 없음 | ✅ **신규 (동기 요약)** |
| **Paragraphs** (`/nlp/v1/sync/paragraphs`) | ❌ 없음 | ✅ **신규 (단락 분리)** |
| **STT Async GET as file** (`/stt/v1/async/transcripts/{rid}/{format}`) | ❌ 없음 | ✅ **신규 (결과 파일 다운로드)** |
| **STT Sync 응답의 `rid`** | "있음" 명시 | ❌ 실제로 없음 (검증으로 확인) |
| **TTS `voice` 파라미터** | `ko_KR_Jimin`, `en_US_Olivia` 명시 | ⚠️ OpenAPI 스펙엔 `text`만 required로 정의, `voice` 미명시 (단, 검증 결과 실제로는 동작함) |
| **Chat에서 `elli` 모델** | 권장 모델로 명시 | ❌ 모델 자체가 무효 |
| **gRPC `StreamingRecognize`** | 문서화됨 | ❓ REST OpenAPI엔 없음 (별도 proto 스펙) |

**결론**: 가이드 문서는 2024-09 시점의 정보로, 약 1년 8개월 동안의 API 변경사항이 반영되지 않음. **이 레퍼런스(`daglo_api_reference.md`)를 우선 기준으로 사용하고, 가이드는 보조 참고로만 사용.**

---

## 📋 전체 엔드포인트 (9개 operation, 6개 path)

| # | Method | Path | Operation ID | 카테고리 |
|---|---|---|---|---|
| 1 | POST | `/stt/v1/sync/transcripts` | `post-stt-v1-sync-transcripts` | STT |
| 2 | POST | `/stt/v1/async/transcripts` | `post-stt-v1-async-transcripts` | STT |
| 3 | GET | `/stt/v1/async/transcripts/{rid}` | `get-stt-v1-async-transctips-rid` | STT |
| 4 | GET | `/stt/v1/async/transcripts/{rid}/{format}` | `get-stt-v1-async-transctips-rid-format` | STT 🆕 |
| 5 | POST | `/nlp/v1/sync/summaries` | `post-nlp-v1-sync-summaries` | NLP 🆕 |
| 6 | POST | `/nlp/v1/async/minutes` | `post-nlp-v1-async-minutes` | NLP |
| 7 | GET | `/nlp/v1/async/minutes/{rid}` | `get-nlp-v1-async-minutes-rid` | NLP |
| 8 | POST | `/nlp/v1/sync/paragraphs` | `post-nlp-v1-sync-paragraphs` | NLP 🆕 |
| 9 | POST | `/tts/v1/sync/audios` | `post-tts-v1-sync-audios` | TTS |

🆕 = 가이드 문서에 없는 신규 엔드포인트

---

## 🔐 공통 사항

### Base URL
```
https://apis.daglo.ai
```

### 인증
- **방식**: HTTP Bearer (JWT 토큰)
- **헤더**: `Authorization: Bearer <API_TOKEN>`
- **권한 (x-permission)**: 엔드포인트별로 권한 키가 분리되어 있음 (예: `stt-sync`, `nlp-async-minutes`). 토큰 발급 시 권한이 부여되어야 함

### Rate Limit
- **각 엔드포인트별 20 req/sec**
- 초과 시 `429 Too Many Requests`
- 반복·지속 초과 시 비정상 이용으로 간주되어 차단 가능

### 공통 에러 코드
| Code | 의미 |
|---|---|
| 200 | OK |
| 204 | No Content (결과 비어있음) |
| 400 | Bad Request — 요청 형식 오류 |
| 401 | Unauthorized — 토큰 무효 |
| 403 | Forbidden — 권한 없음 |
| 413 | Payload Too Large |
| 415 | Unsupported Media Type |
| 429 | Too Many Requests |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

### 공통 옵션 (대부분의 엔드포인트에서 사용 가능)
| 필드 | 타입 | 설명 |
|---|---|---|
| `returnElapsedTime` | boolean | true면 응답에 `elapsedTime` (밀리초) 포함 |
| `custom` | object | 요청 시 명시한 사용자 객체가 응답에 동일하게 echo됨 (자동화용) |

---

## 1️⃣ STT Sync — 짧은 음성 변환 (≤30초)

### `POST /stt/v1/sync/transcripts`

**Content-Type**: `multipart/form-data`

**요청 필드**:
| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `file` | file (binary) | ✅ | 변환할 오디오 파일 |
| `sttConfig` | object | ❌ | STT 옵션 (아래) |

**`sttConfig` 옵션** (sync에서 사용 가능):
- `keywordBoost.enable` (bool) + `keywordBoost.keywords` (string[]) — 키워드 부스팅
- 기타 `model` 등

**응답** (200):
```json
{
  "sttResult": {
    "transcript": "변환된 텍스트"
  }
}
```

> ⚠️ **가이드의 `rid` 필드는 실제 응답에 없음** (검증 완료).

**검증 상태**: ✅ 완료 — `test_tts_ko.wav` → "안녕하세요. 멘토 브리지 엑스 테스트입니다."

---

## 2️⃣ STT Async — 긴 음성 변환 (URL 참조, 최대 4시간/2GB)

### `POST /stt/v1/async/transcripts`

**Content-Type**: `application/json`

**요청 본문**:
```jsonc
{
  "audio": {
    "source": { "url": "https://example.com/audio.wav" }
  },
  "sttConfig": {
    // 부가기능 옵션
    "speakerDiarization": { "enable": true },
    "keywordBoost": {
      "enable": true,
      "keywords": ["다글로", "클라우드"]
    }
  },
  "nlpConfig": {
    "sentimentAnalysis": { "enable": true },
    "keywordExtraction": { "enable": true }
  },
  "callback": {
    "url": "https://your-server/callback"  // 선택, 완료 시 POST됨
  },
  "returnElapsedTime": false,
  "custom": { "app_id": "..." }
}
```

**응답** (200, 즉시):
```json
{ "rid": "<request-id>" }
```

### `GET /stt/v1/async/transcripts/{rid}` — 결과 폴링

**응답 status 값**:
| status | 의미 | 비고 |
|---|---|---|
| `requested` | 큐 진입 | progress = 0 |
| `processing` | 변환 중 | progress 1~99 |
| `transcribed` / `completed` | 완료 | 결과 포함 |
| `file_error` | 파일 다운로드 실패 | terminal |
| `input_error` | 요청 값 오류 | terminal |
| `processing_error` | 변환 중 오류 | terminal |

**완료 응답 예시**:
```json
{
  "rid": "...",
  "status": "transcribed",
  "progress": 100,
  "sttResults": [
    {
      "transcript": "전체 텍스트",
      "words": [
        {
          "word": "안녕하세요. ",
          "speaker": "1",
          "startTime": { "seconds": "0", "nanos": 60000000 },
          "endTime":   { "seconds": "0", "nanos": 860000000 },
          "segmentId": "1"
        }
      ],
      "keywords": ["키워드1"],
      "sentiment": "Negative",
      "sentimentScore": { "neutral": 22.5, "negative": 61.2, "positive": 16.2 }
    }
  ]
}
```

### `GET /stt/v1/async/transcripts/{rid}/{format}` 🆕 — 결과를 파일로 다운로드

가이드 문서에 없는 신규 엔드포인트. `format`은 텍스트/SRT/VTT 등의 자막 포맷으로 추정 (스펙 본문 확인 필요).

**검증 상태**:
- POST: ✅ 완료 (rid 발급)
- GET 폴링: ❌ 가이드 샘플 URL 죽음 (`file_error`) → Phase A3에서 자체 호스팅 wav로 재검증 예정

---

## 3️⃣ STT 부가기능 (Async의 옵션 플래그)

> 별도 엔드포인트가 아닌 **`/stt/v1/async/transcripts` 요청 본문의 옵션**으로 활성화

### 화자 분리 (Speaker Diarization)
```json
{ "sttConfig": { "speakerDiarization": { "enable": true } } }
```
→ 응답의 `words[].speaker`에 화자 ID ("1", "2", ...) 채워짐

### 키워드 부스팅 (Keyword Boost) — Sync에서도 사용 가능
```json
{
  "sttConfig": {
    "keywordBoost": {
      "enable": true,
      "keywords": ["다글로", "클라우드"]
    }
  }
}
```
→ 특정 단어 인식 정확도 향상 (단, 미등장 시 역효과 가능)

### 감정 분석 (Sentiment Analysis)
```json
{ "nlpConfig": { "sentimentAnalysis": { "enable": true } } }
```
→ `sttResults[].sentiment` (positive/negative/neutral) + `sentimentScore`

### 키워드 추출 (Keyword Extraction)
```json
{ "nlpConfig": { "keywordExtraction": { "enable": true } } }
```
→ `sttResults[].keywords` (string[])

### 동시 사용
```json
{
  "audio": { "source": { "url": "..." } },
  "sttConfig": {
    "speakerDiarization": { "enable": true },
    "keywordBoost": { "enable": true, "keywords": ["..."] }
  },
  "nlpConfig": {
    "sentimentAnalysis": { "enable": true },
    "keywordExtraction": { "enable": true }
  }
}
```

---

## 4️⃣ STT 실시간 (gRPC StreamingRecognize)

⚠️ **REST OpenAPI 스펙에 없음.** 가이드 문서의 proto 정의를 그대로 사용해야 함 (별도 검증 필요).

- 서버: `apis.daglo.ai` (gRPC, TLS)
- 인증: gRPC metadata에 `authorization: Bearer <API_TOKEN>`
- 첫 메시지: `RecognitionConfig` (언어 코드, interim_results)
- 이후: `audio_content` (LINEAR16, 16000Hz, 모노)
- 제약: 한국어/영어만, 단일 스트림 최대 6시간

---

## 5️⃣ NLP — 텍스트 요약 (Summaries) 🆕

### `POST /nlp/v1/sync/summaries`

**가이드 문서에 없는 신규 엔드포인트**. 대화/문장을 동기적으로 요약. (Chat Completion의 실질적 후속 기능으로 보임)

**요청 본문**:
```jsonc
{
  "text": "단일 문자열" ,
  // 또는
  "text": [
    { "speaker": "상담원", "text": "안녕하세요. 무엇을 도와드릴까요?" },
    { "speaker": "고객", "text": "..." }
  ],
  "nlpConfig": {
    "summary": {
      "enable": true,
      "model": "dialogue",                  // 현재 dialogue만 지원
      "outputSizeOption": "medium",         // small | medium | large
      "maxCharsPerParagraph": 6000          // 명시 시 outputSizeOption 무시
    },
    "keywordExtraction": {
      "enable": true,
      "maxCount": 10,
      "extractAdjectives": true             // 형용사 키워드 추가 추출
    }
  },
  "returnElapsedTime": false,
  "custom": { "app_id": "..." }
}
```

**응답** (200):
```json
{
  "summaries": ["문단별 요약 문자열", "..."],
  "keywords": ["키워드1", "키워드2"],
  "keywordsAdjectives": ["빠른", "친절한"]
}
```

**검증 상태**: ❌ 미검증 (Phase A7에서 진행 예정)

---

## 6️⃣ NLP — 회의록 요약 (Minutes, Async)

### `POST /nlp/v1/async/minutes`

**요청 본문**:
```json
{ "text": "<회의 전체 텍스트>" }
```

**응답** (200, 즉시):
```json
{ "rid": "<request-id>" }
```

### `GET /nlp/v1/async/minutes/{rid}` — 결과 폴링

**status 값**:
| status | 의미 |
|---|---|
| `requested` | 요청 시작 |
| `processing` | 요약 중 |
| `completed` | 완료 |
| `input_error` | 요청 오류 |
| `processing_error` | 처리 중 오류 |

**완료 응답**:
```json
{
  "rid": "...",
  "status": "completed",
  "progress": 100,
  "title": "전체 제목",
  "minutes": [
    {
      "title": "소제목 1",
      "bullets": [
        { "isImportant": false, "text": "summary 1" },
        { "isImportant": true,  "text": "summary 2 (중요)" }
      ]
    }
  ]
}
```

**Callback URL**도 지원 (POST 요청 시 명시).

**검증 상태**: ⏳ Phase A2에서 진행 중 (rid 발급됨: `fIykbmsy3sulTNG6t9aQ7`)

---

## 7️⃣ NLP — 단락 분리 (Paragraphs) 🆕

### `POST /nlp/v1/sync/paragraphs`

**가이드 문서에 없는 신규 엔드포인트**. 문장 배열을 받아 의미적으로 비슷한 문장끼리 묶어 단락 시작 인덱스를 반환.

**요청 본문**:
```json
{
  "sentences": [
    "첫 번째 문장입니다.",
    "두 번째 문장입니다.",
    "주제가 바뀐 세 번째 문장입니다.",
    "..."
  ],
  "charsPerParagraph": 2500,
  "returnElapsedTime": false,
  "custom": {}
}
```

**응답** (200):
```json
{
  "startIndexes": [0, 2, 5],
  "elapsedTime": 234,
  "custom": {}
}
```

→ `startIndexes`의 각 값은 해당 단락이 시작되는 문장 인덱스 (0-base). 배열 길이 = 분리된 단락 개수.

**검증 상태**: ❌ 미검증 (Phase A8에서 진행 예정)

---

## 8️⃣ TTS — 텍스트→음성

### `POST /tts/v1/sync/audios`

**요청 본문** (OpenAPI 스펙 기준):
```json
{ "text": "변환할 텍스트" }
```

> ⚠️ **OpenAPI 스펙엔 `voice` 필드가 명시되지 않았지만, 검증 결과 `voice` 필드를 보내면 실제로 동작함.** 가이드 문서의 voice 값 (`ko_KR_Jimin`, `en_US_Olivia`)을 그대로 사용 가능.

**응답** (200):
- `Content-Type: audio/wav`
- 본문: WAV 바이너리 (RIFF/WAVE, PCM 16bit, mono, 16000Hz — 검증 확인됨)

**검증 상태**: ✅ 완료 — 영어/한국어 모두 200, 유효 WAV 응답

---

## 🚫 deprecated/제거된 엔드포인트

### Chat Completion (`POST /nlp/v1/sync/chat/completions`)
- 가이드 문서에 상세히 기술되어 있으나 **현재 OpenAPI 스펙에 존재하지 않음**
- 호출 시: 200/404가 아닌 **503 `Request timeout` (60초 후)** 응답 — 라우터는 남아있으나 실제 처리 핸들러가 동작하지 않는 것으로 추정
- **대체 권고**: 동기 텍스트 처리는 `/nlp/v1/sync/summaries`, 대화형 응답이 필요하면 외부 LLM (Claude, GPT 등) 사용

---

## 🔄 FastAPI 매핑 계획

| 우리 엔드포인트 | Daglo 엔드포인트 | 비고 |
|---|---|---|
| `POST /api/v1/stt/sync` | `POST /stt/v1/sync/transcripts` | multipart 그대로 |
| `POST /api/v1/stt/async` + `GET /{rid}` | `POST /stt/v1/async/transcripts` + GET | 옵션을 명확한 Pydantic 필드로 노출 |
| `GET /api/v1/stt/async/{rid}/download?format=...` | `GET /stt/v1/async/transcripts/{rid}/{format}` | 결과 다운로드 |
| `WS /api/v1/stt/realtime` | gRPC `StreamingRecognize` | WebSocket ↔ gRPC 어댑터 |
| `POST /api/v1/nlp/summaries` | `POST /nlp/v1/sync/summaries` | Chat 대체 |
| `POST /api/v1/nlp/minutes` + `GET /{rid}` | `POST /nlp/v1/async/minutes` + GET | |
| `POST /api/v1/nlp/paragraphs` | `POST /nlp/v1/sync/paragraphs` | |
| `POST /api/v1/tts` | `POST /tts/v1/sync/audios` | `StreamingResponse(audio/wav)` |

**총 8개 라우트** (Chat 제외, REST 7개 + WS 1개)

---

## 🔗 참고 링크

- **공식 문서 UI**: <https://apis.daglo.ai/docs>
- **공식 OpenAPI 스펙 (YAML)**: <https://apis.daglo.ai/openapi.prod.yaml>
- **로컬 사본**: [daglo_openapi.prod.yaml](daglo_openapi.prod.yaml)
- **2024년 가이드 (참고용, 구버전)**: [daglo_api_guide_LEGACY_2024.md](daglo_api_guide_LEGACY_2024.md) — 일부 정보 outdated, gRPC 예제만 유효
- **고객 지원**: cs@daglo.ai

## 📝 업데이트 이력

- 2026-05-26 — 공식 OpenAPI 스펙 기반 초안 작성. 가이드 문서와의 차이점 정리.
