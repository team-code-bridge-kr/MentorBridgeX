# MentorBridgeX Backend — STT API 사용 가이드

> **대상**: 백엔드 개발자, 프론트엔드 개발자, 테스트/QA, 운영자
> **범위**: `backend/app/features/stt/`가 노출하는 5개 REST 엔드포인트 + 1개 WebSocket
> **버전**: v0.1 (2026-05-26)
> **관련 문서**:
> - [Daglo API 레퍼런스](daglo_api_reference.md) — 외부 의존 API 명세
> - [Daglo 공식 OpenAPI 스펙](daglo_openapi.prod.yaml)
> - 백엔드 코드: [`backend/app/features/stt/`](../backend/app/features/stt/)

---

## 📋 엔드포인트 한눈에

| # | Method | Path | 한 줄 설명 | 호출 주체 |
|---|---|---|---|---|
| 1 | `GET` | `/healthz` | 서버 헬스체크 | 모니터링, LB |
| 2 | `POST` | `/v1/stt/async` | 긴 음성 비동기 STT 요청 (rid 발급) | 백엔드 내부 |
| 3 | `GET` | `/v1/stt/async/{rid}` | 결과 폴링 | 백엔드 내부 |
| 4 | `GET` | `/v1/stt/async/{rid}/{fmt}` | 결과를 자막 파일로 다운로드 | 사용자(선택) |
| 5 | `POST` | `/v1/stt/sync` | 30초 이하 음성 즉시 변환 (테스트용) | 디버그/QA |
| 6 | `WS` | `/v1/stt/realtime` | 라이브 STT (gRPC 어댑터, v0.1은 골격) | 프론트 (모바일) |

> ⚠️ **2~4번은 프론트가 직접 호출하지 않음.** 프론트는 `/v1/voice-sessions/...` 같은 상위 API를 호출하고, 그 내부에서 STT API가 자동 트리거됨. 자세한 UX 흐름은 각 엔드포인트 섹션의 "프론트 입력 출처" 표 참고.

---

## 1️⃣ `GET /healthz`

서버가 살아있는지 확인하는 가장 단순한 엔드포인트.

### 요청
- 인증 ❌, body ❌, 파라미터 ❌

```
GET /healthz
```

### 응답 (200)
```json
{ "status": "ok" }
```

### 용도
- 로컬 개발 확인 / CI 배포 검증 / 쿠버네티스 readiness probe / UptimeRobot 등 외부 모니터링

### ⚠️ 주의
이 응답이 200이라고 해서 Daglo 토큰까지 유효한 것은 **아닙니다**. FastAPI 자체 응답만 보장.

---

## 2️⃣ `POST /v1/stt/async` — 비동기 STT 요청

긴 음성(녹음 파일)을 텍스트로 변환 요청. **즉시 결과 없음**, `rid`만 발급. 결과는 #3으로 폴링 또는 callback으로 수신.

### 요청 필드 상세

| 필드 | 타입 | 필수 | 설명 | 프론트 입력 출처 |
|---|---|---|---|---|
| `audio_url` | string | ✅ | Daglo가 다운로드할 공개 URL (S3 presigned 등) | ❌ 백엔드가 S3 업로드 후 자동 생성 |
| `speaker_diarization` | bool | ❌ | 화자 분리 (응답의 `words[].speaker` 채워짐) | ✅ UI 토글 (그룹 녹음 시 ON) |
| `keyword_boost` | string[] \| null | ❌ | 인식 정확도를 높일 키워드 목록. 비어있거나 null이면 옵션 자체 미전송 | ❌ 학생 그래프 DB에서 자동 추출 |
| `keyword_extraction` | bool | ❌ | 응답에 `keywords` 배열 추가 | 🟡 기본 true 고정, 토글 가능 |
| `callback.url` | string | ❌ | Daglo가 완료 시 POST할 URL | ❌ 환경변수 (내부 webhook) |
| `callback.headers` | object | ❌ | 콜백 호출 시 추가 헤더 | ❌ 내부 시크릿 |
| `custom` | object | ❌ | 응답에 그대로 echo되는 사용자 객체 (추적용) | ❌ 백엔드가 voice_session_id 등 자동 주입 |

### 실제 사용 시나리오 ⭐

> **시나리오**: 학생이 1시간 멘토링 세션을 녹음 → 우리 앱에 업로드 → 백엔드가 S3 저장 → Daglo에 비동기 STT 요청.

