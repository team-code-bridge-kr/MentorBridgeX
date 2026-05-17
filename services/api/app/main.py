from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.db.factory import is_offline_demo
from app.db.neo4j import close_neo4j, init_neo4j
from app.db.postgres import init_postgres
from app.db.redis_client import close_redis
from app.errors import AppError, app_error_handler, unhandled_error_handler, validation_error_handler
from app.routers import auth, documents, graph, health, jobs, recommendations, voice
from fastapi.exceptions import RequestValidationError

STATIC_DIR = Path(__file__).parent / "static"


@asynccontextmanager
async def lifespan(_: FastAPI):
    if is_offline_demo():
        yield
        return
    await init_postgres()
    await init_neo4j()
    yield
    await close_neo4j()
    await close_redis()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="MentorBridgeX API",
        description="온톨로지 생기부 MVP — Swagger 데모 (6/5)",
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
    app.include_router(voice.router)

    if STATIC_DIR.exists():
        app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

    @app.get("/dev/graph-viewer", include_in_schema=False)
    async def graph_viewer() -> FileResponse:
        return FileResponse(STATIC_DIR / "graph_viewer.html")

    @app.get("/", include_in_schema=False)
    async def root() -> dict:
        return {
            "service": "MentorBridgeX API",
            "docs": "/docs",
            "graph_viewer": "/dev/graph-viewer",
            "debug": settings.api_debug,
            "offline_demo": settings.offline_demo,
        }

    return app


app = create_app()
