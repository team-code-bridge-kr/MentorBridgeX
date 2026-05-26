"""STT 요청/응답 Pydantic 스키마.

기획서 채택 범위 (STT 5개):
- Async STT
- 화자 분리, 키워드 추출, 키워드 부스팅 (NLP/STT 옵션)
- (Sync STT는 테스트 편의용으로 단순 응답만)
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

# ─────────────────────────────────────────────
# 요청 옵션 — 우리가 노출하는 4개만
# ─────────────────────────────────────────────


class KeywordBoost(BaseModel):
    enable: bool = True
    keywords: list[str] = Field(default_factory=list, description="인식 정확도를 높일 키워드 목록")


class SpeakerDiarization(BaseModel):
    enable: bool = True


class KeywordExtraction(BaseModel):
    enable: bool = True


class CallbackConfig(BaseModel):
    url: str
    headers: dict[str, str] | None = None


class AsyncTranscribeRequest(BaseModel):
    """우리 API가 클라이언트로부터 받는 요청 (Daglo 본문보다 평탄화된 형태)."""

    audio_url: str = Field(..., description="공개적으로 다운로드 가능한 오디오 URL")
    speaker_diarization: bool = Field(False, description="화자 분리 활성화")
    keyword_boost: list[str] | None = Field(None, description="비어있지 않으면 boost 활성화")
    keyword_extraction: bool = Field(False, description="키워드 추출 활성화")
    callback: CallbackConfig | None = None
    custom: dict | None = None

    def to_daglo_body(self) -> dict:
        """우리 평탄 스키마 → Daglo 네스티드 본문으로 변환."""
        body: dict = {"audio": {"source": {"url": self.audio_url}}}

        stt_config: dict = {}
        if self.speaker_diarization:
            stt_config["speakerDiarization"] = {"enable": True}
        if self.keyword_boost:
            stt_config["keywordBoost"] = {"enable": True, "keywords": self.keyword_boost}
        if stt_config:
            body["sttConfig"] = stt_config

        nlp_config: dict = {}
        if self.keyword_extraction:
            nlp_config["keywordExtraction"] = {"enable": True}
        if nlp_config:
            body["nlpConfig"] = nlp_config

        if self.callback:
            body["callback"] = self.callback.model_dump(exclude_none=True)
        if self.custom:
            body["custom"] = self.custom

        return body


# ─────────────────────────────────────────────
# 응답 — Daglo 네스티드 구조를 그대로 유지하되 명시적 모델로
# ─────────────────────────────────────────────


class SubmitResponse(BaseModel):
    rid: str
    custom: dict | None = None


AsyncStatus = Literal[
    "requested", "processing", "transcribed", "completed", "file_error",
    "input_error", "processing_error",
]


class DagloTimeStamp(BaseModel):
    seconds: str | int | None = None
    nanos: int | None = None


class TranscribedWord(BaseModel):
    word: str
    speaker: str | None = None
    startTime: DagloTimeStamp | None = None
    endTime: DagloTimeStamp | None = None
    segmentId: str | None = None


class STTResultItem(BaseModel):
    transcript: str | None = None
    words: list[TranscribedWord] | None = None
    keywords: list[str] | None = None


class AsyncResult(BaseModel):
    rid: str
    status: AsyncStatus
    progress: int | None = None
    sttResults: list[STTResultItem] | None = None
    message: str | None = None
    custom: dict | None = None


class SyncResult(BaseModel):
    """Daglo Sync STT 응답. rid 필드는 실측상 누락 (참고: daglo_api_reference.md)."""

    transcript: str
    rid: str | None = None
