"""Daglo REST API 클라이언트.

채택 범위(STT 전용)에 맞춰 STT 관련 엔드포인트만 노출.
- POST /stt/v1/async/transcripts        (긴 음성 비동기 변환 요청)
- GET  /stt/v1/async/transcripts/{rid}  (결과 폴링)
- POST /stt/v1/sync/transcripts         (테스트/짧은 음성용)
"""

from __future__ import annotations

from typing import Any

import httpx

from .exceptions import from_response


class DagloHTTPClient:
    """단일 httpx.AsyncClient를 감싼 Daglo REST 클라이언트 (커넥션 풀 재사용)."""

    def __init__(
        self,
        api_token: str,
        base_url: str = "https://apis.daglo.ai",
        timeout: float = 30.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        self._client = httpx.AsyncClient(
            base_url=base_url,
            headers={"Authorization": f"Bearer {api_token}"},
            timeout=timeout,
            transport=transport,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> "DagloHTTPClient":
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self.aclose()

    # ─────────────────────────────────────────────
    # STT Async (긴 음성, URL 참조)
    # ─────────────────────────────────────────────
    async def submit_async_transcribe(self, body: dict) -> dict:
        resp = await self._client.post("/stt/v1/async/transcripts", json=body)
        return self._parse(resp)

    async def get_async_transcribe(self, rid: str) -> dict:
        resp = await self._client.get(f"/stt/v1/async/transcripts/{rid}")
        return self._parse(resp)

    async def download_async_result(self, rid: str, fmt: str) -> bytes:
        """결과를 자막 파일 등으로 다운로드 (format은 srt/vtt 등)."""
        resp = await self._client.get(f"/stt/v1/async/transcripts/{rid}/{fmt}")
        if resp.status_code != 200:
            raise from_response(resp.status_code, self._safe_json(resp))
        return resp.content

    # ─────────────────────────────────────────────
    # STT Sync (≤30초, 파일 업로드) — 테스트 편의용
    # ─────────────────────────────────────────────
    async def sync_transcribe(self, filename: str, audio_bytes: bytes) -> dict:
        files = {"file": (filename, audio_bytes, "audio/wav")}
        resp = await self._client.post("/stt/v1/sync/transcripts", files=files)
        return self._parse(resp)

    # ─────────────────────────────────────────────
    # 내부 유틸
    # ─────────────────────────────────────────────
    @staticmethod
    def _parse(resp: httpx.Response) -> dict:
        if resp.status_code == 204:
            return {}
        payload = DagloHTTPClient._safe_json(resp)
        if resp.status_code != 200:
            raise from_response(resp.status_code, payload)
        return payload

    @staticmethod
    def _safe_json(resp: httpx.Response) -> dict:
        try:
            return resp.json()
        except ValueError:
            return {"error": resp.text or f"HTTP {resp.status_code}"}
