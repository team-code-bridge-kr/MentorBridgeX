# ⚠️ LEGACY — 2024년 가이드 (구버전, 참고용)

> ## 🚨 이 문서는 더 이상 최신 API를 반영하지 않습니다
>
> **원본 작성**: 2024-09-02 (Daglo 공식 가이드 v1.0)
> **로컬 보관**: 2026-05-26 (Claude Code 통합 작업 시 추가)
> **상태**: 🔴 **구버전** — 2026-05 시점의 공식 OpenAPI 스펙과 다수 불일치
>
> ### 📌 최신 정보는 다음을 사용하세요
> - **공식 레퍼런스**: [`daglo_api_reference.md`](daglo_api_reference.md) — OpenAPI 스펙 기반 SSOT
> - **공식 스펙 원본**: [`daglo_openapi.prod.yaml`](daglo_openapi.prod.yaml)
> - **온라인 문서**: <https://apis.daglo.ai/docs>
>
> ### ⚠️ 이 문서의 알려진 오류
> | 항목 | 가이드 (이 문서) | 실제 (2026-05) |
> |---|---|---|
> | **#9 Chat Completion** (`/nlp/v1/sync/chat/completions`) | 사용 가능으로 기술 | ❌ **DEPRECATED** — 요청 시 503 timeout |
> | **신규 `/nlp/v1/sync/summaries`** (요약) | 없음 | ✅ 사용 가능 (Chat의 실질적 대체) |
> | **신규 `/nlp/v1/sync/paragraphs`** (단락 분리) | 없음 | ✅ 사용 가능 |
> | **신규 `GET /stt/v1/async/transcripts/{rid}/{format}`** | 없음 | ✅ 결과 파일 다운로드 |
> | **STT Sync 응답의 `rid` 필드** | 있음 | ❌ 실제 응답엔 없음 |
> | **Rate Limit** | 미명시 | ✅ 엔드포인트별 20 req/sec |
>
> ### ✅ 이 문서가 여전히 유용한 부분
> - **gRPC `StreamingRecognize` Python 클라이언트 예제** (REST OpenAPI 스펙엔 없음)
> - **한국어 기능 설명** (각 기능의 사용 사례, 한계점 등)
> - **부가기능(화자분리/감정/키워드) 한국어 가이드**
>
> ---
>
> 아래 원본 내용은 **참고용으로만** 보존합니다. 구현 시엔 반드시 위 최신 문서를 함께 확인하세요.

---

# Daglo API 가이드 (완전판) — 2024년 원본

> VSCode Claude(Claude Code) 작업용 참고 문서
> 출처: daglo API 가이드 공식 문서 (apis.daglo.ai)
> https://developers.daglo.ai/guide/
> 원본 작성일: 2024-09-02

---

## 📋 목차

