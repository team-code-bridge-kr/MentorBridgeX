FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
RUN pip install --no-cache-dir \
    "fastapi>=0.115.0" "uvicorn[standard]>=0.32.0" \
    "pydantic>=2.9.0" "pydantic-settings>=2.6.0" \
    "sqlalchemy[asyncio]>=2.0.36" "asyncpg>=0.30.0" \
    "neo4j>=5.26.0" "redis>=5.2.0" \
    "python-jose[cryptography]>=3.3.0" "python-multipart>=0.0.12" \
    "ulid-py>=1.1.0" "pyyaml>=6.0.2" "httpx>=0.28.0"

COPY app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
