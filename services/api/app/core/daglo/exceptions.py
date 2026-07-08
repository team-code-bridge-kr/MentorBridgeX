class DagloError(Exception):
    """Daglo API 호출 중 발생한 오류의 베이스."""

    def __init__(self, message: str, status_code: int | None = None, payload: dict | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload or {}


class DagloAuthError(DagloError):
    """401/403."""


class DagloRateLimitError(DagloError):
    """429 — 엔드포인트당 20 req/sec 초과."""


class DagloPayloadError(DagloError):
    """400/413/415."""


class DagloServerError(DagloError):
    """500/503 — 서버측 오류 (재시도 후보)."""


class DagloNotFoundError(DagloError):
    """404 — 잘못된 rid 등."""


def from_response(status_code: int, payload: dict) -> DagloError:
    msg = payload.get("error") or f"Daglo API error (HTTP {status_code})"
    if status_code in (401, 403):
        return DagloAuthError(msg, status_code, payload)
    if status_code == 404:
        return DagloNotFoundError(msg, status_code, payload)
    if status_code == 429:
        return DagloRateLimitError(msg, status_code, payload)
    if status_code in (400, 413, 415):
        return DagloPayloadError(msg, status_code, payload)
    if status_code in (500, 503):
        return DagloServerError(msg, status_code, payload)
    return DagloError(msg, status_code, payload)