### Speech-To-Text
1. [STT - 음성을 텍스트로 변환하기 (Short)](#1-stt---음성을-텍스트로-변환하기-short)
2. [STT - 긴 음성 변환하기 (Async)](#2-stt---긴-음성-변환하기-async)
3. [STT - 30초 이하 짧은 음성 변환하기 (Sync)](#3-stt---30초-이하-짧은-음성-변환하기-sync)
4. [STT - 실시간 음성을 텍스트로 변환하기 (gRPC)](#4-stt---실시간-음성을-텍스트로-변환하기-grpc)

### STT 부가기능
5. [화자 분리 (Speaker Diarization)](#5-화자-분리-speaker-diarization)
6. [감정 분석 (Sentiment Analysis)](#6-감정-분석-sentiment-analysis)
7. [키워드 추출 (Keyword Extraction)](#7-키워드-추출-keyword-extraction)
8. [키워드 부스팅 (Keyword Boosting)](#8-키워드-부스팅-keyword-boosting)

### Language (NLP)
9. [Chat Completion](#9-chat-completion)
10. [회의록 요약하기 (Minutes)](#10-회의록-요약하기-minutes)
11. [Text-To-Speech (TTS)](#11-text-to-speech-tts)

### 공통
12. [공통 사항](#공통-사항)
13. [지원 포맷 정리](#지원-포맷-정리)
14. [에러 코드](#에러-코드)

---

## 공통 사항

### Base URL
```
https://apis.daglo.ai
```

### API Key 발급 절차

1. API Console에 접속하여 회원가입 후 로그인합니다.
2. 토큰 메뉴에 들어가 새로운 토큰을 발급합니다.
3. 발급한 토큰 정보를 복사해 요청 시 인증 토큰 정보로 사용합니다.

### 인증 헤더

모든 REST API 요청에 다음 헤더를 포함해야 합니다:

```
Authorization: Bearer <API_TOKEN>
```

### ⚠️ 공통 제약 사항

- 노래 음원 혹은 배경음악이 크게 들리는 오디오는 텍스트 변환을 지원하지 않습니다.
- 포맷이 같더라도 실제 내용(인코딩)이 다를 경우 받아쓰기가 진행되지 않을 수 있습니다.

---

## 1. STT - 음성을 텍스트로 변환하기 (Short)

### 1.1 소개

음성 인식 API는 사용자가 제공한 음성 데이터를 텍스트로 변환하여 제공하는 서비스입니다. 비동기화 방식으로 동작합니다.

### 1.2 주요 기능

- **음성 데이터 변환**: API를 통해 제공된 음성 데이터를 텍스트로 변환합니다.
- **다양한 오디오 형식 지원**: WAV, MP3 등 다양한 오디오 형식을 지원하여 유연한 사용이 가능합니다.
- **높은 정확도**: 자체 음성 인식 알고리즘을 통해 높은 정확도로 음성 데이터를 텍스트로 변환합니다.

### 1.3 사용 예제

#### POST (요청)

```bash
curl -X POST 'https://apis.daglo.ai/stt/v1/async/transcripts' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer <API_TOKEN>' \
--data '{
    "audio": {
        "source": {
            "url": "https://storage.googleapis.com/bkt-actionpower-examples/audio/action-power-introduction.wav"
        }
    }
}'
```

#### POST-Response

```json
{"rid":"12345678-abcd-efgh-1234-abcdefghijkl"}
```

#### GET (결과 조회)

```bash
curl 'https://apis.daglo.ai/stt/v1/async/transcripts/<RID>' \
--header 'Authorization: Bearer <API_TOKEN>'
```

#### GET-Response

```json
{
    "rid": "12345678-abcd-efgh-1234-abcdefghijkl",
    "status": "transcribed",
    "sttResults": [
        {
            "transcript": "안녕하세요. 액션 파워입니다.",
            "words": [
                {
                    "word": "안녕하세요. ",
                    "startTime": {"nanos": 60000000, "seconds": "0"},
                    "endTime": {"nanos": 860000000, "seconds": "0"},
                    "segmentId": "1"
                },
                {
                    "word": "액션 ",
                    "startTime": {"nanos": 820000000, "seconds": "0"},
                    "endTime": {"nanos": 419999999, "seconds": "1"},
                    "segmentId": "2"
                },
                {
                    "word": "파워입니다. ",
                    "startTime": {"nanos": 379999999, "seconds": "1"},
                    "endTime": {"nanos": 20000000, "seconds": "2"},
                    "segmentId": "2"
                }
            ],
            "keywords": null
        }
    ]
}
```

### 1.4 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `https://apis.daglo.ai/stt/v1/async/transcripts` | 음성 변환 요청 |
| GET | `https://apis.daglo.ai/stt/v1/async/transcripts/{rid}` | 변환 결과 조회 |

---

## 2. STT - 긴 음성 변환하기 (Async)

### 2.1 소개

최대 4시간 길이의 긴 음성 데이터를 텍스트로 변환하여 제공하는 서비스입니다. 비동기 방식으로 동작합니다.

### 2.2 사용 예제

```bash
curl -X POST 'https://apis.daglo.ai/stt/v1/async/transcripts' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer <API_TOKEN>' \
--data '{
    "audio": {
        "source": {
            "url": "https://storage.googleapis.com/bkt-actionpower-examples/audio/action-power-introduction.wav"
        }
    }
}'
```

#### POST-Response

```json
{"rid":"12345678-abcd-efgh-1234-abcdefghijkl"}
```

#### GET (결과 조회)

```bash
curl 'https://apis.daglo.ai/stt/v1/async/transcripts/<RID>' \
--header 'Authorization: Bearer <API_TOKEN>'
```

### 2.3 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `https://apis.daglo.ai/stt/v1/async/transcripts` | 긴 음성 변환 요청 (Send long audio to transcribe) |
| GET | `https://apis.daglo.ai/stt/v1/async/transcripts/{rid}` | 변환 결과 조회 (Get long audio transcription) |

### 2.4 지원 포맷

- **파일 크기**: 최대 2GB 이내
- **파일 재생 시간**: 4시간 이내

### 2.5 Callback으로 응답받기

요청 후 Callback으로 처리하는 경우, 서버에서 작업이 완료된 후 지정된 URL로 완료 상태를 전송합니다.

---

## 3. STT - 30초 이하 짧은 음성 변환하기 (Sync)

### 3.1 소개

짧은 음성 인식 API는 사용자가 제공한 음성 데이터를 텍스트로 변환하여 제공하는 서비스입니다. **동기화 방식**으로 동작합니다.

### 3.2 사용 예제

#### POST (요청)

```bash
curl 'https://apis.daglo.ai/stt/v1/sync/transcripts' \
--header 'Authorization: Bearer <API_TOKEN>' \
--form 'file=@"sample.wav"'
```

#### Response

```json
{
    "rid": "12345678-abcd-efgh-1234-abcdefghijkl",
    "sttResult": {
        "transcript": "안녕하세요. 액션 파워입니다. 음성 인식의 선두주자 액션 파워의 기술을..."
    }
}
```

### 3.3 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `https://apis.daglo.ai/stt/v1/sync/transcripts` | 짧은 음성 변환 (Transcribe short audio) |

### 3.4 지원 포맷

- **파일 재생 시간**: 30초 이내

---

## 4. STT - 실시간 음성을 텍스트로 변환하기 (gRPC)

### 4.1 소개

Daglo Realtime STT gRPC API를 사용하여 실시간 음성을 텍스트로 변환하는 방법을 안내합니다.

### 4.2 ⚠️ 주의 사항

- 실시간 음성 인식은 현재 **한국어와 영어**만 지원합니다.
- 한 요청 스트림당 **최대 6시간**까지 지원합니다.
- 노래 음원 혹은 배경음악이 크게 들리는 오디오는 텍스트 변환을 지원하지 않습니다.

### 4.3 필수 요구 사항

- gRPC에 대한 사전 지식
- 마이크 접근 권한
- Daglo API 계정 및 API 토큰

### 4.4 Protocol Buffer 서비스 정의

```protobuf
syntax = "proto3";

package dagloapis.speech.v1;

service Speech {
    rpc StreamingRecognize(stream StreamingRecognizeRequest)
        returns (stream StreamingRecognizeResponse) {}
}

// 첫 번째 메시지는 반드시 `config` 필드를 포함해야 하며 `audio_content`는 포함하지 않아야 합니다.
// 이후 메시지는 `audio_content`만 포함합니다.
message StreamingRecognizeRequest {
    oneof streaming_request {
        RecognitionConfig config = 1;
        // 오디오 소스는 LINEAR16 인코딩, 샘플링 레이트 16000Hz, 모노(1 채널) 필수.
        bytes audio_content = 2;
    }
}

message RecognitionConfig {
    // 언어 코드 (BCP-47 표준)
    // 지원: ko-KR, en-US, mixed (기본값: ko-KR)
    string language_code = 1;

    // true인 경우 임시 부분 결과(is_final=false)도 반환
    bool interim_results = 2;
}

message StreamingRecognizeResponse {
    StreamingRecognitionResult result = 1;
    float total_duration = 2;
}

message StreamingRecognitionResult {
    string transcript = 1;
    bool is_final = 2;
    string language_code = 3;
}
```

### 4.5 클라이언트 코드 작성 (Python 예제)

#### 4.5.1 라이브러리 설치

```bash
pip install grpcio grpcio-tools
pip install pyaudio
```

#### 4.5.2 Protobuf 파일 컴파일

```bash
python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. ./speech.proto
```

#### 4.5.3 클라이언트 코드 (`client.py`)

```python
import argparse
import grpc
import speech_pb2
import speech_pb2_grpc
import pyaudio
import sys

SAMPLE_RATE = 16000
CHUNK = int(SAMPLE_RATE * 0.25)  # 0.25초 프레임
CHANNELS = 1
FORMAT = pyaudio.paInt16

def generate_requests(audio_stream, language_code='ko-KR', interim_results=True):
    # 첫 번째 메시지: 설정 전송
    config = speech_pb2.RecognitionConfig(
        language_code=language_code,
        interim_results=interim_results
    )
    yield speech_pb2.StreamingRecognizeRequest(config=config)

    # 이후 요청: 오디오 데이터 전송
    while True:
        try:
            audio_chunk = audio_stream.read(CHUNK)
            if not audio_chunk:
                break
            yield speech_pb2.StreamingRecognizeRequest(audio_content=audio_chunk)
        except IOError as e:
            print(f"Error reading from audio stream: {e}", file=sys.stderr)
            break

    yield speech_pb2.StreamingRecognizeRequest()

def run_streaming_recognition_from_mic(server_address, api_token):
    creds = grpc.ssl_channel_credentials()
    channel = grpc.secure_channel(server_address, creds)
    stub = speech_pb2_grpc.SpeechStub(channel)

    metadata = (("authorization", f"Bearer {api_token}"),)
    audio = pyaudio.PyAudio()

    try:
        stream = audio.open(format=FORMAT,
                            channels=CHANNELS,
                            rate=SAMPLE_RATE,
                            input=True,
                            frames_per_buffer=CHUNK)

        print("마이크 녹음 및 스트리밍 시작. 'Ctrl+C'를 눌러 중단하세요.")

        response_iterator = stub.StreamingRecognize(
            generate_requests(stream),
            metadata=metadata
        )

        for response in response_iterator:
            if response.result:
                if response.result.is_final:
                    print(f"최종 결과: {response.result.transcript}")
                else:
                    print(f"부분 결과: {response.result.transcript}", end='\r')

    except grpc.RpcError as e:
        print(f"\ngRPC 오류 발생: {e.code()}, {e.details()}", file=sys.stderr)
    except KeyboardInterrupt:
        print("\n녹음을 종료하고 프로그램을 종료합니다.")
    finally:
        if 'stream' in locals() and stream.is_active():
            stream.stop_stream()
            stream.close()
        audio.terminate()
        channel.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="gRPC Speech Recognition Client")
    parser.add_argument("--server", type=str, required=True,
                        help="gRPC server address (e.g., apis.daglo.ai)")
    parser.add_argument("--token", type=str, required=True, help="API Token")
    args = parser.parse_args()
    run_streaming_recognition_from_mic(args.server, args.token)
```

#### 4.5.4 클라이언트 실행

```bash
python client.py --server apis.daglo.ai --token $API_TOKEN
```

### 4.6 인증

`StreamingRecognize` RPC 호출 시 메타데이터(헤더)로 `authorization: Bearer <API_TOKEN>` 값을 추가해야 합니다.

### 4.7 주의 사항

- Error가 발생하면 gRPC 스트리밍이 종료됩니다. 끊기지 않기 위해서는 **재연결 로직**을 구현해 주세요.

---

# STT 부가기능

> STT 부가기능은 모두 긴 음성 변환(Async) API에 옵션으로 추가됩니다.
> 동일한 엔드포인트(`POST https://apis.daglo.ai/stt/v1/async/transcripts`)를 사용하며, 요청 본문에 옵션 객체를 추가하는 방식입니다.

---

## 5. 화자 분리 (Speaker Diarization)

### 5.1 소개

화자 분리 기능은 여러 화자가 대화하는 음성 파일에서 각 화자의 발화를 구분하여 텍스트로 변환합니다. 예를 들어, 회의 녹음에서 누가 무엇을 말했는지 명확히 구분할 수 있습니다. 이는 회의록 작성이나 인터뷰 분석에 유용합니다.

화자 분리 기능은 화자 수가 많을수록 정확도가 떨어질 수 있으며, 중첩되는 음성이나 음질이 낮거나 빠른 소음이 심할 경우에도 한계가 있습니다.

### 5.2 사용 방법

- 긴 음성 변환의 파라미터 설정으로 요청에 사용할 수 있습니다.

#### Endpoint

```
POST https://apis.daglo.ai/stt/v1/async/transcripts
```

#### 요청 본문

```json
{
    "sttConfig": {
        "speakerDiarization": {
            "enable": true
        }
    }
}
```

#### 결과물 예시

```json
{
    "sttResults": [
        {
            "words": [
                {
                    "speaker": "1",
                    "word": "안녕 ",
                    "startTime": {"nanos": 560000000, "seconds": "0"},
                    "endTime": {"nanos": 950000000, "seconds": "1"},
                    "segmentId": "1"
                },
                {
                    "speaker": "2",
                    "word": "그래 ",
                    "startTime": {"nanos": 909999999, "seconds": "1"},
                    "endTime": {"nanos": 229999999, "seconds": "2"},
                    "segmentId": "2"
                }
            ]
        }
    ]
}
```

---

## 6. 감정 분석 (Sentiment Analysis)

### 6.1 소개

감정 분석 기능은 텍스트에서 감정 상태를 분석하여 긍정, 부정, 중립 등의 감정을 분류합니다. 이는 고객 서비스 통화에서 고객의 감정을 파악하거나 상담 내용의 감정을 분석하는 데 유용합니다.

### 6.2 사용 방법

- 긴 음성 변환의 파라미터 설정으로 요청에 사용할 수 있습니다.

#### Endpoint

```
POST https://apis.daglo.ai/stt/v1/async/transcripts
```

#### 요청 본문

```json
{
    "nlpConfig": {
        "sentimentAnalysis": {
            "enable": true
        }
    }
}
```

#### 결과물 예시

```json
{
    "sttResults": [
        {
            "sentiment": "Negative",
            "sentimentScore": {
                "neutral": 22.559999465942383,
                "negative": 61.20999908447266,
                "positive": 16.22999954223638
            }
        }
    ]
}
```

### 6.3 감정 분석 결과 응답 테이블

| 감정 | 설명 |
|------|------|
| `positive` | 긍정적인 감정을 나타내며, 발화자가 긍정적이거나 기뻐하는 내용을 포함합니다. |
| `negative` | 부정적인 감정을 나타내며, 발화자가 불만족하거나 부정적인 내용을 포함합니다. |
| `neutral` | 중립적인 감정을 나타내며, 발화자가 특정 감정을 강하게 드러내지 않는 중립적인 내용을 포함합니다. |

---

## 7. 키워드 추출 (Keyword Extraction)

### 7.1 소개

키워드 추출 기능은 텍스트에서 중요한 키워드를 추출하여 제공합니다. 이는 회의록에서 중요한 키워드를 추출하거나 강의 내용을 요약하는 데 유용합니다.

### 7.2 사용 방법

- 긴 음성 변환의 파라미터 설정으로 요청에 사용할 수 있습니다.

#### Endpoint

```
POST https://apis.daglo.ai/stt/v1/async/transcripts
```

#### 요청 본문

```json
{
    "nlpConfig": {
        "keywordExtraction": {
            "enable": true
        }
    }
}
```

#### 결과물 예시

```json
{
    "sttResults": [
        {
            "keywords": [
                "안녕",
                "다글로",
                "민영"
            ]
        }
    ]
}
```

---

## 8. 키워드 부스팅 (Keyword Boosting)

### 8.1 소개

키워드 부스팅은 특정 단어나 구가 음성 인식 시스템에서 더 정확하게 인식될 수 있도록 가중치를 부여하는 기술입니다. 이를 통해 중요한 키워드나 브랜드 이름, 기술 용어 등을 더 잘 인식할 수 있으며, 중요한 단어가 더 정확하게 인식되도록 해당 음성 인식 시스템의 효율성을 높일 수 있습니다.

키워드 부스팅 기능은 입력한 키워드가 오디오에서 실제로 등장하지 않을 경우 효과가 없거나 역효과가 발생할 수 있으며, 키워드가 자주 사용되지 않는 발음이거나 독특한 발음일 경우 인식률이 저하될 수 있습니다. 또한, 배경 소음이 심하거나 음질이 낮을 경우 키워드 부스팅의 효과가 제한될 수 있습니다.

### 8.2 사용 방법

- 긴 음성 변환, 30초 이하 짧은 음성 변환, 실시간 음성 변환의 파라미터 설정으로 요청에 사용할 수 있습니다.

#### Endpoint

```
POST https://apis.daglo.ai/stt/v1/async/transcripts
```

#### 요청 본문

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

#### 결과물 예시

**사용 전**: "이번 다그리 AI 크라운 프로젝트는 매우 성공적이었습니다."

**사용 후**:
```json
{
    "sttResults": [
        {
            "transcript": "이번 다글로 AI 클라우드 프로젝트는 매우 성공적이었습니다."
        }
    ]
}
```

---

# Language (NLP) API

---

## 9. Chat Completion

### 9.1 소개

Chat Completion API는 사용자가 제공한 텍스트 입력에 대해 자연스럽고 유창한 대화 응답을 생성하는 서비스입니다. 이 API는 다양한 사용 사례에서 사용될 수 있으며, 이를 통해 챗봇, 고객 지원 시스템, 개인 비서 등 다양한 응용 프로그램을 개발할 수 있습니다.

### 9.2 주요 기능

- **대화 응답 생성**: 제공된 메시지 이력에 기반하여 일관성 있고 유창한 대화 응답을 생성합니다.
- **토큰 제어**: 생성할 응답의 최대 토큰 수를 설정하여 응답 길이를 제어할 수 있습니다.
- **온도 설정**: 응답의 다양성과 창의성을 조절할 수 있는 온도(temperature) 파라미터를 지원합니다.
- **역할 기반 메시지**: 시스템, 사용자, 어시스턴트 등 다양한 역할을 지정하여 보다 자연스러운 대화 흐름을 유지할 수 있습니다.
- **다중 응답 선택**: 단일 요청에 대해 여러 응답을 생성하여 다양한 옵션을 제공할 수 있습니다.

### 9.3 활용 사례

- **챗봇 개발**: 사용자가 입력한 텍스트에 대해 자연스럽고 유창한 응답을 생성하여 대화형 챗봇을 구현할 수 있습니다.
- **고객 지원 시스템**: 고객의 문의에 대해 자동으로 응답을 생성하여 고객 지원 서비스를 자동화할 수 있습니다.
- **개인 비서**: 사용자의 명령이나 질문에 대해 실시간으로 응답을 생성하여 개인 비서 역할을 수행할 수 있습니다.

### 9.4 사용 예제

#### 요청 예시

```bash
curl -X POST 'https://apis.daglo.ai/nlp/v1/sync/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer <API_TOKEN>' \
--data '{
    "model": "elli",
    "messages": [
        {
            "role": "system",
            "content": "당신은 초등학교 교사입니다."
        },
        {
            "role": "user",
            "content": "금리에 대해서 초등학생이 이해 가능한 수준으로 설명해 주세요."
        }
    ],
    "topP": 0.9
}'
```

#### 응답 예시

```json
{
    "rid": "<RID>",
    "model": "elli",
    "chatResults": [
        {
            "index": 0,
            "message": {
                "role": "assistant",
                "content": "\"금리는 돈을 빌릴 때 내는 돈의 양입니다. 돈의 가치가 높아짐에..."
            },
            "finishReason": "stop"
        }
    ],
    "usage": {
        "promptTokens": 23,
        "completionTokens": 78,
        "totalTokens": 101
    }
}
```

### 9.5 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `https://apis.daglo.ai/nlp/v1/sync/chat/completions` | Send chat message for completion |

### 9.6 주요 파라미터

| Parameter | Type | 설명 |
|-----------|------|------|
| `model` | string | 사용할 모델명 (예: `elli`) |
| `messages` | array | 대화 메시지 배열 (role: `system`/`user`/`assistant`) |
| `topP` | number | 응답 다양성 조절 파라미터 (예: 0.9) |

### 9.7 응답 코드

**Success**: 200

**Error**:
- `401`: Unauthorized. 인증 실패.
- `403`: Forbidden. 접근 금지.
- `429`: Too Many Requests. 요청 과다.
- `500`: Internal Server Error. 서버 오류.

---

## 10. 회의록 요약하기 (Minutes)

### 10.1 소개

Minutes API는 회의록을 자동으로 작성해주는 서비스입니다. 이 API는 회의 내용이나 대화를 텍스트로 제공받아 이를 요약하고 중요한 포인트를 자동으로 정리하여 회의록을 생성합니다.

### 10.2 주요 기능

- **회의록 생성**: 입력된 텍스트를 기반으로 회의록을 자동으로 생성합니다.
- **사용자 정의 데이터**: 요청 시 사용자 정의 데이터를 포함시켜 응답받을 수 있습니다.
- **비동기 처리**: 요청을 비동기 방식으로 처리하여 대량의 회의록 생성 작업을 효율적으로 처리할 수 있습니다.
- **콜백 지원**: 작업이 완료되면 지정된 URL로 결과를 콜백 받을 수 있습니다.

### 10.3 활용 사례

- **회의록 자동 작성 시스템**: 회의 내용을 입력하면 자동으로 요약된 회의록을 생성하여 배포할 수 있습니다.
- **대화 요약 서비스**: 긴 대화를 요약하여 중요한 포인트만 정리한 문서를 생성할 수 있습니다.
- **비즈니스 리포트**: 회의 내용을 기반으로 간단한 비즈니스 리포트를 작성할 수 있습니다.

### 10.4 사용 예제

#### 1) 요청 및 요청 응답 (POST)

회의록을 생성할 본문을 담아 요청을 보내고 응답을 받습니다.

##### Request Sample

```bash
curl -X POST 'https://apis.daglo.ai/nlp/v1/async/minutes' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer <API_TOKEN>' \
--data '{ "text": "<TEXT>"}'
```

##### Response Sample

```json
{ "rid": "<RID>" }
```

#### 2) 결과 응답 (GET)

요청한 회의록의 결과를 GET 방식으로 진행 과정과 결과를 받아볼 수 있습니다.

##### Request Sample

```bash
curl 'https://apis.daglo.ai/nlp/v1/async/minutes/<RID>' \
--header 'Authorization: Bearer <API_TOKEN>'
```

##### Response Sample

```json
{
    "rid": "<RID>",
    "status": "processed",
    "progress": 100,
    "title": "전체 제목",
    "minutes": [
        {
            "bullets": [
                {"isImportant": false, "text": "summary 1"},
                {"isImportant": false, "text": "summary 2"},
                {"isImportant": true,  "text": "summary 3"},
                {"isImportant": false, "text": "summary 4"},
                {"isImportant": false, "text": "summary 5"}
            ],
            "title": "소제목 1"
        },
        {
            "bullets": [
                {"isImportant": false, "text": "summary 1"},
                {"isImportant": false, "text": "summary 2"},
                {"isImportant": false, "text": "summary 3"},
                {"isImportant": false, "text": "summary 4"},
                {"isImportant": false, "text": "summary 5"}
            ],
            "title": "소제목 2"
        }
    ]
}
```

#### 3) 결과 응답 (Callback)

- POST에서 Callback URL을 명시한 경우, 해당 경로로 요약 결과를 전송받습니다.
- 자세한 내용은 Get(Polling)과 Callback 문서를 확인해주세요.

### 10.5 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `https://apis.daglo.ai/nlp/v1/async/minutes` | 비동기화 방식 (Request meeting minutes) |
| GET | `https://apis.daglo.ai/nlp/v1/async/minutes/{rid}` | 비동기화 응답 결과 (Get meeting minutes) |

### 10.6 응답받기

#### Success (200)

| Status | 설명 |
|--------|------|
| `requested` | 요청이 시작되었습니다. |
| `processing` | 요약 중입니다. |
| `completed` | 요약이 완료되었습니다. |
| `input_error` | 사용자 요청 값에 오류가 있습니다. 확인 후 다시 요청해 주세요. |
| `processing_error` | 요약 중 오류가 발생하였습니다. 잠시 기다렸다가 다시 요청해 주세요. |

#### Error

| Code | 설명 |
|------|------|
| `400` | Bad Request. 요청 형식이 잘못되었습니다. |
| `401` | Unauthorized. 인증 실패. |
| `403` | Forbidden. 접근 금지. |
| `404` | Not Found. 요청한 리소스를 찾을 수 없습니다. |
| `429` | Too Many Requests. 요청 과다. |
| `500` | Internal Server Error. 서버 오류. |
| `503` | Service Unavailable. 서비스 이용 불가. |

---

## 11. Text-To-Speech (TTS)

### 11.1 소개

Text-To-Speech (TTS) API는 텍스트 데이터를 음성으로 변환하여 제공하는 서비스입니다. 이 API를 사용하면 텍스트 데이터를 다양한 음성 형식으로 변환하여 음성 응용 프로그램을 개발하거나 음성 서비스 기능을 통합할 수 있습니다.

### 11.2 주요 기능

- **텍스트 데이터 변환**: 제공된 텍스트 데이터를 음성으로 변환합니다.
- **높은 품질의 음성 출력**: 고급 음성 합성 알고리즘을 통해 자연스럽고 명확한 음성 출력을 제공합니다.

### 11.3 활용 사례

- **오디오북 생성**: 텍스트 데이터를 음성으로 변환하여 오디오북을 생성합니다.
- **교육용 애플리케이션**: 학습 자료를 음성으로 변환하여 청각적인 학습을 지원합니다.
- **자동 응답 시스템**: 텍스트 데이터를 음성으로 변환하여 자동 응답 시스템에 통합합니다.
- **접근성 향상**: 시각 장애인을 위한 텍스트 내용을 음성으로 변환하여 정보 접근성을 향상시킵니다.

### 11.4 사용 예제

#### Request Sample

```bash
curl -X POST 'https://apis.daglo.ai/tts/v1/sync/audios' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer <API_TOKEN>' \
--data '{ "text": "안녕하세요. 액션파워입니다."}'
```

#### Response Sample

```
wav file
```
(응답으로 wav 파일이 반환됩니다.)

### 11.5 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `https://apis.daglo.ai/tts/v1/sync/audios` | Synthesize short speech |

### 11.6 요청 파라미터

| Parameter | Type | Info |
|-----------|------|------|
| `text` | string | 발화할 텍스트를 입력합니다. |

### 11.7 요청 가능한 Voice

| Voice | Language | Info |
|-------|----------|------|
| `en_US_Olivia` | en_US | 올리비아, 성인, 여성, 친근 |
| `ko_KR_Jimin` | ko_KR | 지민, 성인, 여성, 차분 |

### 11.8 응답 코드

**Success**:
- `200`: 성공
- `204`: No Content. 요청은 성공하였으나 반환한 결과가 없습니다.

**Error**:
- `400`: Bad Request. 요청 형식이 잘못 되었습니다.
- `401`: Unauthorized.
- `403`: Forbidden. 허용되지 않은 접근입니다.
- `413`: Payload Too Large. 요청이 너무 큽니다.
- `415`: Unsupported Media Type.
- `429`: Too Many Requests.
- `500`: Internal Server Error. 서버 오류입니다.
- `503`: 너무 많은 요청을 처리하고 있어 일시적으로 응답이 불가능한 상태입니다.

---

## 지원 포맷 정리

### STT 지원 포맷 비교

| 구분 | 30초 이하 (Sync) | 긴 음성 (Async) | 실시간 (gRPC) |
|------|------------------|-----------------|---------------|
| 최대 시간 | 30초 | 4시간 | 6시간 |
| 최대 크기 | - | 2GB | - |
| 인코딩 | 파일 업로드 | URL 참조 | LINEAR16, 16000Hz, 모노 |
| 지원 언어 | 다국어 | 다국어 | 한국어, 영어, mixed |

### 오디오 포맷 (STT 공통)
`.3gp`, `.3gpp.ac3`, `.aac`, `.aiff`, `.amr`, `.au`, `.flac`, `.m4a`, `.mp3`, `.mxf`, `.opus`, `.ra`, `.wav`, `.weba`

### 비디오 포맷 (STT 공통)
`.asx`, `.avi`, `.ogm`, `.ogv`, `.m4v`, `.mov`, `.mp4`, `.mpeg`, `.mpg`, `.wmv`

---

## 에러 코드

| 코드 | 의미 | 설명 |
|------|------|------|
| `200` | OK | 성공 |
| `204` | No Content | 요청은 성공하였으나 반환할 결과가 없음 |
| `400` | Bad Request | 요청 형식이 잘못 되었음 |
| `401` | Unauthorized | 인증 실패 |
| `403` | Forbidden | 허용되지 않은 접근 |
| `404` | Not Found | 요청한 리소스를 찾을 수 없음 |
| `413` | Payload Too Large | 요청이 너무 큼 |
| `415` | Unsupported Media Type | 지원되지 않는 미디어 타입 |
| `429` | Too Many Requests | 요청 횟수 초과 |
| `500` | Internal Server Error | 서버 오류 |
| `503` | Service Unavailable | 너무 많은 요청을 처리하고 있어 일시적으로 응답이 불가능한 상태 |

---

## 전체 엔드포인트 요약

### Speech-To-Text (STT)
| Method | Endpoint | 용도 |
|--------|----------|------|
| POST | `/stt/v1/sync/transcripts` | 30초 이하 짧은 음성 변환 (동기) |
| POST | `/stt/v1/async/transcripts` | 긴 음성 변환 요청 (비동기) |
| GET | `/stt/v1/async/transcripts/{rid}` | 비동기 변환 결과 조회 |
| gRPC | `StreamingRecognize` | 실시간 스트리밍 음성 인식 |

### Language (NLP)
| Method | Endpoint | 용도 |
|--------|----------|------|
| POST | `/nlp/v1/sync/chat/completions` | Chat Completion (동기) |
| POST | `/nlp/v1/async/minutes` | 회의록 요약 요청 (비동기) |
| GET | `/nlp/v1/async/minutes/{rid}` | 회의록 요약 결과 조회 |

### Text-To-Speech (TTS)
| Method | Endpoint | 용도 |
|--------|----------|------|
| POST | `/tts/v1/sync/audios` | 텍스트→음성 변환 (동기) |

---

## 부가기능 옵션 요약 (STT Async 요청 본문에 추가)

### 화자 분리
```json
{
    "sttConfig": {
        "speakerDiarization": { "enable": true }
    }
}
```

### 키워드 부스팅
```json
{
    "sttConfig": {
        "keywordBoost": {
            "enable": true,
            "keywords": ["키워드1", "키워드2"]
        }
    }
}
```

### 감정 분석
```json
{
    "nlpConfig": {
        "sentimentAnalysis": { "enable": true }
    }
}
```

### 키워드 추출
```json
{
    "nlpConfig": {
        "keywordExtraction": { "enable": true }
    }
}
```

### 여러 부가기능 동시 사용 (조합 예시)
```json
{
    "audio": {
        "source": { "url": "https://example.com/audio.wav" }
    },
    "sttConfig": {
        "speakerDiarization": { "enable": true },
        "keywordBoost": {
            "enable": true,
            "keywords": ["다글로", "클라우드"]
        }
    },
    "nlpConfig": {
        "sentimentAnalysis": { "enable": true },
        "keywordExtraction": { "enable": true }
    }
}
```

---

## 작업 시 체크리스트 (VSCode Claude용)

### 환경 준비
- [ ] API_TOKEN 환경변수 설정 확인 (`$API_TOKEN` 또는 `.env`의 `DAGLO_API_TOKEN`)
- [ ] 모든 요청에 `Authorization: Bearer <API_TOKEN>` 헤더 포함

### STT 작업 시
- [ ] 사용할 STT 유형 결정:
  - 30초 이하 → `/stt/v1/sync/transcripts` (multipart/form-data)
  - 4시간 이내 → `/stt/v1/async/transcripts` (JSON, URL 참조) + 폴링 또는 Callback
  - 실시간 → gRPC `StreamingRecognize`
- [ ] 오디오 인코딩 확인 (실시간: LINEAR16, 16000Hz, 모노 필수)
- [ ] 파일 크기/길이 제한 확인 (Async: 2GB/4h, Realtime: 6h, Sync: 30s)
- [ ] 부가기능 필요 시 `sttConfig` / `nlpConfig` 옵션 추가
- [ ] Async 방식 사용 시 폴링 간격 또는 Callback URL 준비

### NLP/TTS 작업 시
- [ ] Chat Completion: `model`, `messages`, `topP` 등 파라미터 확인
- [ ] Minutes: 비동기 처리이므로 폴링/Callback 패턴 필요
- [ ] TTS: 응답이 wav 바이너리이므로 파일로 저장하는 로직 필요

### 공통
- [ ] 에러 핸들링 및 재시도 로직 구현 (특히 gRPC 스트리밍 재연결, 429/503 백오프)
- [ ] 토큰 만료/갱신 처리 로직 고려

---

## 업데이트 이력

- 2024.09.02 ver1.0 — API 문서 작성 (공식)
- 2026.05.26 — VSCode Claude용 통합 가이드 작성 (STT + 부가기능 + NLP + TTS 통합)

---

## 참고 링크

- API Console: https://apis.daglo.ai (콘솔에서 토큰 발급)
- API Reference: 공식 문서의 API Reference 섹션 참고
- Get(Polling)과 Callback 문서: 공식 문서 참고
- gRPC 공식 사이트: https://grpc.io
- BCP-47 언어 코드 표준: https://www.rfc-editor.org/rfc/bcp/bcp47.txt
