"""DagloHTTPClient 단위 테스트.

실제 Daglo 호출 ❌. httpx.MockTransport로 응답 시나리오 주입.
fixtures의 JSON은 Phase A 검증에서 받은 실제 응답을 그대로 사용 가능.
"""

from __future__ import annotations

import json

import httpx
import pytest

from app.core.daglo.client import DagloHTTPClient
from app.core.daglo.exceptions import DagloAuthError, DagloNotFoundError, DagloServerError
from app.features.stt.provider import DagloSTTProvider
from app.features.stt.schemas import AsyncTranscribeRequest


def make_transport(handler):
    return httpx.MockTransport(handler)


@pytest.mark.asyncio
async def test_submit_async_translates_options_to_daglo_body():
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["body"] = json.loads(request.content)
        captured["auth"] = request.headers.get("authorization")
        return httpx.Response(200, json={"rid": "rid-123"})

    async with DagloHTTPClient("tkn", transport=make_transport(handler)) as client:
        provider = DagloSTTProvider(client)
        resp = await provider.submit_async(
            AsyncTranscribeRequest(
                audio_url="https://example.com/a.wav",
                speaker_diarization=True,
                keyword_boost=["다글로", "클라우드"],
                keyword_extraction=True,
            )
        )

    assert resp.rid == "rid-123"
    assert captured["auth"] == "Bearer tkn"
    assert captured["url"].endswith("/stt/v1/async/transcripts")
    assert captured["body"] == {
        "audio": {"source": {"url": "https://example.com/a.wav"}},
        "sttConfig": {
            "speakerDiarization": {"enable": True},
            "keywordBoost": {"enable": True, "keywords": ["다글로", "클라우드"]},
        },
        "nlpConfig": {"keywordExtraction": {"enable": True}},
    }


@pytest.mark.asyncio
async def test_get_async_returns_processed_result():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "rid": "rid-1",
                "status": "transcribed",
                "progress": 100,
                "sttResults": [{"transcript": "안녕하세요"}],
            },
        )

    async with DagloHTTPClient("tkn", transport=make_transport(handler)) as client:
        provider = DagloSTTProvider(client)
        result = await provider.get_async("rid-1")

    assert result.status == "transcribed"
    assert result.progress == 100
    assert result.sttResults and result.sttResults[0].transcript == "안녕하세요"


@pytest.mark.asyncio
async def test_sync_short_unwraps_transcript():
    def handler(request: httpx.Request) -> httpx.Response:
        assert "multipart/form-data" in request.headers.get("content-type", "")
        return httpx.Response(200, json={"sttResult": {"transcript": "테스트입니다"}})

    async with DagloHTTPClient("tkn", transport=make_transport(handler)) as client:
        provider = DagloSTTProvider(client)
        out = await provider.sync_short("a.wav", b"RIFFxxxxWAVE")

    assert out.transcript == "테스트입니다"
    assert out.rid is None  # 실측: sync 응답엔 rid 없음


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "code,exc_type",
    [
        (401, DagloAuthError),
        (403, DagloAuthError),
        (404, DagloNotFoundError),
        (500, DagloServerError),
        (503, DagloServerError),
    ],
)
async def test_error_mapping(code, exc_type):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(code, json={"error": "boom"})

    async with DagloHTTPClient("tkn", transport=make_transport(handler)) as client:
        with pytest.raises(exc_type):
            await client.get_async_transcribe("rid-x")


@pytest.mark.asyncio
async def test_keyword_boost_disabled_when_list_empty():
    """boost 리스트가 비어있으면 sttConfig에 boost 키 자체가 안 나가야 함."""

    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json={"rid": "x"})

    async with DagloHTTPClient("tkn", transport=make_transport(handler)) as client:
        provider = DagloSTTProvider(client)
        await provider.submit_async(
            AsyncTranscribeRequest(audio_url="https://x.com/a.wav", keyword_boost=None)
        )

    assert "sttConfig" not in captured["body"]
