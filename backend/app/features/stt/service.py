"""STT 비즈니스 로직 레이어.

v0.1은 Provider를 단순 위임. 향후 다음을 위한 자리:
- 음성 세션 모델과 연결 (voice_sessions, activity_reports)
- 학생 그래프 키워드 자동 주입 (F2-05 정확도 향상)
- 비용 추적/할당량 관리
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from app.core.daglo.grpc_client import STTPartial

from .provider import STTProvider
from .schemas import AsyncResult, AsyncTranscribeRequest, SubmitResponse, SyncResult


class STTService:
    def __init__(self, provider: STTProvider):
        self._provider = provider

    async def submit_async(self, req: AsyncTranscribeRequest) -> SubmitResponse:
        return await self._provider.submit_async(req)

    async def get_async(self, rid: str) -> AsyncResult:
        return await self._provider.get_async(rid)

    async def sync_short(self, filename: str, audio: bytes) -> SyncResult:
        return await self._provider.sync_short(filename, audio)

    def stream_realtime(
        self,
        audio_chunks: AsyncIterator[bytes],
        *,
        language_code: str = "ko-KR",
        interim_results: bool = True,
    ) -> AsyncIterator[STTPartial]:
        return self._provider.stream_realtime(
            audio_chunks,
            language_code=language_code,
            interim_results=interim_results,
        )
