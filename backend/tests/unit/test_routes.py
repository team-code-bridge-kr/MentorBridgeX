"""FastAPI 라우트 통합 테스트 (앱 → MockTransport).

ASGI in-memory client + lifespan을 거치되 DagloHTTPClient의 transport를 Mock으로 주입.
"""

from __future__ import annotations

import httpx
import pytest

from app.core.daglo.client import DagloHTTPClient
from app.features.stt import routes as stt_routes
from app.features.stt.provider import DagloSTTProvider
from app.features.stt.service import STTService
from app.main import create_app


def make_app_with_mock(handler):
    transport = httpx.MockTransport(handler)
    client = DagloHTTPClient("tkn", transport=transport)
    provider = DagloSTTProvider(client)
    service = STTService(provider)

    app = create_app()
    app.dependency_overrides[stt_routes.get_stt_service] = lambda: service
    return app, client


@pytest.mark.asyncio
async def test_healthz():
    app, daglo = make_app_with_mock(lambda r: httpx.Response(500))
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://t") as c:
        r = await c.get("/healthz")
    await daglo.aclose()
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_post_async_route():
    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"rid": "rid-abc"})

    app, daglo = make_app_with_mock(handler)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://t") as c:
        r = await c.post(
            "/v1/stt/async",
            json={
                "audio_url": "https://example.com/a.wav",
                "speaker_diarization": True,
            },
        )
    await daglo.aclose()

    assert r.status_code == 200, r.text
    assert r.json()["rid"] == "rid-abc"


@pytest.mark.asyncio
async def test_get_async_404():
    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"error": "not found"})

    app, daglo = make_app_with_mock(handler)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://t") as c:
        r = await c.get("/v1/stt/async/missing")
    await daglo.aclose()

    assert r.status_code == 404
