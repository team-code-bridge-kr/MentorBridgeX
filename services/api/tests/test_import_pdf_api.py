import os

import pytest
from httpx import ASGITransport, AsyncClient

# Harness / API tests run without Docker
os.environ.setdefault("OFFLINE_DEMO", "1")

from app.db.memory import reset_memory_db
from app.main import app
from tests.harness.test_pdf_harness import _pdf_bytes_from_text

FIXTURE_TEXT = (
    "국어: 음운 변동과 프로그래밍 프로젝트를 통해 탐구하고 발표함.\n"
    "수학: 데이터 분석과 실험 설계 역량을 키움."
)


@pytest.fixture(autouse=True)
def _reset_db() -> None:
    reset_memory_db()


@pytest.mark.asyncio
async def test_import_pdf_end_to_end() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/v1/auth/dev-login",
            json={"email": "pdf@test.example.com", "display_name": "PDF 테스트"},
        )
        assert login.status_code == 200
        token = login.json()["access_token"]

        pdf_bytes = _pdf_bytes_from_text(FIXTURE_TEXT)
        res = await client.post(
            "/v1/students/me/documents/import-pdf",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("sample.pdf", pdf_bytes, "application/pdf")},
        )
        assert res.status_code == 200, res.text
        job_id = res.json()["job_id"]

        job = await client.get(f"/v1/jobs/{job_id}", headers={"Authorization": f"Bearer {token}"})
        assert job.status_code == 200
        body = job.json()
        assert body["status"] == "completed"

        result = body["result"]
        assert isinstance(result, dict)
        assert result["extractor"] == "pymupdf+rule_tokens"
        assert result["unique_token_count"] >= 5
        assert len(result["tokens"]) == result["unique_token_count"]
        assert "프로그래밍" in result["keywords"]

        graph = await client.get(
            "/v1/students/me/graph", headers={"Authorization": f"Bearer {token}"}
        )
        assert graph.status_code == 200
        snapshot = graph.json()
        assert len(snapshot["nodes"]) >= 5
        assert len(snapshot["edges"]) >= 1
