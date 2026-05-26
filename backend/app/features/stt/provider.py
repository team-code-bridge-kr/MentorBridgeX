"""STT Provider 추상화.

근거:
- F2-08 STT 엔진 추상화 (외부 API ↔ 자체 모델 전환)
  → 참고/feature_spec.md:234-237
- F2-02 라이브 STT (스트리밍 자막)
  → 참고/feature_spec.md:188, 203-206

v1.0의 구체 구현체는 DagloSTTProvider 하나만.
나머지(Whisper/Clova 등)는 같은 Protocol을 만족하기만 하면 됨.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Protocol, runtime_checkable

from app.core.daglo.client import DagloHTTPClient
from app.core.daglo.grpc_client import DagloGRPCClient, STTPartial

from .schemas import AsyncResult, AsyncTranscribeRequest, SubmitResponse, SyncResult


@runtime_checkable
class STTProvider(Protocol):
    """STT 엔진 추상 인터페이스.

    각 구현체는 외부 응답을 우리의 모델로 정규화하여 반환.
    """

    async def submit_async(self, req: AsyncTranscribeRequest) -> SubmitResponse: ...

    async def get_async(self, rid: str) -> AsyncResult: ...

    async def sync_short(self, filename: str, audio: bytes) -> SyncResult: ...

    def stream_realtime(
        self,
        audio_chunks: AsyncIterator[bytes],
        *,
        language_code: str = "ko-KR",
        interim_results: bool = True,
    ) -> AsyncIterator[STTPartial]: ...


class DagloSTTProvider:
    """Daglo Cloud API 기반 STTProvider 구현 (v1.0 기본값)."""

    def __init__(self, client: DagloHTTPClient, grpc_client: DagloGRPCClient | None = None):
        self._client = client
        self._grpc = grpc_client

    async def submit_async(self, req: AsyncTranscribeRequest) -> SubmitResponse:
        raw = await self._client.submit_async_transcribe(req.to_daglo_body())
        return SubmitResponse.model_validate(raw)

    async def get_async(self, rid: str) -> AsyncResult:
        raw = await self._client.get_async_transcribe(rid)
        raw.setdefault("rid", rid)
        return AsyncResult.model_validate(raw)

    async def sync_short(self, filename: str, audio: bytes) -> SyncResult:
        raw = await self._client.sync_transcribe(filename, audio)
        transcript = raw.get("sttResult", {}).get("transcript", "")
        return SyncResult(transcript=transcript, rid=raw.get("rid"))

    def stream_realtime(
        self,
        audio_chunks: AsyncIterator[bytes],
        *,
        language_code: str = "ko-KR",
        interim_results: bool = True,
    ) -> AsyncIterator[STTPartial]:
        if self._grpc is None:
            raise RuntimeError("DagloGRPCClient is not configured")
        return self._grpc.stream(
            audio_chunks,
            language_code=language_code,
            interim_results=interim_results,
        )
