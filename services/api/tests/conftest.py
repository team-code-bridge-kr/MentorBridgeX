import os

import pytest

os.environ.setdefault("DAGLO_API_TOKEN", "test-token")


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line("markers", "integration: requires docker compose (postgres, neo4j, redis)")
