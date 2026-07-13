from typing import Any

import ulid
from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(
        self, code: str, message: str, status_code: int = 400, details: dict | None = None
    ):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}


def new_trace_id() -> str:
    return str(ulid.new())


def error_body(
    code: str, message: str, details: dict | None = None, trace_id: str | None = None
) -> dict:
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details or {},
            "trace_id": trace_id or new_trace_id(),
        }
    }


async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(exc.code, exc.message, exc.details),
    )


async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=error_body(
            "VAL_INVALID_REQUEST",
            "요청 형식이 올바르지 않습니다.",
            {"issues": exc.errors()},
        ),
    )


async def unhandled_error_handler(_: Request, exc: Exception) -> JSONResponse:
    from app.config import get_settings

    trace_id = new_trace_id()
    details: dict[str, Any] = {}
    if get_settings().api_debug:
        details["type"] = type(exc).__name__
    return JSONResponse(
        status_code=500,
        content=error_body(
            "SYS_INTERNAL_ERROR",
            "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
            details,
            trace_id=trace_id,
        ),
    )
