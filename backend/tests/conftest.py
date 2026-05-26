"""테스트용 공통 fixture.

- DAGLO_API_TOKEN을 dummy로 설정 (실제 호출 ❌, MockTransport 사용)
- FastAPI 앱을 ASGI in-memory로 호출
"""

from __future__ import annotations

import os

os.environ.setdefault("DAGLO_API_TOKEN", "test-token")