#### 요청 (운영 실제 호출)
```json
{
  "audio_url": "https://mentorbridgex-audio.s3.ap-northeast-2.amazonaws.com/sessions/vs-2026-05-26-001.wav?X-Amz-Signature=abc123",
  "speaker_diarization": true,
  "keyword_boost": [
    "양자컴퓨팅",
    "큐비트",
    "파이썬",
    "김멘토"
  ],
  "keyword_extraction": true,
  "callback": {
    "url": "https://api.mentorbridgex.com/v1/internal/daglo-callback",
    "headers": {
      "X-Internal-Token": "callback-secret-abc",
      "X-Session-Id": "vs-001"
    }
  },
  "custom": {
    "voice_session_id": "vs-2026-05-26-001",
    "student_id": "student-42",
    "mentor_id": "mentor-7"
  }
}
```

#### 응답 (200)
```json
{
  "rid": "BkSdF7mP2qN9wXy8L3vQ-",
  "custom": {
    "voice_session_id": "vs-2026-05-26-001",
    "student_id": "student-42",
    "mentor_id": "mentor-7"
  }
}
```

→ 받은 `rid`를 DB의 `voice_sessions.daglo_rid`에 저장 → 폴링 또는 callback 대기.

### 최소 요청 (옵션 없음)
```json
{ "audio_url": "https://example.com/audio.wav" }
```

응답:
```json
{ "rid": "<발급된 작업ID>" }
```

### 프론트엔드 UX 매핑

```
[학생이 보는 UI]                    [백엔드 변환]
─────────────────────              ─────────────────────────
🎙 녹음 (마이크 캡처)        →     audio_url (S3 자동 업로드)
☑️ 여러명이 함께 녹음        →     speaker_diarization: true
                                    keyword_boost: [학생 그래프 DB에서 자동]
                                    keyword_extraction: true (기본)
                                    callback: 백엔드 내부 webhook
                                    custom: { voice_session_id 자동 }
```

**→ 사용자는 토글 1개만 만짐**, 나머지 6개 필드는 백엔드가 자동.

### 실패 응답

| HTTP | 의미 | 대응 |
|---|---|---|
| 400 | `audio_url` 누락/형식 오류 | 클라이언트 측 수정 |
| 401 | Daglo 토큰 무효 | `.env`의 `DAGLO_API_TOKEN` 재확인 |
| 429 | Rate limit (20 req/sec) | 백오프 후 재시도 |
| 500/503 | Daglo 서버 일시 장애 | 1~5초 후 재시도 |

---

## 3️⃣ `GET /v1/stt/async/{rid}` — 결과 폴링

#2에서 받은 `rid`로 결과를 조회. **status가 terminal(`transcribed`, `completed`, `*_error`)될 때까지 반복 호출**.

### Path 파라미터

| 이름 | 설명 | 예시 |
|---|---|---|
| `rid` | #2 응답의 `rid` | `BkSdF7mP2qN9wXy8L3vQ-` |

### 응답 필드 상세

| 필드 | 타입 | 설명 |
|---|---|---|
| `rid` | string | 요청 ID |
| `status` | enum | `requested` / `processing` / `transcribed` / `completed` / `file_error` / `input_error` / `processing_error` |
| `progress` | int | 0~100 |
| `sttResults` | object[] | 변환 결과 배열 (완료 시) |
| `sttResults[].transcript` | string | 전체 텍스트 |
| `sttResults[].words` | object[] | 단어 단위 (화자/타임스탬프 포함, 화자분리 활성 시) |
| `sttResults[].keywords` | string[] | 추출된 키워드 (extraction 활성 시) |
| `message` | string | 에러 시 부가 정보 |
| `custom` | object | #2 요청의 `custom`이 echo |

### 실제 사용 시나리오 ⭐

#### 폴링 중 (진행률 43%)
```bash
curl http://127.0.0.1:8000/v1/stt/async/BkSdF7mP2qN9wXy8L3vQ-
```

응답:
```json
{
  "rid": "BkSdF7mP2qN9wXy8L3vQ-",
  "status": "processing",
  "progress": 43,
  "custom": { "voice_session_id": "vs-2026-05-26-001" }
}
```

