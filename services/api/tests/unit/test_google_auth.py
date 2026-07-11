from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient, Response

from app.config import get_settings
from app.main import create_app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.asyncio
async def test_google_config_disabled_by_default():
    get_settings.cache_clear()
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/v1/auth/google/config")
    assert res.status_code == 200
    body = res.json()
    assert body["enabled"] is False
    assert body["client_id"] == ""


@pytest.mark.asyncio
async def test_google_callback_exchanges_code(monkeypatch):
    get_settings.cache_clear()
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client-id")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setenv("OFFLINE_DEMO", "true")
    get_settings.cache_clear()

    app = create_app()
    transport = ASGITransport(app=app)

    token_json = {"access_token": "ya29.test"}
    userinfo_json = {
        "email": "student@gmail.com",
        "email_verified": True,
        "name": "김학생",
    }

    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None
    mock_client.post = AsyncMock(return_value=Response(200, json=token_json))
    mock_client.get = AsyncMock(return_value=Response(200, json=userinfo_json))

    with patch("app.routers.auth.httpx.AsyncClient", return_value=mock_client):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post(
                "/v1/auth/google/callback",
                json={
                    "code": "auth-code",
                    "redirect_uri": "https://mbx.teamcodebridge.dev/oauth/callback",
                },
            )

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["email"] == "student@gmail.com"
    assert body["access_token"]
    assert body["display_name"] == "김학생"
    get_settings.cache_clear()
