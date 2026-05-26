"""Daglo Speech gRPC 클라이언트 (Realtime STT).

근거:
- proto 정의: app/core/daglo/proto/speech.proto
  (출처: docs/daglo_api_guide_LEGACY_2024.md:295-334)
- 인증: 메타데이터 "authorization: Bearer <token>"
  (출처: docs/daglo_api_guide_LEGACY_2024.md:444)
- 오디오 포맷: LINEAR16, 16000Hz, mono
  (출처: docs/daglo_api_guide_LEGACY_2024.md:310)

요구사항:
- F2-02 라이브 STT: partial/final 결과 push
  (출처: 참고/feature_spec.md:203-205)
- NFR: partial 자막 지연 500ms 목표 (1500ms p99)
  (출처: 참고/nfr.md:110)
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass

import grpc

from .proto import speech_pb2, speech_pb2_grpc


@dataclass
class STTPartial:
    """우리 도메인의 통일된 부분/확정 결과 단위."""

    transcript: str
    is_final: bool
    language_code: str = "ko-KR"


class DagloGRPCClient:
    """Daglo gRPC StreamingRecognize 어댑터 (비동기)."""

    def __init__(
        self,
        api_token: str,
        server_address: str = "apis.daglo.ai:443",
    ):
        self._api_token = api_token
        self._server_address = server_address

    async def stream(
        self,
        audio_chunks: AsyncIterator[bytes],
        *,
        language_code: str = "ko-KR",
        interim_results: bool = True,
    ) -> AsyncIterator[STTPartial]:
        """오디오 청크 → partial/final transcript 스트림.

        Args:
            audio_chunks: LINEAR16 16kHz mono PCM 청크들 (각 ~0.25초 권장)
            language_code: BCP-47. ko-KR / en-US / mixed
            interim_results: True면 is_final=False 결과도 받음

        Yields:
            STTPartial — partial(is_final=False) 또는 final(is_final=True)

        Raises:
            grpc.aio.AioRpcError — Daglo 에러 (재연결 호출측 책임)
        """
        creds = grpc.ssl_channel_credentials()
        async with grpc.aio.secure_channel(self._server_address, creds) as channel:
            stub = speech_pb2_grpc.SpeechStub(channel)
            metadata = (("authorization", f"Bearer {self._api_token}"),)

            async def request_iter() -> AsyncIterator[speech_pb2.StreamingRecognizeRequest]:
                # 첫 메시지: config
                yield speech_pb2.StreamingRecognizeRequest(
                    config=speech_pb2.RecognitionConfig(
                        language_code=language_code,
                        interim_results=interim_results,
                    )
                )
                # 이후: audio_content
                async for chunk in audio_chunks:
                    if not chunk:
                        break
                    yield speech_pb2.StreamingRecognizeRequest(audio_content=chunk)

            response_iter = stub.StreamingRecognize(
                request_iter(),
                metadata=metadata,
            )

            async for response in response_iter:
                if not response.HasField("result"):
                    continue
                yield STTPartial(
                    transcript=response.result.transcript,
                    is_final=response.result.is_final,
                    language_code=response.result.language_code or language_code,
                )
