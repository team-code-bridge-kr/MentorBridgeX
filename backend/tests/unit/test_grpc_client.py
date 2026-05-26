"""DagloGRPCClient 단위 테스트.

실 Daglo gRPC 서버 호출 ❌. monkeypatch로 stub 메서드를 mock async iterator로 대체.
검증 포인트:
- 첫 요청은 RecognitionConfig여야 함 (출처: docs/daglo_api_guide_LEGACY_2024.md:305)
- 인증 메타데이터에 Bearer 토큰 포함 (출처: :444)
- 응답이 STTPartial로 정규화됨
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest

from app.core.daglo import grpc_client as gc_module
from app.core.daglo.grpc_client import DagloGRPCClient, STTPartial
from app.core.daglo.proto import speech_pb2


class FakeSpeechStub:
    """Daglo SpeechStub mock — config 메시지 + audio_content 메시지를 수집."""

    def __init__(self):
        self.collected_requests: list[speech_pb2.StreamingRecognizeRequest] = []
        self.received_metadata = None
        # 응답으로 yield할 시퀀스
        self.responses_to_yield: list[speech_pb2.StreamingRecognizeResponse] = []

    def StreamingRecognize(self, request_iter, metadata=None):
        self.received_metadata = metadata

        async def coro_runner() -> AsyncIterator[speech_pb2.StreamingRecognizeResponse]:
            async for req in request_iter:
                self.collected_requests.append(req)
            for r in self.responses_to_yield:
                yield r

        return coro_runner()


class FakeChannel:
    def __init__(self, stub: FakeSpeechStub):
        self._stub = stub

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


@pytest.mark.asyncio
async def test_grpc_client_first_request_is_config_and_carries_auth(monkeypatch):
    stub = FakeSpeechStub()
    stub.responses_to_yield = [
        speech_pb2.StreamingRecognizeResponse(
            result=speech_pb2.StreamingRecognitionResult(
                transcript="안녕",
                is_final=False,
                language_code="ko-KR",
            )
        ),
        speech_pb2.StreamingRecognizeResponse(
            result=speech_pb2.StreamingRecognitionResult(
                transcript="안녕하세요",
                is_final=True,
                language_code="ko-KR",
            )
        ),
    ]

    def fake_secure_channel(addr, creds):
        return FakeChannel(stub)

    def fake_stub_ctor(channel):
        return stub

    monkeypatch.setattr(gc_module.grpc.aio, "secure_channel", fake_secure_channel)
    monkeypatch.setattr(gc_module.speech_pb2_grpc, "SpeechStub", fake_stub_ctor)

    async def audio_chunks() -> AsyncIterator[bytes]:
        yield b"\x00" * 32000  # 1초 분량 가짜
        yield b"\x01" * 32000  # 또 1초

    client = DagloGRPCClient(api_token="tok-xyz")
    out: list[STTPartial] = []
    async for p in client.stream(audio_chunks()):
        out.append(p)

    # 인증 메타데이터 확인 (인용: docs/daglo_api_guide_LEGACY_2024.md:444)
    assert stub.received_metadata == (("authorization", "Bearer tok-xyz"),)

    # 첫 요청은 config여야 함 (인용: docs/daglo_api_guide_LEGACY_2024.md:305)
    assert stub.collected_requests[0].HasField("config")
    assert stub.collected_requests[0].config.language_code == "ko-KR"
    assert stub.collected_requests[0].config.interim_results is True

    # 나머지는 audio_content
    assert stub.collected_requests[1].HasField("audio_content")
    assert stub.collected_requests[2].HasField("audio_content")
    assert stub.collected_requests[1].audio_content == b"\x00" * 32000

    # 응답이 STTPartial로 정규화됨
    assert out == [
        STTPartial(transcript="안녕", is_final=False, language_code="ko-KR"),
        STTPartial(transcript="안녕하세요", is_final=True, language_code="ko-KR"),
    ]


@pytest.mark.asyncio
async def test_grpc_client_skips_responses_without_result(monkeypatch):
    """Daglo가 result 없이 빈 응답을 보내면 무시해야 함."""
    stub = FakeSpeechStub()
    empty_resp = speech_pb2.StreamingRecognizeResponse()  # result 없음
    stub.responses_to_yield = [
        empty_resp,
        speech_pb2.StreamingRecognizeResponse(
            result=speech_pb2.StreamingRecognitionResult(transcript="x", is_final=True)
        ),
    ]
    monkeypatch.setattr(gc_module.grpc.aio, "secure_channel", lambda *a, **k: FakeChannel(stub))
    monkeypatch.setattr(gc_module.speech_pb2_grpc, "SpeechStub", lambda ch: stub)

    async def silent() -> AsyncIterator[bytes]:
        if False:
            yield b""

    client = DagloGRPCClient(api_token="t")
    out = [p async for p in client.stream(silent())]
    assert len(out) == 1
    assert out[0].transcript == "x"
