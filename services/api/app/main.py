from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.core.daglo.client import DagloHTTPClient
from app.core.daglo.grpc_client import DagloGRPCClient
from app.db.factory import is_offline_demo
from app.db.neo4j import close_neo4j, init_neo4j
from app.db.postgres import SessionLocal, init_postgres
from app.db.redis_client import close_redis
from app.errors import (
    AppError,
    app_error_handler,
    unhandled_error_handler,
    validation_error_handler,
)
from app.features.research import routes as research_routes
from app.features.research.seed import seed_sources, seed_tracks
from app.features.stt import routes as stt_routes
from app.features.stt.provider import DagloSTTProvider
from app.features.stt.service import STTService
from app.routers import auth, documents, graph, health, jobs, product, recommendations, sync, voice

STATIC_DIR = Path(__file__).parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    daglo_client: DagloHTTPClient | None = None
    app.state.stt_service = None

    if settings.daglo_api_token:
        daglo_client = DagloHTTPClient(
            api_token=settings.daglo_api_token,
            base_url=settings.daglo_base_url,
            timeout=settings.daglo_timeout_seconds,
        )
        grpc_client = DagloGRPCClient(api_token=settings.daglo_api_token)
        provider = DagloSTTProvider(daglo_client, grpc_client=grpc_client)
        service = STTService(provider)
        app.dependency_overrides[stt_routes.get_stt_service] = lambda: service
        app.state.stt_service = service

    if not is_offline_demo():
        await init_postgres()
        await init_neo4j()
        # 트랙 프리셋·수집 소스는 운영 상수 — 시드 파일을 고치면 재시작만으로 반영된다
        async with SessionLocal() as session:
            await seed_tracks(session)
            await seed_sources(session)

    yield

    if daglo_client is not None:
        await daglo_client.aclose()
    if not is_offline_demo():
        await close_neo4j()
        await close_redis()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="MentorBridgeX API",
        description="온톨로지 생기부 MVP + Daglo STT + product APIs",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(Exception, unhandled_error_handler)

    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(graph.router)
    app.include_router(documents.router)
    app.include_router(recommendations.router)
    app.include_router(jobs.router)
    app.include_router(sync.router)
    app.include_router(voice.router)
    app.include_router(product.comments_router)
    app.include_router(product.notifications_router)
    app.include_router(product.forms_router)
    app.include_router(product.settings_router)
    app.include_router(product.voice_router)
    app.include_router(product.stats_router)
    app.include_router(stt_routes.router)
    app.include_router(research_routes.router)

    if STATIC_DIR.exists():
        app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

    @app.get("/dev/graph-viewer", include_in_schema=False)
    async def graph_viewer() -> FileResponse:
        return FileResponse(STATIC_DIR / "graph_viewer.html")

    @app.get("/dev/stt-recorder", include_in_schema=False)
    async def stt_recorder() -> FileResponse:
        return FileResponse(STATIC_DIR / "stt_recorder.html")

    @app.get("/", include_in_schema=False)
    async def root() -> dict:
        return {
            "service": "MentorBridgeX API",
            "docs": "/docs",
            "graph_viewer": "/dev/graph-viewer",
            "stt_recorder": "/dev/stt-recorder",
            "debug": settings.api_debug,
            "offline_demo": settings.offline_demo,
            "stt_enabled": bool(settings.daglo_api_token),
        }

    return app


app = create_app()