#### 완료 (실제 멘토링 데이터 가정)
```json
{
  "rid": "BkSdF7mP2qN9wXy8L3vQ-",
  "status": "transcribed",
  "progress": 100,
  "sttResults": [
    {
      "transcript": "오늘은 양자컴퓨팅 기초에 대해 이야기해볼까요. 큐비트의 개념부터 시작해서...",
      "words": [
        {
          "word": "오늘은 ",
          "speaker": "1",
          "startTime": { "seconds": "0", "nanos": 120000000 },
          "endTime":   { "seconds": "0", "nanos": 580000000 },
          "segmentId": "1"
        },
        {
          "word": "양자컴퓨팅 ",
          "speaker": "1",
          "startTime": { "seconds": "0", "nanos": 580000000 },
          "endTime":   { "seconds": "1", "nanos": 100000000 },
          "segmentId": "1"
        },
        {
          "word": "네 ",
          "speaker": "2",
          "startTime": { "seconds": "12", "nanos": 200000000 },
          "endTime":   { "seconds": "12", "nanos": 400000000 },
          "segmentId": "5"
        }
      ],
      "keywords": ["양자컴퓨팅", "큐비트", "중첩 상태", "측정"]
    }
  ],
  "custom": { "voice_session_id": "vs-2026-05-26-001" }
}
```

→ 화자 `"1"` = 멘토, `"2"` = 학생 (Daglo는 단순 라벨링만, 누가 누군지는 우리가 매핑).

#### 실패 (file_error)
```json
{
  "rid": "BkSdF7mP2qN9wXy8L3vQ-",
  "status": "file_error",
  "progress": 10,
  "message": "Could not download audio file from https://..."
}
```

### 폴링 권장 사항

| 항목 | 권장값 |
|---|---|
| 최초 폴링 간격 | 3초 |
| 백오프 | exponential (3 → 6 → 12 → 30초 상한) |
| 최대 대기 | 1시간 (4시간 오디오 기준 안전치) |
| terminal 상태 | `transcribed`, `completed`, `file_error`, `input_error`, `processing_error` |
| **GET 자체 비용** | **0원** (조회는 과금 안 됨) |

### 프론트엔드 UX 매핑

```
[학생이 보는 UI]                    [백엔드]
─────────────────────              ─────────────────────────
⏳ 변환 중... 43%           ←     GET /v1/stt/async/{rid}
                                    polling every 3s
                                    응답의 progress 그대로 표시
                                    
✅ 완료, 결과 보기           ←     status == "transcribed"
                                    sttResults를 UI에 매핑
                                    화자별 색깔 다르게 표시
                                    keywords를 칩으로 표시
```

---

## 4️⃣ `GET /v1/stt/async/{rid}/{fmt}` — 결과 파일 다운로드

Daglo가 결과를 자막 파일(SRT/VTT 등) 형태로 반환. **조건부 채택** (현재 기획서엔 없는 기능).

### Path 파라미터

| 이름 | 설명 | 예시 값 |
|---|---|---|
| `rid` | 요청 ID | `BkSdF7mP2qN9wXy8L3vQ-` |
| `fmt` | 파일 포맷 | `srt`, `vtt` (정확한 enum은 Daglo 미확정) |

### 실제 사용 시나리오 ⭐

> **시나리오**: 학생이 멘토링 영상에 자막을 입히고 싶어서 SRT 파일 다운로드.

```bash
curl http://127.0.0.1:8000/v1/stt/async/BkSdF7mP2qN9wXy8L3vQ-/srt -o subtitle.srt
```

응답 (200): 바이너리 파일

```
1
00:00:00,120 --> 00:00:00,580
오늘은

2
00:00:00,580 --> 00:00:01,100
양자컴퓨팅
...
```

### 프론트엔드 UX 매핑

```
[학생이 보는 UI]                    [백엔드]
─────────────────────              ─────────────────────────
[SRT 다운로드] 버튼          →     GET /v1/stt/async/{rid}/srt
                                    Response를 그대로 사용자에게
```

→ 사용자가 명시적으로 누르는 액션. 자동 호출 없음.

---

## 5️⃣ `POST /v1/stt/sync` — 짧은 음성 즉시 변환

30초 이하 음성을 **즉시** 텍스트로 변환. multipart 파일 업로드.

### 요청 필드

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `file` | binary | ✅ | 30초 이하 오디오 파일 (wav/mp3 등) |

### 실제 사용 시나리오 ⭐

> **시나리오**: QA 엔지니어가 새 음성 인식 정확도를 빠르게 점검. Swagger UI에서 wav 업로드.

