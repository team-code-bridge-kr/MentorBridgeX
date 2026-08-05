"""STT REST + WebSocket 라우트.

엔드포인트:
- POST /v1/stt/async             — 비동기 STT 요청 (옵션 노출)
- GET  /v1/stt/async/{rid}       — 결과 폴링
- GET  /v1/stt/async/{rid}/{fmt} — 결과 파일 다운로드 (선택)
- POST /v1/stt/sync              — 짧은 음성 동기 변환 (테스트 편의)
- WS   /v1/stt/realtime          — 실시간 STT (gRPC 어댑터, B7에서 구현)
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from typing import Annotated

import grpc
from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Path,
    Response,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)

from app.core.daglo.exceptions import DagloError, DagloNotFoundError

from .schemas import AsyncResult, AsyncTranscribeRequest, SubmitResponse, SyncResult
from .service import STTService

router = APIRouter(prefix="/v1/stt", tags=["STT"])


def get_stt_service() -> STTService:
    """FastAPI dependency — main.py에서 override됨."""
    raise RuntimeError("STTService dependency must be configured in app startup")


STTServiceDep = Annotated[STTService, Depends(get_stt_service)]


def _to_http_exception(e: DagloError) -> HTTPException:
    status = e.status_code or 500
    return HTTPException(status_code=status, detail={"daglo_error": str(e), **e.payload})


# ─────────────────────────────────────────────
# Async
# ─────────────────────────────────────────────
@router.post("/async", response_model=SubmitResponse, status_code=200)
async def submit_async_transcribe(
    req: AsyncTranscribeRequest,
    svc: STTServiceDep,
) -> SubmitResponse:
    try:
        return await svc.submit_async(req)
    except DagloError as e:
        raise _to_http_exception(e) from e


@router.get("/async/{rid}", response_model=AsyncResult)
async def get_async_transcribe(
    svc: STTServiceDep,
    rid: Annotated[str, Path(min_length=1)],
) -> AsyncResult:
    try:
        return await svc.get_async(rid)
    except DagloNotFoundError as e:
        raise HTTPException(status_code=404, detail={"daglo_error": str(e)}) from e
    except DagloError as e:
        raise _to_http_exception(e) from e


@router.get("/async/{rid}/{fmt}")
async def download_async_result(
    svc: STTServiceDep,
    rid: Annotated[str, Path(min_length=1)],
    fmt: Annotated[str, Path(min_length=1, max_length=8)],
) -> Response:
    """결과를 자막 파일 등으로 다운로드. fmt 예: srt, vtt."""
    try:
        data = await svc._provider._client.download_async_result(rid, fmt)  # type: ignore[attr-defined]
    except DagloError as e:
        raise _to_http_exception(e) from e
    return Response(content=data, media_type="application/octet-stream")


# ─────────────────────────────────────────────
# Sync (테스트 편의용)
# ─────────────────────────────────────────────
@router.post("/sync", response_model=SyncResult)
async def sync_short_transcribe(
    svc: STTServiceDep,
    file: Annotated[UploadFile, File(description="30초 이하 음성 파일")],
) -> SyncResult:
    audio = await file.read()
    try:
        return await svc.sync_short(file.filename or "audio.wav", audio, file.content_type)
    except DagloError as e:
        raise _to_http_exception(e) from e


# ─────────────────────────────────────────────
# Realtime — WebSocket ↔ Daglo gRPC 어댑터
# 근거:
#   - 양방향 스트리밍 명세: 참고/api_catalog.md:311
#   - partial/final 흐름:   참고/feature_spec.md:204-205
#   - NFR 500ms / 1500ms:   참고/nfr.md:110
#   - 권한:                  참고/permission_matrix.md:213-214
#     (v0.1은 인증 미구현 — 향후 voice-sessions 도메인에서 통합)
# ─────────────────────────────────────────────
async def _ws_audio_iter(ws: WebSocket) -> AsyncIterator[bytes]:
    """클라이언트→서버 바이너리 청크를 비동기 이터레이터로.

    프로토콜:
      - binary message: LINEAR16 16kHz mono PCM 청크 (~0.25초 권장)
      - text message:   "stop"이면 종료 신호 (옵션)
      - disconnect:     정상 종료
    """
    try:
        while True:
            msg = await ws.receive()
            if msg["type"] == "websocket.disconnect":
                return
            if (data := msg.get("bytes")) is not None:
                yield data
            elif (text := msg.get("text")) is not None and text == "stop":
                return
    except WebSocketDisconnect:
        return


@router.websocket("/realtime")
async def realtime_transcribe(ws: WebSocket) -> None:
    """양방향 스트리밍 라이브 STT.

    클라이언트→서버 (binary): LINEAR16 16kHz mono PCM 청크
    클라이언트→서버 (text "stop"): 명시적 종료 (옵션)

    서버→클라이언트 (JSON):
      { "type": "partial", "transcript": "...", "is_final": false }
      { "type": "final",   "transcript": "...", "is_final": true }
      { "type": "error",   "code": "...",       "message": "..." }
      { "type": "done" }

    옵션 (쿼리스트링):
      ?lang=ko-KR        (기본 ko-KR, en-US, mixed)
      ?interim=true      (기본 true, 부분결과 받기)
    """
    await ws.accept()

    language = ws.query_params.get("lang", "ko-KR")
    interim = ws.query_params.get("interim", "true").lower() != "false"

    # 의존성 주입은 main.py의 dependency_overrides로 처리되지만 WS는 Depends가
    # 일반 라우트만큼 깔끔하지 않다. lifespan에서 app.state에 넣어둔 서비스 사용.
    svc: STTService = ws.app.state.stt_service  # type: ignore[assignment]

    try:
        partial_iter = svc.stream_realtime(
            _ws_audio_iter(ws),
            language_code=language,
            interim_results=interim,
        )
        async for partial in partial_iter:
            await ws.send_json(
                {
                    "type": "final" if partial.is_final else "partial",
                    "transcript": partial.transcript,
                    "is_final": partial.is_final,
                    "language": partial.language_code,
                }
            )
        await ws.send_json({"type": "done"})
        await ws.close()

    except grpc.aio.AioRpcError as e:  # type: ignore[attr-defined]
        await ws.send_json(
            {
                "type": "error",
                "code": e.code().name if e.code() else "unknown",
                "message": e.details() or "gRPC error",
            }
        )
        await ws.close(code=1011, reason="upstream_error")
    except asyncio.CancelledError:
        raise
    except WebSocketDisconnect:
        return
    except Exception as e:
        try:
            await ws.send_json({"type": "error", "code": "internal", "message": str(e)})
        finally:
            await ws.close(code=1011, reason="internal_error")
