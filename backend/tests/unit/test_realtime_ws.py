"""WS Realtime STT 단위 테스트.

근거:
- 양방향 스트리밍: 참고/api_catalog.md:311
- partial/final 응답 흐름: 참고/feature_spec.md:204-205
- NFR 500ms (여기서는 정확도만, 지연 검증은 별도 부하 테스트):
  참고/nfr.md:110

전략: gRPC 호출은 mock STTProvider로 대체.
실 Daglo gRPC 호출 없이 WS 어댑터의 프로토콜 변환만 검증.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from fastapi.testclient import TestClient

from app.core.daglo.grpc_client import STTPartial
from app.features.stt import routes as stt_routes
from app.main import create_app


class FakeSTTService:
    """gRPC 없이 미리 정해둔 partial 시퀀스를 yield."""

    def __init__(self, partials: list[STTPartial]):
        self._partials = partials
        self.received_audio: list[bytes] = []
        self.received_kwargs: dict = {}

    def stream_realtime(
        self,
        audio_chunks: AsyncIterator[bytes],
        *,
        language_code: str = "ko-KR",
        interim_results: bool = True,
    ) -> AsyncIterator[STTPartial]:
        self.received_kwargs = {"language_code": language_code, "interim_results": interim_results}

        async def gen() -> AsyncIterator[STTPartial]:
            async for chunk in audio_chunks:
                self.received_audio.append(chunk)
            for p in self._partials:
                yield p

        return gen()


def _make_app(svc: FakeSTTService):
    app = create_app()
    app.dependency_overrides[stt_routes.get_stt_service] = lambda: svc
    return app


def _override_state(client: TestClient, svc: FakeSTTService) -> None:
    """lifespan 실행 후 state.stt_service를 fake로 교체.

    lifespan에서 실 DagloGRPCClient가 만들어지더라도 WS 라우트가 보는 건 fake.
    """
    client.app.state.stt_service = svc


def test_realtime_ws_returns_partials_and_final():
    svc = FakeSTTService(
        [
            STTPartial(transcript="안녕", is_final=False),
            STTPartial(transcript="안녕하세요", is_final=True),
        ]
    )
    app = _make_app(svc)

    with TestClient(app) as client:
        _override_state(client, svc)
        with client.websocket_connect("/v1/stt/realtime") as ws:
            ws.send_bytes(b"\x00" * 8000)  # 0.25초 분량 PCM 가짜
            ws.send_text("stop")            # 명시 종료 신호

            msg1 = ws.receive_json()
            msg2 = ws.receive_json()
            done = ws.receive_json()

    assert msg1 == {
        "type": "partial",
        "transcript": "안녕",
        "is_final": False,
        "language": "ko-KR",
    }
    assert msg2 == {
        "type": "final",
        "transcript": "안녕하세요",
        "is_final": True,
        "language": "ko-KR",
    }
    assert done == {"type": "done"}
    assert svc.received_audio == [b"\x00" * 8000]
    assert svc.received_kwargs == {"language_code": "ko-KR", "interim_results": True}


def test_realtime_ws_query_params_propagate_to_provider():
    svc = FakeSTTService([STTPartial(transcript="hello", is_final=True)])
    app = _make_app(svc)

    with TestClient(app) as client:
        _override_state(client, svc)
        with client.websocket_connect("/v1/stt/realtime?lang=en-US&interim=false") as ws:
            ws.send_text("stop")
            ws.receive_json()  # final
            ws.receive_json()  # done

    assert svc.received_kwargs == {"language_code": "en-US", "interim_results": False}


def test_realtime_ws_no_audio_still_completes():
    """청크 안 보내고 바로 stop해도 정상 종료."""
    svc = FakeSTTService([])
    app = _make_app(svc)

    with TestClient(app) as client:
        _override_state(client, svc)
        with client.websocket_connect("/v1/stt/realtime") as ws:
            ws.send_text("stop")
            done = ws.receive_json()

    assert done == {"type": "done"}
    assert svc.received_audio == []