#### 요청 (PowerShell)
```powershell
curl.exe -X POST "http://127.0.0.1:8000/v1/stt/sync" `
  -F "file=@test_tts_ko.wav"
```

#### 응답 (200)
```json
{
  "transcript": "안녕하세요. 멘토 브리지 엑스 테스트입니다.",
  "rid": null
}
```

> ⚠️ `rid`는 **항상 null**입니다. Daglo가 sync 응답에 rid를 안 줍니다 (가이드 문서와 다른 실측 결과).

### 프론트엔드 UX 매핑

| 누구 | 어디서 | 어떻게 |
|---|---|---|
| 일반 사용자 | ❌ | 사용 안 함 |
| 어드민 콘솔 | "STT 디버그" 화면 | 파일 업로드 위젯 |
| QA | Swagger UI | "Try it out" |

→ **운영자/디버그 전용**. 실 사용자 흐름에는 등장하지 않음.

### ⚠️ 제약
- **30초 초과 시 400 또는 file_error 가능성**. 긴 음성은 #2 (Async)로.

---

## 6️⃣ `WS /v1/stt/realtime` — 실시간 STT

WebSocket 양방향. 클라이언트가 오디오 청크 보내고, 서버는 라이브 자막(`partial`/`final`)을 push. 내부적으로 Daglo gRPC `StreamingRecognize`로 brokerage.

### 근거 (기획서 인용)

| 항목 | 출처 |
|---|---|
| 필수(必) 기능 등록 | [참고/feature_spec.md:188](../참고/feature_spec.md) |
| partial/final 흐름 | [참고/feature_spec.md:204-205](../참고/feature_spec.md) |
| 사용자-facing 엔드포인트(`/v1/voice-sessions/{id}/stream`)와의 관계 | [참고/api_catalog.md:311](../참고/api_catalog.md) |
| NFR 500ms / 1500ms 지연 | [참고/nfr.md:110](../참고/nfr.md) |
| 송신/수신 권한 | [참고/permission_matrix.md:213-214](../참고/permission_matrix.md) |
| 감사 로그 이벤트 | [참고/audit_log_catalog.md:228-229](../참고/audit_log_catalog.md) |
| Daglo proto/인증 | [docs/daglo_api_guide_LEGACY_2024.md:295-334](daglo_api_guide_LEGACY_2024.md), [:444](daglo_api_guide_LEGACY_2024.md) |

> ⚠️ **v0.1의 `/v1/stt/realtime`은 내부 어댑터**. v1.0 운영 시엔 사용자-facing `/v1/voice-sessions/{id}/stream`이 이를 내부 호출.

### 메시지 프로토콜

#### 클라이언트 → 서버

| 타입 | 내용 |
|---|---|
| **binary** | LINEAR16 16kHz mono PCM 청크 (~0.25초 권장) |
| **text "stop"** | 명시적 종료 신호 (옵션, disconnect로 자동 처리도 가능) |
| **disconnect** | 자연스러운 종료 |

#### 서버 → 클라이언트 (모두 JSON)

| 메시지 | 의미 |
|---|---|
| `{"type": "partial", "transcript": "...", "is_final": false, "language": "ko-KR"}` | 부분 결과 (실시간 자막) |
| `{"type": "final",   "transcript": "...", "is_final": true,  "language": "ko-KR"}` | 확정 결과 (문장 단위) |
| `{"type": "done"}` | 정상 종료 |
| `{"type": "error", "code": "...", "message": "..."}` | gRPC/내부 오류 |

### 쿼리스트링 옵션

| 파라미터 | 기본 | 설명 |
|---|---|---|
| `lang` | `ko-KR` | `ko-KR` / `en-US` / `mixed` (BCP-47) |
| `interim` | `true` | `false`면 final 결과만 받음 |

예: `ws://host/v1/stt/realtime?lang=en-US&interim=false`

### 실제 사용 시나리오 ⭐

> **시나리오**: 학생이 멘토링 세션 녹음을 시작 → 모바일 화면 하단에 실시간 자막 표시.

#### 클라이언트 (Flutter 의사코드)
```dart
final ws = WebSocket('wss://api.mentorbridgex.com/v1/stt/realtime?lang=ko-KR');
ws.onMessage((msg) {
  final j = json.decode(msg);
  if (j['type'] == 'partial') {
    captionBar.setLive(j['transcript']);       // 흐릿한 회색
  } else if (j['type'] == 'final') {
    captionBar.confirm(j['transcript']);       // 검정색 확정
    transcriptHistory.add(j['transcript']);
  }
});
// 마이크 캡처: 16kHz mono PCM → 250ms 청크
recorder.onChunk((bytes) => ws.sendBinary(bytes));
recorder.onStop(() => ws.sendText('stop'));
```

