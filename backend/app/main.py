"""FastAPI 진입점.

v0.1 범위: Daglo STT 통합 (라이브/비동기). NLP/TTS는 미채택.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.daglo.client import DagloHTTPClient
from app.core.daglo.grpc_client import DagloGRPCClient
from app.features.stt import routes as stt_routes
from app.features.stt.provider import DagloSTTProvider
from app.features.stt.service import STTService


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    client = DagloHTTPClient(
        api_token=settings.daglo_api_token,
        base_url=settings.daglo_base_url,
        timeout=settings.daglo_timeout_seconds,
    )
    grpc_client = DagloGRPCClient(api_token=settings.daglo_api_token)
    provider = DagloSTTProvider(client, grpc_client=grpc_client)
    service = STTService(provider)

    app.dependency_overrides[stt_routes.get_stt_service] = lambda: service
    app.state.daglo_client = client
    app.state.stt_service = service  # WS 라우트가 사용 (Depends 불가)
    try:
        yield
    finally:
        await client.aclose()


def create_app() -> FastAPI:
    app = FastAPI(
        title="MentorBridgeX Backend (Daglo STT integration)",
        version="0.1.0",
        lifespan=lifespan,
    )

    # 개발 편의용 CORS — 운영 진입 시 도메인 화이트리스트로 좁힐 것
    # (HTML 테스터를 file:// 또는 다른 origin에서 열 때 필요)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/healthz", tags=["meta"])
    async def healthz() -> dict:
        return {"status": "ok"}

    app.include_router(stt_routes.router)
    return app


app = create_app()