#### 서버 응답 흐름 (실제 통신 예시)
```
[클라]  binary: PCM 0~250ms
[서버]  →  (Daglo로 forward)
[클라]  binary: PCM 250~500ms
[서버]  ←  {"type":"partial","transcript":"오늘은","is_final":false,"language":"ko-KR"}
[클라]  binary: PCM 500~750ms
[서버]  ←  {"type":"partial","transcript":"오늘은 양자컴","is_final":false,"language":"ko-KR"}
...
[클라]  binary: PCM 2.5~2.75s
[서버]  ←  {"type":"final","transcript":"오늘은 양자컴퓨팅 기초에 대해","is_final":true,"language":"ko-KR"}
[클라]  text: "stop"
[서버]  ←  {"type":"done"}
        (WS close)
```

### 프론트엔드 UX 매핑

```
[학생이 보는 UI]                    [백엔드]
────────────────────────           ─────────────────────────
🎙 [녹음 시작]              →     ws.connect()
                                   
📱 실시간 자막 표시               
  ┌──────────────────────┐         
  │ 오늘은 양자컴...      │  ←    {"type":"partial"}
  │ (회색, 흐릿)          │         
  └──────────────────────┘         
  ┌──────────────────────┐         
  │ 오늘은 양자컴퓨팅      │  ←    {"type":"final"}
  │ 기초에 대해...        │         
  │ (검정, 확정)          │         
  └──────────────────────┘         
                                   
🎤 [정지]                   →     ws.send('stop')
                            ←     {"type":"done"}, close
```

→ partial = "타이핑 중", final = "확정 문장". UX적으로 둘 다 표시.

### 🚨 에러 처리

| 상황 | 응답 | 클라이언트 대응 |
|---|---|---|
| Daglo 토큰 무효 | `{"type":"error","code":"UNAUTHENTICATED",...}` + close(1011) | 사용자에게 안내, 재로그인 유도 |
| Daglo 일시 장애 | `{"type":"error","code":"UNAVAILABLE",...}` + close | 재연결 시도 (지수 백오프) |
| 청크 형식 불일치 | gRPC 응답 빈 채로 진행 | 클라이언트가 16kHz mono PCM 송신하는지 점검 |
| 클라이언트 disconnect | 자동 정리, 별도 알림 없음 | — |

> ⚠️ **Daglo gRPC는 에러 발생 시 스트리밍이 종료됨** ([daglo_api_guide_LEGACY_2024.md:448](daglo_api_guide_LEGACY_2024.md)). 재연결은 클라이언트 책임.

### 🚧 v0.1 상태

| 항목 | 상태 |
|---|---|
| proto 정의 | ✅ [backend/app/core/daglo/proto/speech.proto](../backend/app/core/daglo/proto/speech.proto) |
| gRPC 클라이언트 (비동기) | ✅ [backend/app/core/daglo/grpc_client.py](../backend/app/core/daglo/grpc_client.py) |
| STTProvider 추상화 | ✅ F2-08 준수, [backend/app/features/stt/provider.py](../backend/app/features/stt/provider.py) |
| WS 어댑터 | ✅ [backend/app/features/stt/routes.py](../backend/app/features/stt/routes.py) |
| 단위 테스트 (mock gRPC) | ✅ 5건 (gRPC client 2 + WS adapter 3) |
| **실 Daglo gRPC 라이브 검증** | ❌ 마이크 + 토큰 비용 부담으로 미실행 (Phase A6) |
| 인증/권한 (참여자 송신 제한) | ❌ voice-sessions 도메인에서 통합 예정 |
| NFR 500ms 지연 측정 | ❌ 부하 테스트 단계 |

### 🧪 로컬에서 빠르게 테스트해보기

#### Swagger UI에 WS는 안 나타남 — 별도 도구 필요

```bash
# 1) 서버 켜기
python -m uvicorn app.main:app --reload

# 2) websocat 설치 (https://github.com/vi/websocat)
# 또는 Python 클라이언트 사용

# 3) Python 클라이언트로 빠른 시도 (실 Daglo 호출이라 토큰 정상이어야)
python -c "
import asyncio, websockets, json
async def main():
    async with websockets.connect('ws://127.0.0.1:8000/v1/stt/realtime') as ws:
        # 가짜 무음 청크 (실제로는 마이크 PCM)
        await ws.send(b'\\x00' * 8000)
        await ws.send('stop')
        while True:
            msg = await ws.recv()
            print(msg)
            if json.loads(msg).get('type') in ('done', 'error'):
                break
asyncio.run(main())
"
```

→ 실 마이크 검증은 Flutter 클라이언트 또는 별도 PyAudio 스크립트로.

### 💡 핵심 한 줄

> **양방향 WebSocket으로 마이크 PCM 받아서 Daglo gRPC로 실시간 변환, partial/final JSON으로 push.**
> **F2-02 필수 기능 충족. 인증/세션 통합은 voice-sessions 도메인 작업 후 v1.0에서.**

---

## 🔁 전체 흐름 (사용자 시나리오)

### 시나리오 A: 사용자가 멘토링 세션 녹음

```
1. 학생: 앱에서 [녹음 시작] 누름
        ↓
2. Flutter: WS /v1/stt/realtime 연결 + 오디오 청크 전송
        ↓
3. 백엔드: 라이브 자막 push → UI 표시
        ↓
4. 학생: [정지] 누름 → wav 파일 업로드
        ↓
5. Flutter: POST /v1/voice-sessions (multipart)  ← 기획서 엔드포인트
        ↓
6. 백엔드 내부:
   - S3 업로드
   - voice_sessions DB row 생성
   - 학생 그래프 키워드 수집
   - POST /v1/stt/async 내부 호출 ← 우리가 만든 #2
        ↓
7. 백엔드 내부: GET /v1/stt/async/{rid} 폴링 또는 callback 대기 ← #3
        ↓
8. 완료 → activity_reports 생성 → 학생에게 푸시 알림
        ↓
9. 학생: [보고서 보기] → 화자별 transcript + 키워드 chip + 그래프 매칭 제안
```

### 시나리오 B: QA가 새 wav로 정확도 빠른 점검

```
1. QA: Swagger UI 접속 (/docs)
        ↓
2. POST /v1/stt/sync 펼침 ← #5
        ↓
3. [Try it out] → 파일 선택 → Execute
        ↓
4. 응답 transcript 확인 → 정확도 평가
```

---

## 🧪 빠른 호출 레시피 모음

### 헬스체크
```bash
curl http://127.0.0.1:8000/healthz
```

### Sync STT (개발 환경, 짧은 wav)
```bash
curl -X POST http://127.0.0.1:8000/v1/stt/sync -F "file=@test.wav"
```

### Async STT 제출 (최소)
```bash
curl -X POST http://127.0.0.1:8000/v1/stt/async \
  -H "Content-Type: application/json" \
  -d '{"audio_url": "https://example.com/a.wav"}'
```

### Async STT 제출 (옵션 풀 활용)
```bash
curl -X POST http://127.0.0.1:8000/v1/stt/async \
  -H "Content-Type: application/json" \
  -d '{
    "audio_url": "https://example.com/meeting.wav",
    "speaker_diarization": true,
    "keyword_boost": ["멘토브릿지엑스"],
    "keyword_extraction": true,
    "custom": {"session_id": "demo-001"}
  }'
```

### 결과 폴링
```bash
curl http://127.0.0.1:8000/v1/stt/async/<rid>
```

### 자막 다운로드
```bash
curl http://127.0.0.1:8000/v1/stt/async/<rid>/srt -o subtitle.srt
```

---

## 🛡 보안 & 운영 주의사항

| 항목 | 메모 |
|---|---|
| `audio_url` 신뢰성 | Daglo가 다운로드하므로 **공개 또는 short-lived presigned URL**만 사용. 내부망 URL ❌ |
| `keyword_boost` PII | 학생/멘토 이름이 들어갈 수 있으므로 로그 마스킹 정책 적용 |
| `callback.url` | 외부 노출 위험. **HMAC 서명**으로 진위 검증 필수 (현재 v0.1엔 미구현) |
| `custom` | DB의 user_id, session_id가 들어감. 로그 노출 시 마스킹 |
| Rate limit | 엔드포인트당 20 req/sec (Daglo). 우리 백엔드도 같은 한도로 가드 필요 |

---

## 📝 변경 이력

- 2026-05-26 — v0.1 초안. 5개 REST + 1개 WS 골격 노출.
